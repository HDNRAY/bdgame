import type { Character } from '../entities/character'
import type { ActionDefinition } from '../entities/action'
import type { BattleState } from '../combat/types'
import { getActionRange } from '../entities/action'
import { calcBaseDamage, calcCritChance, calcHitChance, calcParryChance, calcParriedDamage } from '../calc/damage'
import { getBuff } from '../data/buffs'

export interface DamageEstimate {
    actionId: string
    rawDamage: number
    expectedDamage: number
    hitChance: number
    canReach: boolean
    apCost: number
}

/** 计算招式对目标的期望伤害（含全部 buff 钩子） */
export function calcExpectedDamage(
    action: ActionDefinition,
    attacker: Character,
    defender: Character,
    weaponRange: [number, number],
    state: BattleState,
): DamageEstimate {
    const distance = state.position.distance(attacker.id, defender.id)
    const actionRange = getActionRange(action, weaponRange, attacker)
    const canReach = distance >= actionRange[0] && distance <= actionRange[1]

    // 1. 基础伤害
    let rawDamage = 0
    for (const eff of action.effects ?? []) {
        if (eff.type === 'damage' && 'scaling' in eff)
            rawDamage += calcBaseDamage(eff.scaling, attacker.attrs.getAll(), eff.base ?? 0)
        if (eff.type === 'fixed_damage') rawDamage += eff.value ?? 0
        if (eff.type === 'missing_hp_damage') rawDamage += Math.round((defender.maxHp - defender.hp) * eff.ratio)
        if (eff.type === 'self_missing_hp_damage') rawDamage += Math.round((attacker.maxHp - attacker.hp) * eff.ratio)
        if (eff.type === 'functional_damage') {
            rawDamage += eff.fn({
                self: attacker,
                enemy: defender,
                state: { ...state, pendingBuffs: new Map(state.pendingBuffs) },
            })
        }
        if (eff.type === 'add_debuff' && ['burn', 'poison', 'bleed'].includes(eff.buffId)) rawDamage += eff.stacks * 3
    }

    // 2. 单次遍历 buff 收集修正值
    let dodgeMod = defender.dodgeMod
    let hitMod = 0
    let parryMod = defender.parryMod
    let critBonus = attacker.critChance
    let critDmgMod = attacker.critDamageMod
    const estBuffs = new Map(
        [...state.pendingBuffs].map(([k, v]) => [
            k,
            {
                ...v,
                extra: v.extra
                    ? { ...v.extra, slashIds: v.extra.slashIds ? [...(v.extra.slashIds as string[])] : [] }
                    : undefined,
            },
        ]),
    )

    for (const [key, layer] of estBuffs) {
        const p = key.split('::')
        if (p.length < 2) continue
        const def = getBuff(p[0])
        if (!def) continue
        const ctx = { final: 0, raw: 0, target: defender, attacker, state, layer, action }
        if (p[1] === defender.id && def.onDodgeChance) dodgeMod += def.onDodgeChance(ctx)
        if (p[1] === attacker.id && def.onHitChance) hitMod += def.onHitChance(ctx)
        if (p[1] === defender.id && def.onParryChance) parryMod += def.onParryChance(ctx)
        if (p[1] === attacker.id && def.onCritChance) critBonus += def.onCritChance(ctx)
        if (p[1] === attacker.id && def.onCritDamage) critDmgMod += def.onCritDamage(ctx)
    }

    // 3. 命中率
    const baseHc = calcHitChance({
        attackerDexterity: attacker.attrs.get('dexterity'),
        attackerInsight: attacker.attrs.get('insight'),
        defenderAgility: defender.attrs.get('agility'),
        defenderInsight: defender.attrs.get('insight'),
        defenderDodgeMod: dodgeMod,
    })
    const hitChance = (action.onActionHitChance?.(baseHc) ?? baseHc) + hitMod

    // 4. 招架 + 暴击
    const parryChance = calcParryChance(0, defender.attrs.get('dexterity'), defender.attrs.get('insight')) + parryMod
    const rawCrit = calcCritChance(attacker.attrs.get('dexterity'), attacker.attrs.get('insight'), critBonus)
    const critChance = action.onActionCritChance?.(rawCrit) ?? rawCrit

    // 5. 期望伤害 = 命中 × [未招架 + 招架减伤] × 暴击
    let expected =
        hitChance *
        ((1 - parryChance) * rawDamage + parryChance * calcParriedDamage(rawDamage, defender.attrs.get('strength')))
    expected *= 1 + critChance * (0.5 + critDmgMod)

    // 6. onDealDamage 修正（克隆上跑，抽刀断水自动生效）
    for (const [key, layer] of estBuffs) {
        const p = key.split('::')
        if (p.length < 2 || p[1] !== attacker.id) continue
        const def = getBuff(p[0])
        if (!def?.onDealDamage) continue
        expected = def.onDealDamage({
            final: expected,
            raw: rawDamage,
            target: defender,
            attacker,
            state,
            layer,
            action,
        })
    }

    return { actionId: action.id, rawDamage, expectedDamage: expected, hitChance, canReach, apCost: action.apCost }
}
