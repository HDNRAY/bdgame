import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { ActionDefinition } from '../../entities/action'
import type { GameEntity } from '../../entities/base'
import type { BuffDef } from '../../../data/buffs/types'
import type { BuffLayer } from '../types'
import {
    calcCritChance,
    calcBaseCritDamage,
    calcFinalDamage,
    calcParriedDamage,
    calcParryChance,
    calcRoll,
} from '../../calc/damage'
import { getWeapon } from '../../../data/weapons/weapons'
import { consumeBuffsByTrigger, forEachBuffOf } from '../utils'
import { round1 } from '../../util/math'

// ── Options 类型 ──

export interface ApplyDamageOptions {
    raw: number
    target: Character
    attacker: Character
    engine: BattleEngine
    source?: GameEntity
    piercing?: number
    /** 多段攻击：除最后一段外抑制所有触发器（on_crit/on_took_damage 等） */
    suppressTriggers?: boolean
    triggered?: boolean
}

interface ApplyBonusDamageOptions {
    raw: number
    target: Character
    attacker: Character
    engine: BattleEngine
    source?: GameEntity
    label: string
    labelId: string
    piercing?: number
    triggered?: boolean
}

interface ApplyDamageModifiersOptions {
    final: number
    target: Character
    attacker: Character
    engine: BattleEngine
    raw: number
    source?: GameEntity
    triggered?: boolean
}

// ── 独立伤害管道 ──

/**
 * 独立追加伤害（跳过招架/暴击/命中，吃 onDealDamage/onTakeDamage 修正）
 * 用于 buff 的 onAfterDealDamage 或 action effect 的独立伤害
 */
export function applyBonusDamage({
    raw,
    target,
    attacker,
    engine,
    source,
    label,
    labelId,
    piercing = 0,
    triggered,
}: ApplyBonusDamageOptions): void {
    if (raw <= 0 && piercing <= 0) return

    // 穿透伤害（无视所有减免/吸收）
    if (piercing > 0) {
        target.takeDamage(piercing, engine)
    }

    // 普通追加伤害（走减伤→吸收阶段；独立伤害跳过暴击/招架/命中）
    let final = 0
    if (raw > 0) {
        final = applyDefenseStages(raw, target, attacker, engine, raw, source, triggered)
        target.takeDamage(final, engine)
    }

    const total = piercing + final
    if (total > 0) {
        engine.emitLog({
            type: 'damage',
            actionId: labelId,
            actionName: label,
            sourceId: attacker.id,
            targetId: target.id,
            base: piercing + raw,
            final: total,
            blocked: raw - Math.max(final, 0),
            isCrit: false,
            isParried: false,
            tags: ['bonus_damage'],
        })
    }
}

// ── 伤害管道 ──

