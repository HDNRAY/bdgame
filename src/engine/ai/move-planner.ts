import type { Character } from '../entities/character'
import type { ActionDefinition, EffectDef } from '../entities/action'
import { PositionSystem } from '../combat/position'

export type AttackStyle = 'melee' | 'mid' | 'ranged'

/** 根据武器射程判断战斗风格（纯武器判断，不考虑具体招式） */
export function classifyAttackStyle(weaponRange: [number, number]): AttackStyle {
    const maxRange = weaponRange[1]
    if (maxRange >= 6) return 'ranged'
    if (maxRange >= 4) return 'mid'
    return 'melee'
}

export interface MovePlan {
    /** 位移量（正=远离，负=靠近） */
    delta: number
    /** 需要消耗的 AP */
    apCost: number
    /** 如果用位移招式代替走路（如虎跃），招式 ID */
    dashActionId?: string
}

/** 规划移动：进入目标招式的攻击范围 */
export function planMovement(
    attacker: Character,
    _defender: Character,
    distance: number,
    style: AttackStyle,
    weaponRange: [number, number],
    chosenAction: ActionDefinition,
    apRemaining: number,
    minMoveCost = false,
    moveEfficiency = 0,
): MovePlan | null {
    const actionRange = chosenAction.getRange?.(weaponRange, attacker) ?? weaponRange
    const basePerAp = PositionSystem.apToRange(attacker.attrs.get('agility'))
    const perAp = minMoveCost ? 2 : basePerAp * (1 + moveEfficiency)

    // 目标距离：由攻击风格和招式射程决定
    const targetDist: number = (() => {
        if (style === 'ranged' || style === 'mid') return actionRange[1]
        return actionRange[0] // 近战风格：尽可能贴脸
    })()

    const delta = targetDist - distance
    if (Math.abs(delta) < 0.5) return { delta: 0, apCost: 0 } // 已在范围内

    const distAbs = Math.abs(delta)
    const moveAp = Math.ceil(distAbs / perAp)

    // 检查是否有更省 AP 的位移招式（朝敌人方向移动时），在走路检查之前
    if (delta < 0) {
        for (const inst of attacker.actions) {
            const dashEff = inst.def.effects?.find((e): e is Extract<EffectDef, { type: 'dash' }> => e.type === 'dash')
            if (!dashEff) continue
            if (dashEff.useAp) continue
            const { minRange = 0, maxRange = Infinity, targetDist: dashTarget } = dashEff
            if (distance < minRange || distance > maxRange) continue
            // dash 后距离变为 dashTarget，如果已在武器范围内则无需再走路
            const afterDash = Math.abs(dashTarget - targetDist)
            const needsExtraMove = afterDash >= 0.5 && (dashTarget < actionRange[0] || dashTarget > actionRange[1])
            const extraMove = needsExtraMove ? Math.ceil(afterDash / perAp) : 0
            const totalAp = inst.apCost + extraMove + chosenAction.apCost
            const walkingCost = moveAp + chosenAction.apCost
            if (totalAp <= apRemaining && totalAp <= walkingCost) {
                return { delta, apCost: inst.apCost, dashActionId: inst.id }
            }
        }
    }

    // 检查 overshoot：实际位移 moveAp×perAp 可能超出目标距离
    if (moveAp > 0) {
        const postMoveDist = distance + (delta > 0 ? 1 : -1) * moveAp * perAp
        if (postMoveDist < actionRange[0]) {
            // 走太多会低于最小射程，试试少用几格 AP 能否落在范围内
            for (let altAp = moveAp - 1; altAp >= 0; altAp--) {
                const altPost = distance + (delta > 0 ? 1 : -1) * altAp * perAp
                if (altPost >= actionRange[0] && altPost <= actionRange[1]) {
                    return { delta: delta > 0 ? altAp : -altAp, apCost: altAp }
                }
            }
        }
    }

    if (moveAp + chosenAction.apCost > apRemaining) {
        // 理想距离走不到：在招式范围内找最近的可达距离
        if (delta < 0) {
            // 需要靠近：从当前距离往 actionRange[0] 找（只试范围内距离）
            for (let d = Math.min(Math.ceil(distance) - 1, actionRange[1]); d >= actionRange[0]; d--) {
                const altDelta = d - distance
                const altMoveAp = Math.ceil(Math.abs(altDelta) / perAp)
                if (altMoveAp + chosenAction.apCost <= apRemaining) {
                    return { delta: altDelta > 0 ? altMoveAp : -altMoveAp, apCost: altMoveAp }
                }
            }
        } else {
            // 需要远离：从当前距离往 actionRange[1] 找（只试范围内距离）
            for (let d = Math.max(Math.ceil(distance) + 1, actionRange[0]); d <= actionRange[1]; d++) {
                const altDelta = d - distance
                const altMoveAp = Math.ceil(Math.abs(altDelta) / perAp)
                if (altMoveAp + chosenAction.apCost <= apRemaining) {
                    return { delta: altDelta > 0 ? altMoveAp : -altMoveAp, apCost: altMoveAp }
                }
            }
        }
        // 还是不够：能走多少走多少，下回合再打
        if (delta < 0 && apRemaining > 0) {
            return { delta: -apRemaining, apCost: apRemaining }
        }
        return null
    }

    return { delta: delta > 0 ? moveAp : -moveAp, apCost: moveAp }
}
