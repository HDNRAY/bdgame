import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { ActionDefinition } from '../../entities/action'
import { calcCritChance, calcFinalDamage, calcParriedDamage, calcParryChance, calcRoll } from '../../calc/damage'
import { getWeapon } from '../../data/weapons/weapons'
import { getBuff } from '../../data/buffs'
import { getAction } from '../../data/actions'
import { consumeBuffsByTrigger } from '../utils'

// ── 独立伤害管道 ──

/**
 * 独立追加伤害（跳过招架/暴击/命中，吃 onDealDamage/onTakeDamage 修正）
 * 用于 buff 的 onAfterDealDamage 或 action effect 的独立伤害
 */
export function applyBonusDamage(
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    actionDef: ActionDefinition | undefined,
    label: string,
    labelId: string,
): void {
    if (raw <= 0) return
    const final = applyDamageModifiers(raw, target, attacker, engine, raw, actionDef, true)
    target.takeDamage(final, engine)
    engine.emitLog({
        type: 'damage',
        actionId: labelId,
        actionName: label,
        sourceId: attacker.id,
        targetId: target.id,
        base: raw,
        final,
        blocked: 0,
        isCrit: false,
        isParried: false,
        tags: ['bonus_damage'],
    })
}

// ── 伤害管道 ──