/** 应用伤害（含暴击判定；结算顺序：暴击+爆伤 → 穿透拆出 → 招架 → 减伤 → 吸收 → 扣血） */
export function applyDamage({
    raw,
    target,
    attacker,
    engine,
    source,
    piercing = 0,
    suppressTriggers = false,
    triggered,
}: ApplyDamageOptions): void {
    const act = source as ActionDefinition | undefined
    // ① 增伤效果（攻击方 onDealDamage）在暴击前计算
    const { damage: buffed, piercing: buffPiercing } = applyDamageModifiers({
        final: raw,
        target,
        attacker,
        engine,
        raw,
        source,
        triggered,
    })
    // ② 暴击判定 + 爆伤（基于增伤后裸伤，不再受招架/减伤削减）
    const { isCrit, final: afterCrit } = resolveCrit(buffed, buffed, target, attacker, engine, act)

    // onAfterCritDamage 钩子：暴击后、穿透拆出前，可将爆伤转为其他效果
    // 返回全量：钩子返回本次暴击应造成的完整伤害，引擎以该值覆盖（按 priority 升序链式，final 传入当前值）
    let critFinal = afterCrit
    if (isCrit) {
        const damage = buffed
        const critDamage = afterCrit
        let finalCrit = critDamage
        const critHooks: { def: BuffDef; layer: BuffLayer }[] = []
        forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
            if (!def?.onAfterCritDamage) return
            critHooks.push({ def, layer })
        })
        critHooks.sort((a, b) => (a.def.priority ?? 0) - (b.def.priority ?? 0))
        for (const { def, layer } of critHooks) {
            finalCrit = def.onAfterCritDamage!({
                damage,
                critDamage,
                final: finalCrit,
                raw,
                target,
                attacker,
                engine,
                state: engine.state,
                layer,
                source: act,
            })
        }
        critFinal = finalCrit
    }

    // ③ 暴击结算后伤害修正（招架前）：攻击方 onPostCritDamage 在此生效。
    //    返回 number 整体覆盖（可增伤/转化）；返回 {normal,piercing} 表示把伤害拆出穿透，
    //    引擎取其比例（piercing/(normal+piercing)）与招式 piercingRatio 加算，上限 100%——
    //    穿透是「结算方式」而非「伤害加成」：总伤害不膨胀，穿透部分无视招架/减伤/吸收。
    let base = critFinal
    let pierceRatio = 0
    // 招式自带百分比穿透（如三寸光 50%）
    if (act) {
        for (const eff of act.effects ?? []) {
            if (eff.type === 'damage' && eff.piercingRatio) {
                pierceRatio += eff.piercingRatio
            }
        }
    }
    // 攻击方 buff 穿透钩子：每个钩子基于当前 base 返回拆分，引擎反推其穿透比例（加算）
    forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
        if (!def?.onPostCritDamage) return
        const r = def.onPostCritDamage({
            final: base,
            raw,
            target,
            attacker,
            engine,
            state: engine.state,
            layer,
            source: act,
        })
        if (typeof r === 'object') {
            const total = r.normal + (r.piercing ?? 0)
            if (total > 0) pierceRatio += (r.piercing ?? 0) / total
        } else {
            base = r
        }
    })
    pierceRatio = Math.min(1, pierceRatio)
    // 一次性拆分：穿透 = base × ratio（无视招架/减伤/吸收），普通 = 剩余部分
    const normalFinal = round1(base * (1 - pierceRatio))
    const totalPiercing = round1(base * pierceRatio) + piercing + buffPiercing

    // ④ 招架（仅作用于非穿透部分）
    const { parried, final: afterParry } = resolveParry(normalFinal, target, attacker, engine, act)
    const blocked = normalFinal - afterParry

    // ⑤ 减伤 → ⑥ 吸收（防御方 onTakeDamage 减伤/反伤回缠，再 onAbsorb 护盾池，最后结算）
    let final = applyDefenseStages(afterParry, target, attacker, engine, raw, act, triggered)

    // 穿透部分无视招架/减伤/吸收，最后并入
    final += totalPiercing

    target.takeDamage(final, engine)
    if (final > 0 && !suppressTriggers) {
        engine.emit('on_dealt_damage', attacker, target)
        engine.emit('on_took_damage', target, attacker)
        consumeBuffsByTrigger(target.id, engine, 'on_took_damage')
    }

    engine.emitLog({
        type: 'damage',
        actionId: source?.id ?? 'unknown',
        actionName: source?.name ?? '未知',
        sourceId: attacker.id,
        targetId: target.id,
        base: raw,
        final,
        blocked,
        isCrit,
        isParried: parried,
        tags: [],
    })
    if (isCrit && !suppressTriggers) {
        consumeBuffsByTrigger(attacker.id, engine, 'on_crit')
        engine.emit('on_crit', attacker, target)
        // 被暴击事件（防御方触发，逆转经脉等反击）；召唤物攻击不触发反应
        if (!act?.tags.includes('summon')) engine.emit('on_was_crit', target, attacker)
        // 攻击方 buff onCritical 钩子（在招式作用域内，渲染层 +1 缩进）
        forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
            if (!def?.onCritical) return
            def.onCritical({
                final,
                raw,
                target,
                attacker,
                engine,
                state: engine.state,
                layer,
                source: act,
            })
        })
    }

    // ── buff 独立追加伤害（onAfterDealDamage） ──
    forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
        if (!def?.onAfterDealDamage) return
        const ctx = {
            final,
            raw,
            target,
            attacker,
            engine,
            state: engine.state,
            layer,
            buffOwnerId: attacker.id,
            source: def,
        }
        const bonusResult = def.onAfterDealDamage(ctx)
        if (typeof bonusResult === 'object') {
            const { normal = 0, piercing: p = 0 } = bonusResult
            if (normal > 0 || p > 0) {
                applyBonusDamage({
                    raw: normal,
                    target,
                    attacker,
                    engine,
                    source: def,
                    label: def.name,
                    labelId: def.id,
                    piercing: p,
                })
            }
        } else if (bonusResult > 0) {
            applyBonusDamage({
                raw: bonusResult,
                target,
                attacker,
                engine,
                source: def,
                label: def.name,
                labelId: def.id,
            })
        }
    })
}

