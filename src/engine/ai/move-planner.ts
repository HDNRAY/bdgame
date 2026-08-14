import type { Character } from '../entities/character'
import type { ActionDefinition, EffectDef } from '../entities/action'
import { getActionRange } from '../../data/actions'
import { PositionSystem } from '../combat/position'
import type { BattleState } from '../combat/types'

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
    defender: Character,
    distance: number,
    style: AttackStyle,
    weaponRange: [number, number],
    chosenAction: ActionDefinition,
    apRemaining: number,
    minMoveCost = false,
    moveEfficiency = 0,
    state?: BattleState,
): MovePlan | null {
    const actionRange = getActionRange(chosenAction, weaponRange, attacker) // short_dash 已计入有效射程，fallback 中不用重复减 freeApproach（chosenAction 由调用方保证已是运行时版本）
    const basePerAp = PositionSystem.apToRange(attacker.attrs.get('agility'))
    const perAp = minMoveCost ? 2 : basePerAp * (1 + moveEfficiency)
    // 主招减免后成本（身法/急速）
    const chosenCost = attacker.actionApCost(chosenAction.apCost)

    // 目标距离：由攻击风格和对手决定
    const targetDist: number = (() => {
        if (style === 'ranged') return actionRange[1]
        if (style === 'mid') {
            const enemyStyle: AttackStyle =
                (defender.build.battleStyle as AttackStyle) ?? classifyAttackStyle(defender.weaponDef?.range ?? [0, 2])
            if (enemyStyle === 'melee') return actionRange[1] // 对手近战 → 风筝
            if (enemyStyle === 'ranged') return actionRange[0] // 对手远程 → 贴脸
            // 对手也是 mid → 比较武器射程：射程更长的风筝，更短的贴脸
            const myMax = weaponRange[1]
            const enemyMax = defender.weaponDef?.range?.[1] ?? 0
            return myMax >= enemyMax ? actionRange[1] : actionRange[0]
        }
        return actionRange[0] // 近战风格：尽可能贴脸
    })()

    const delta = targetDist - distance
    // 已在射程内且距理想距离足够近 → 不移动。
    // 关键：出射程时即使 |delta|<0.5 也必须走回，否则 AI 以为"够得着"而实际
    // canExecuteAction 的距离判定会失败（如 5.28m > 铁莲子 max 5m），导致整回合空转。
    if (distance >= actionRange[0] && distance <= actionRange[1] && Math.abs(delta) < 0.5) {
        return { delta: 0, apCost: 0 }
    }

    const distAbs = Math.abs(delta)
    // 移动所需 AP：支持1位小数（0.1 AP 步进），向上取整保证至少到达目标距离
    const moveAp = PositionSystem.moveApFor(distAbs, perAp)

    // 检查是否有更省 AP 的位移招式，在走路检查之前
    {
        for (const inst of attacker.actions) {
            const dashEff = inst.def.effects?.find((e): e is Extract<EffectDef, { type: 'dash' }> => e.type === 'dash')
            if (!dashEff) continue
            // 缠劲不足的位移招式不纳入规划
            if (inst.def.chanCost && attacker.chan < inst.def.chanCost) continue
            const { minRange = 0, maxRange = Infinity, targetDist: rawDashTarget } = dashEff
            const dashTarget = rawDashTarget < 0 ? attacker.getMaxActionRange(state) : rawDashTarget
            if (dashTarget < 0) continue
            // maxRange = 最大位移距离：期望位移被 maxRange 截断（可能落不到 dashTarget）
            const desiredTravel = distance - dashTarget
            const travel = Math.sign(desiredTravel) * Math.min(Math.abs(desiredTravel), maxRange)
            // 期望位移不足最小要求 → 该位移招不适用
            if (Math.abs(desiredTravel) < minRange || travel === 0) continue
            const dashLandDist = distance - travel
            // dash 后实际距离，检查是否比走路更接近 targetDist
            const walkAfter = distance + Math.sign(delta) * moveAp * perAp
            const walkDist = Math.abs(walkAfter - targetDist)
            const dashDist = Math.abs(dashLandDist - targetDist)
            // dash 落点必须在主招射程内，否则 dash 后无法出招（planEvent 见 dash 会归零 moveDelta，
            // 无法补偿额外移动）。射程外 → 拒绝该位移招，让 AI 改用能配合的招式。
            if (dashLandDist < actionRange[0] - 0.001 || dashLandDist > actionRange[1] + 0.001) continue
            const dashMoveDist = Math.abs(travel)
            const dashApCost = dashEff.useAp
                ? Math.max(1, Math.round(dashMoveDist * 0.4 * 10) / 10)
                : attacker.actionApCost(inst.apCost)
            // 走路落点不比 dash 差 且 走路不更贵（≤ dash+0.5AP）→ 跳过 dash。
            // 若 dash 明显更省 AP（省 >0.5），即使落点相同/略差也应采用，
            // 否则省一大截 AP 的位移招（如虎跃）会因落点不如走路精确而永远被跳过。
            if (dashDist >= walkDist && moveAp <= dashApCost + 0.5) continue
            const walkingCost = moveAp + chosenCost
            const totalAp = dashApCost + chosenCost
            if (totalAp <= apRemaining && (walkingCost > apRemaining || totalAp <= walkingCost)) {
                return { delta, apCost: dashApCost, dashActionId: inst.id }
            }
        }
    }

    // 检查 overshoot：实际位移 moveAp×perAp 可能超出目标距离（低于最小或高于最大射程）
    if (moveAp > 0) {
        const postMoveDist = distance + (delta > 0 ? 1 : -1) * moveAp * perAp
        if (postMoveDist < actionRange[0] || postMoveDist > actionRange[1]) {
            // 走太多会超出射程，试试少用几档 AP（0.1 步进）能否落在范围内
            for (
                let altAp = Math.max(0.1, Math.round((moveAp - 0.1) * 10) / 10);
                altAp >= 0.1;
                altAp = Math.round((altAp - 0.1) * 10) / 10
            ) {
                const altPost = distance + (delta > 0 ? 1 : -1) * altAp * perAp
                if (altPost >= actionRange[0] && altPost <= actionRange[1] && altAp + chosenCost <= apRemaining) {
                    return { delta: Math.round((delta > 0 ? altAp : -altAp) * 10) / 10, apCost: altAp }
                }
            }
        }
    }

    if (moveAp + chosenCost > apRemaining) {
        // 理想距离走不到：在招式范围内找最近的可达距离（0.1m 分辨率）
        if (delta < 0) {
            // 需要靠近：从当前距离往 actionRange[0] 找（只试范围内距离）
            for (
                let d = Math.min(Math.round(distance * 10) / 10 - 0.1, actionRange[1]);
                d >= actionRange[0];
                d = Math.round((d - 0.1) * 10) / 10
            ) {
                const altDelta = d - distance
                const altMoveAp = PositionSystem.moveApFor(Math.abs(altDelta), perAp)
                if (altMoveAp + chosenCost <= apRemaining) {
                    return { delta: Math.round((altDelta > 0 ? altMoveAp : -altMoveAp) * 10) / 10, apCost: altMoveAp }
                }
            }
        } else {
            // 需要远离（风筝）：从远到近找可达距离，尽量拉满风筝距离（最大化与对手间隔）
            for (
                let d = actionRange[1];
                d >= Math.max(Math.round(distance * 10) / 10 + 0.1, actionRange[0]);
                d = Math.round((d - 0.1) * 10) / 10
            ) {
                const altDelta = d - distance
                const altMoveAp = PositionSystem.moveApFor(Math.abs(altDelta), perAp)
                if (altMoveAp + chosenCost <= apRemaining) {
                    return { delta: Math.round((altDelta > 0 ? altMoveAp : -altMoveAp) * 10) / 10, apCost: altMoveAp }
                }
            }
        }
        // 还是不够：能走多少走多少，下回合再打（1位小数）
        if (apRemaining > 0) {
            const effAp = Math.round(apRemaining * 10) / 10
            return { delta: Math.round((delta < 0 ? -effAp : effAp) * 10) / 10, apCost: effAp }
        }
        return null
    }

    return { delta: Math.round((delta > 0 ? moveAp : -moveAp) * 10) / 10, apCost: moveAp }
}
