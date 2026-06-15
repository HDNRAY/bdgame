import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { ActionDefinition } from '../../entities/action'
import type { AttrName } from '../../entities/attributes'
import { calcCritChance, calcFinalDamage, calcParriedDamage, calcParryChance, calcRoll } from '../../calc/damage'
import { getWeapon } from '../../data/weapons'
import { getBuff } from '../../data/buffs'
import { getAction } from '../../data/actions'
import type { BuffLayer } from '../types'
import { consumeBuffsByTrigger } from '../utils'

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
    const { parried, final: afterParry } = resolveParry(raw, target, attacker, engine, act)
    const blocked = raw - afterParry
    const { isCrit, final: afterCrit } = resolveCrit(afterParry, raw, target, attacker, engine, act)
    const final = applyDamageModifiers(afterCrit, target, attacker, engine, raw, actionDef)

    target.takeDamage(final)

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
    // ── 1. 能否招架 ──
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

    // ── 5. 伤害减免 ──
    let final = calcParriedDamage(raw, target.attrs.get('strength'))
    if (act) {
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
    const critChance = calcCritChance(attacker.attrs.get('dexterity'), attacker.attrs.get('insight'), bonus)
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

/** 遍历双方 buff 的 onDamage 钩子，自动修正伤害 */
function applyDamageModifiers(
    final: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    raw: number,
    actionDef?: ActionDefinition,
): number {
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2) continue
        if (parts[1] !== target.id && parts[1] !== attacker.id) continue
        const def = getBuff(parts[0])
        const act = actionDef ?? getAction('')
        if (!act || !def?.onDamage) continue
        final = def.onDamage({ final, raw, target, attacker, engine, layer, buffOwnerId: parts[1], action: act })
    }
    return final
}