/** 应用伤害（含招架判定） */
export function applyDamage(
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    actionDef?: ActionDefinition,
): void {
    const act = actionDef
    // 增伤效果在招架前计算
    const buffed = applyDamageModifiers(raw, target, attacker, engine, raw, actionDef)
    const { parried, final: afterParry } = resolveParry(buffed, target, attacker, engine, act)
    const blocked = buffed - afterParry
    const { isCrit, final: afterCrit } = resolveCrit(afterParry, buffed, target, attacker, engine, act)
    const final = afterCrit

    target.takeDamage(final, engine)

    if (final > 0) {
        engine.emit('on_dealt_damage', attacker, target)
        engine.emit('on_took_damage', target, attacker)
    }

    engine.emitLog({
        type: 'damage',
        actionId: actionDef?.id ?? 'unknown',
        actionName: actionDef?.name ?? '未知',
        sourceId: attacker.id,
        targetId: target.id,
        base: raw,
        final,
        blocked,
        isCrit,
        isParried: parried,
        tags: [],
    })
    if (isCrit) {
        consumeBuffsByTrigger(attacker.id, engine, 'on_crit')
        engine.emit('on_crit', attacker, target)
        // 攻击方 buff onCritical 钩子（缩进一层）
        engine.state.log.indentDepth++
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== attacker.id) continue
            const def = getBuff(parts[0])
            if (!def?.onCritical) continue
            def.onCritical({
                final,
                raw,
                target,
                attacker,
                engine,
                layer,
                buffOwnerId: parts[1],
                action: act,
            })
        }
        engine.state.log.indentDepth--
    }

    // ── buff 独立追加伤害（onAfterDealDamage） ──
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== attacker.id) continue
        const def = getBuff(parts[0])
        if (!def?.onAfterDealDamage) continue
        const act = actionDef ?? getAction('')
        if (!act) continue
        const ctx = { final, raw, target, attacker, engine, layer, buffOwnerId: parts[1], action: act }
        const bonus = def.onAfterDealDamage(ctx)
        if (bonus > 0) {
            applyBonusDamage(bonus, target, attacker, engine, actionDef, def.name, def.id)
        }
    }
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
    const cannotBeParried = [...engine.state.pendingBuffs].some(([k]) => {
        const parts = k.split('::')
        if (parts.length < 2 || parts[1] !== attacker.id) return false
        const def = getBuff(parts[0])
        if (!def?.onCanBeParried) return false
        return !def.onCanBeParried({ self: attacker, engine })
    })
    if (cannotBeParried) return { parried: false, final: raw }

    // ── 2. 目标能否招架 ──
    const weapon = target.weaponDef ?? getWeapon(target.build.weapon)
    const hasParryTag = weapon.tags.includes('parry')
    const hasParryBuff = [...engine.state.pendingBuffs].some(([k]) => {
        const parts = k.split('::')
        if (parts.length < 2 || parts[1] !== target.id) return false
        return getBuff(parts[0])?.onCanParry?.({ self: target, engine }) ?? false
    })
    if (!hasParryTag && !hasParryBuff) return { parried: false, final: raw }

    // ── 2. 招架概率 ──
    let pc = calcParryChance(0, target.attrs.get('dexterity'), target.attrs.get('insight'))
    if (target.parryMod) {
        pc = Math.min(0.95, pc + target.parryMod)
    }
    if (act) {
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== target.id) continue
            const def = getBuff(parts[0])
            if (!def?.onParryChance) continue
            const bonus = def.onParryChance({
                final: raw,
                raw,
                target,
                attacker,
                engine,
                buffOwnerId: parts[1],
                layer,
                action: act,
            })
            pc = Math.min(0.95, pc + bonus)
        }
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
    // 防御方 buff onParried 钩子（缩进一层）
    engine.state.log.indentDepth++
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== target.id) continue
        const def = getBuff(parts[0])
        if (!def?.onParried) continue
        def.onParried({
            final: raw,
            raw,
            target,
            attacker,
            engine,
            layer,
            buffOwnerId: parts[1],
            action: act,
        })
    }
    engine.state.log.indentDepth--

    // ── 5. 伤害减免 ──
    let final = calcParriedDamage(raw, target.attrs.get('strength'))
    if (act) {
        // 目标方 buff 修正招架减伤
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== target.id) continue
            const def = getBuff(parts[0])
            if (!def?.onParryReduction) continue
            final = def.onParryReduction({
                final,
                raw,
                target,
                attacker,
                engine,
                buffOwnerId: parts[1],
                layer,
                action: act,
            })
        }
        // 攻击方 buff 修正招架穿透（如玄铁剑·重剑无锋、霸刀）
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== attacker.id) continue
            const def = getBuff(parts[0])
            if (!def?.onParryPenetration) continue
            final = def.onParryPenetration({
                final,
                raw,
                target,
                attacker,
                engine,
                buffOwnerId: parts[1],
                layer,
                action: act,
            })
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
    let bonus = attacker.critChance
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== attacker.id) continue
        if (!act) break
        const def = getBuff(parts[0])
        if (def?.onCritChance)
            bonus += def.onCritChance({
                final: damage,
                raw,
                target,
                attacker,
                engine,
                buffOwnerId: parts[1],
                layer,
                action: act,
            })
    }
    let critChance = calcCritChance(attacker.attrs.get('dexterity'), attacker.attrs.get('insight'), bonus)
    if (act?.onActionCritChance) critChance = act.onActionCritChance(critChance)
    const critRoll = calcRoll(critChance)
    const isCrit = critRoll.success

    let critDmgMod = attacker.critDamageMod
    if (act) {
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== attacker.id) continue
            const def = getBuff(parts[0])
            if (def?.onCritDamage)
                critDmgMod += def.onCritDamage({
                    final: damage,
                    raw,
                    target,
                    attacker,
                    engine,
                    buffOwnerId: parts[1],
                    layer,
                    action: act,
                })
        }
    }
    engine.emitLog({ type: 'check_crit', sourceId: attacker.id, critChance, roll: critRoll.roll, result: isCrit })
    const final = calcFinalDamage(damage, 1, isCrit, critDmgMod)
    return { isCrit, final: Math.round(final * 10) / 10 }
}

// ── 通用伤害修正 ──

/** 遍历双方 buff 的伤害修正钩子，自动修正伤害 */
function applyDamageModifiers(
    final: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    raw: number,
    actionDef?: ActionDefinition,
    bonus = false,
): number {
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2) continue
        if (parts[1] !== target.id && parts[1] !== attacker.id) continue
        const def = getBuff(parts[0])
        const act = actionDef ?? getAction('')
        if (!act) continue
        const ctx = { final, raw, target, attacker, engine, layer, buffOwnerId: parts[1], action: act }
        // 独立追加伤害不触发攻击者的 onDealDamage（防止守宫砂等重复计数）
        if (!bonus && parts[1] === attacker.id && def?.onDealDamage) {
            final = def.onDealDamage(ctx)
        }
        if (parts[1] === target.id && def?.onTakeDamage) {
            final = def.onTakeDamage(ctx)
        }
    }
    return final
}
