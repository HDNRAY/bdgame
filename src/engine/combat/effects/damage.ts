import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { ActionDefinition } from '../../entities/action'
import type { GameEntity } from '../../entities/base'
import { calcCritChance, calcFinalDamage, calcParriedDamage, calcParryChance, calcRoll } from '../../calc/damage'
import { getWeapon } from '../../../data/weapons/weapons'
import { consumeBuffsByTrigger, forEachBuffOf } from '../utils'

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
    bonus?: boolean
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

    // 普通追加伤害（走修正管道）
    let final = 0
    if (raw > 0) {
        const modResult = applyDamageModifiers({
            final: raw,
            target,
            attacker,
            engine,
            raw,
            source,
            bonus: true,
            triggered,
        })
        final = modResult.damage
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

/** 应用伤害（含招架判定） */
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
    // 增伤效果在招架前计算
    const { damage: buffed, piercing: buffPiercing } = applyDamageModifiers({
        final: raw,
        target,
        attacker,
        engine,
        raw,
        source,
        triggered,
    })
    const totalPiercing = piercing + buffPiercing
    const { parried, final: afterParry } = resolveParry(buffed, target, attacker, engine, act)
    const blocked = buffed - afterParry
    const { isCrit, final: afterCrit } = resolveCrit(afterParry, buffed, target, attacker, engine, act)
    let final = afterCrit + totalPiercing

    // 百分比穿透（按暴击后伤害计算）
    let piercingRatioTotal = 0
    if (act) {
        for (const eff of act.effects ?? []) {
            if (eff.type === 'damage' && eff.piercingRatio) {
                const p = Math.max(1, Math.round(final * eff.piercingRatio))
                piercingRatioTotal += p
            }
        }
        if (piercingRatioTotal > 0) {
            final += piercingRatioTotal
        }
    }

    // onAfterCritDamage 钩子：暴击后、实施伤害前，可将部分爆伤转为其他效果
    if (isCrit) {
        const damage = afterParry + totalPiercing
        const critDamage = afterCrit + totalPiercing
        let converted = 0
        forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
            if (!def?.onAfterCritDamage) return
            converted += def.onAfterCritDamage({
                damage,
                critDamage,
                final: critDamage,
                raw,
                target,
                attacker,
                engine,
                state: engine.state,
                layer,
                source: act,
            })
        })
        if (converted > 0) {
            final -= Math.min(converted, critDamage - damage)
        }
    }

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
            if (!def.onCanBeParried({ self: attacker, engine })) {
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
    let pc = calcParryChance(0, target.attrs.get('dexterity'), target.attrs.get('insight'))
    if (target.parryMod) {
        pc = pc + target.parryMod
    }
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
    // 防御方 buff onParried 钩子（在招式作用域内，渲染层 +1 缩进）
    forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
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

    // ── 5. 伤害减免 ──
    let final = calcParriedDamage(raw, target.attrs.get('strength'))
    if (act) {
        // 目标方 buff 修正招架减伤
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
        // 攻击方 buff 修正招架穿透（如玄铁剑·重剑无锋、霸刀）
        forEachBuffOf(engine.state.pendingBuffs, attacker.id, (def, layer) => {
            if (!def?.onParryPenetration) return
            final = def.onParryPenetration({
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
    if (act?.onActionCritChance) critChance = act.onActionCritChance(critChance)
    const critRoll = calcRoll(critChance)
    const isCrit = critRoll.success

    let critDmgMod = 0
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
        if (act.onActionCritDamage) critDmgMod += act.onActionCritDamage(critDmgMod, engine.state, attacker)
    }
    engine.emitLog({ type: 'check_crit', sourceId: attacker.id, critChance, roll: critRoll.roll, result: isCrit })
    const final = calcFinalDamage(damage, 1, isCrit, critDmgMod)
    return { isCrit, final: Math.round(final * 10) / 10 }
}

// ── 通用伤害修正 ──

/** 遍历双方 buff 的伤害修正钩子，自动修正伤害 */
function applyDamageModifiers({
    final,
    target,
    attacker,
    engine,
    raw,
    source,
    bonus = false,
    triggered,
}: ApplyDamageModifiersOptions): { damage: number; piercing: number } {
    let piercing = 0
    forEachBuffOf(engine.state.pendingBuffs, [target.id, attacker.id], (def, layer, _b, _k, ownerId) => {
        if (!source) return
        const ctx = {
            final,
            raw,
            target,
            attacker,
            engine,
            state: engine.state,
            layer,
            buffOwnerId: ownerId,
            source,
            triggered,
        }
        // 独立追加伤害不触发攻击者的 onDealDamage（防止守宫砂等重复计数）
        if (!bonus && ownerId === attacker.id && def?.onDealDamage) {
            const result = def.onDealDamage(ctx)
            if (typeof result === 'object') {
                final = result.normal
                piercing += result.piercing ?? 0
            } else {
                final = result
            }
        }
        if (ownerId === target.id && def?.onTakeDamage) {
            final = def.onTakeDamage(ctx)
        }
    })
    return { damage: final, piercing }
}