// ── 招架 ──

/** 招架判定：是否招架 + 招架后伤害 */
function resolveParry(
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    act: ActionDefinition | undefined,
): { parried: boolean; final: number } {
    // ── 1. 攻击方能否被招架 ──
    const cannotBeParried = (() => {
        let result = false
        forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def) => {
            if (!def?.onCanBeParried) return
            if (!def.onCanBeParried({ self: attacker, engine, source: act })) {
                result = true
                return false
            }
        })
        return result
    })()
    // 招式自带无视招架
    const actionIgnoresParry = act?.effects?.some((e) => e.type === 'ignore_parry')
    if (cannotBeParried || actionIgnoresParry) return { parried: false, final: raw }

    // ── 2. 目标能否招架（buff onCanParry 覆盖武器标签） ──
    const weapon = target.weaponDef ?? getWeapon(target.build.weapon)
    const hasParryTag = weapon.tags.includes('parry')

    let buffCanParry: boolean | undefined
    forEachBuffOf(engine.state.pendingBuffs, target.id, (def) => {
        if (!def?.onCanParry) return
        const result = def.onCanParry({ self: target, engine })
        if (!result) {
            buffCanParry = false
            return false
        }
        buffCanParry = true
    })

    const canParry = buffCanParry ?? hasParryTag
    if (!canParry) return { parried: false, final: raw }

    // ── 2. 招架概率 ──
    let pc = calcParryChance(target.attrs.get('dexterity'), target.attrs.get('insight'))
    if (act) {
        forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
            if (!def?.onParryChance) return
            const bonus = def.onParryChance({
                final: raw,
                raw,
                target,
                attacker,
                engine,
                state: engine.state,
                layer,
                source: act,
            })
            pc = pc + bonus
        })
    }

    // ── 3. 摇奖 ──
    const { success: parried, roll } = calcRoll(pc)
    engine.emitLog({
        type: 'check_parry',
        sourceId: attacker.id,
        targetId: target.id,
        parryChance: pc,
        roll,
        result: parried,
    })
    if (!parried) return { parried: false, final: raw }

    // ── 4. 消耗 on_parry 类 buff（看破等） ──
    consumeBuffsByTrigger(target.id, engine, 'on_parry')
    engine.emit('on_parry', target, attacker)
    engine.emit('on_parried', attacker, target)
    // 防御方 buff onParry 钩子（自己成功招架；遍历防御方 buff，与 trigger on_parry 同义）
    forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
        if (!def?.onParry) return
        def.onParry({
            final: raw,
            raw,
            target,
            attacker,
            engine,
            layer,
            state: engine.state,
            source: act,
        })
    })
    // 攻击方 buff onParried 钩子（自己攻击被对方招架；遍历攻击方 buff，与 trigger on_parried 同义）
    forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
        if (!def?.onParried) return
        def.onParried({
            final: raw,
            raw,
            target,
            attacker,
            engine,
            layer,
            state: engine.state,
            source: act,
        })
    })

    // ── 5. 伤害减免(先算防御) ──
    let final = calcParriedDamage(raw, target.attrs.get('strength'))
    if (act) {
        // 5a. 目标方 buff 修正招架减伤(含固定减免 -2/-3 等,全部先结算)
        forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
            if (!def?.onParryReduction) return
            final = def.onParryReduction({
                final,
                raw,
                target,
                attacker,
                engine,
                state: engine.state,
                layer,
                source: act,
            })
        })
        // 5b. 攻击方 buff 招架穿透(玄铁剑/霸刀/次元刃等):
        //     每个 onParryPenetration 返回「本次穿掉的伤害值」(基于 final/raw 自行计算),
        //     引擎把多个穿透返回值相加,clamp 到最多把整个招架段减免穿干净(blocked),
        //     不会穿成负数,也不会把⑤段减伤/吸收一并穿掉(那在招架段之后独立结算)。
        //     固定减免(onParryReduction 的 -2/-3)属于招架段,会被穿透影响。
        const blocked = raw - final
        if (blocked > 0) {
            let piercedTotal = 0
            forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
                if (!def?.onParryPenetration) return
                const pierced = def.onParryPenetration({
                    final,
                    raw,
                    target,
                    attacker,
                    engine,
                    state: engine.state,
                    layer,
                    source: act,
                })
                if (pierced > 0) piercedTotal += pierced
            })
            const pierced = Math.min(piercedTotal, blocked)
            final = Math.round((final + pierced) * 10) / 10
        }
    }
    final = Math.round(final * 10) / 10
    return { parried: true, final }
}

// ── 暴击 ──

/** 暴击判定：是否暴击 + 暴击后伤害 */
function resolveCrit(
    damage: number,
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    act: ActionDefinition | undefined,
): { isCrit: boolean; final: number } {
    let bonus = 0
    forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
        if (!act) return false
        if (def?.onCritChance)
            bonus += def.onCritChance({
                final: damage,
                raw,
                target,
                attacker,
                engine,
                state: engine.state,
                layer,
                source: act,
            })
    })
    // 遍历防御方 buff，降低被暴击率
    forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
        if (def?.onCritTakenChance)
            bonus += def.onCritTakenChance({
                final: damage,
                raw,
                target,
                attacker,
                engine,
                state: engine.state,
                layer,
                source: act,
            })
    })
    let critChance = calcCritChance(attacker.attrs.get('dexterity'), attacker.attrs.get('insight'), bonus)
    if (act?.onActionCritChance) critChance = act.onActionCritChance(critChance, engine.state, attacker)
    const critRoll = calcRoll(critChance)
    const isCrit = critRoll.success

    let critDmgMod = 0
    critDmgMod += calcBaseCritDamage(attacker.attrs.get('dexterity'))
    if (act) {
        forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
            if (def?.onCritDamage)
                critDmgMod += def.onCritDamage({
                    final: damage,
                    raw,
                    target,
                    attacker,
                    engine,
                    state: engine.state,
                    layer,
                    source: act,
                })
        })
        // 防御方减爆伤（负=更难被暴击伤害，如逆转经脉 -0.5 → 爆伤 1.5→1.0）
        forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
            if (def?.onCritTakenDamage)
                critDmgMod += def.onCritTakenDamage({
                    final: damage,
                    raw,
                    target,
                    attacker,
                    engine,
                    state: engine.state,
                    layer,
                    source: act,
                })
        })
        if (act.onActionCritDamage) critDmgMod = act.onActionCritDamage(critDmgMod, engine.state, attacker)
    }
    engine.emitLog({ type: 'check_crit', sourceId: attacker.id, critChance, roll: critRoll.roll, result: isCrit })
    const final = calcFinalDamage(damage, 1, isCrit, critDmgMod)
    return { isCrit, final: Math.round(final * 10) / 10 }
}

// ── 通用伤害修正 ──

/** 遍历攻击方 buff 的增伤钩子（onDealDamage，暴击前结算） */
function applyDamageModifiers({
    final,
    target,
    attacker,
    engine,
    raw,
    source,
    triggered,
}: ApplyDamageModifiersOptions): { damage: number; piercing: number } {
    let piercing = 0
    forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
        if (!source) return
        const ctx = {
            final,
            raw,
            target,
            attacker,
            engine,
            state: engine.state,
            layer,
            buffOwnerId: attacker.id,
            source,
            triggered,
        }
        if (def?.onDealDamage) {
            const result = def.onDealDamage(ctx)
            if (typeof result === 'object') {
                final = result.normal
                piercing += result.piercing ?? 0
            } else {
                final = result
            }
        }
    })
    return { damage: final, piercing }
}

/** 防御阶段：减伤（onTakeDamage）→ 吸收（onAbsorb），供追加伤害复用 */
function applyDefenseStages(
    final: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    raw: number,
    source?: GameEntity,
    triggered?: boolean,
): number {
    // 减伤
    forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
        if (!def?.onTakeDamage) return
        final = def.onTakeDamage({
            final,
            raw,
            target,
            attacker,
            engine,
            state: engine.state,
            layer,
            source,
            triggered,
        })
    })
    // 吸收
    forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
        if (!def?.onAbsorb) return
        final = def.onAbsorb({
            final,
            raw,
            target,
            attacker,
            engine,
            state: engine.state,
            layer,
            source,
            triggered,
        })
    })
    return final
}
