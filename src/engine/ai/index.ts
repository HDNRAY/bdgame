import type { Character } from '../entities/character'
import type { EffectDef } from '../entities/action'
import { calcExtraMoveEfficiency } from '../combat/utils'
import type { BattleState, ActionCommand } from '../combat/types'
import { PositionSystem } from '../combat/position'
import { calcSelfDamage } from '../calc/damage'
import { calcExpectedDamage, type DamageEstimate } from './expected-damage'
import { generatePlans, bestPlan, type AttackStyle } from './planner'
import { planSupportActions } from './support-planner'
import { checkCondition } from '../../game/entities/action-config'
import { getConditionPreset } from '../../data/conditions'

/** AI 决策：返回本行动中要执行的一串指令 */
export function planEvent(self: Character, state: BattleState): ActionCommand[] {
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return []

    // 拾起兵器（0AP）：若本回合捡到武器，记录指令与移动 AP，待 preCmds 定义后合并（同回合继续攻击）
    let pickupCmdsOuter: ActionCommand[] = []
    let pickupMoveAp = 0

    // ── 0. 缴械优先：先捡武器再考虑攻击 ──
    const disarmedKey = `disarmed::${self.id}`
    const disarmedLayer = state.pendingBuffs.get(disarmedKey)
    if (disarmedLayer) {
        const apBudget = self.ap
        const dropPos = disarmedLayer.extra?.dropPosition as number | undefined
        // 捡武器前检查条件（如"敌人HP>10"才捡）
        let shouldPickup = true
        if (dropPos !== undefined) {
            const pickupAction = self.actions.find((a) => a.def.tags.includes('retrieve_weapon'))
            if (pickupAction) {
                const pickupConfig = self.getConfig(pickupAction.id)
                if (pickupConfig?.conditionId) {
                    const cond = getConditionPreset(pickupConfig.conditionId)
                    if (cond && !checkCondition(cond, self, state)) shouldPickup = false
                }
            }
        }
        if (shouldPickup && dropPos !== undefined) {
            const distToDrop = Math.abs(state.position.get(self.id) - dropPos)
            const basePerAp = PositionSystem.apToRange(self.attrs.get('agility'))
            const perAp = state.pendingBuffs.has(`min_move_cost::${self.id}`)
                ? 2
                : basePerAp * (1 + calcExtraMoveEfficiency(state, self))
            const moveToPickupAp = distToDrop > 1 ? PositionSystem.moveApFor(distToDrop - 1, perAp) : 0
            if (moveToPickupAp <= apBudget) {
                // 拾起兵器（0AP）后不提前 return——同回合继续正常 AI（移动+攻击都做完）
                const pickupCmds: ActionCommand[] = []
                if (moveToPickupAp > 0) {
                    pickupCmds.push({ type: 'move', bestDistance: -moveToPickupAp })
                }
                // 找角色的捡武器招式（retrieve_weapon tag）
                const pickupAction = self.actions.find((a) => a.def.tags.includes('retrieve_weapon'))
                if (pickupAction) {
                    pickupCmds.push({ type: 'support', actionId: pickupAction.id })
                }
                // 存到外层变量，等 preCmds 定义后合并（捡完武器后同回合继续攻击）
                pickupCmdsOuter = pickupCmds
                pickupMoveAp = moveToPickupAp
            } else if (apBudget > 0) {
                // AP 不够走到掉落点：能走多少走多少
                return [{ type: 'move', bestDistance: -apBudget }]
            }
        }
        // 无法捡武器（距离太远/AP不够），fall through 到正常 AI
    }

    // ── 1. 候选主招（非 support） ──
    // 武器射程/tags 在一次 planEvent 内不变，取一次复用（缴械/换武器是效果层事件，不在候选循环内发生）
    const effRange = self.getEffectiveRange()
    const weaponTags = self.getWeaponTags()
    const candidates: DamageEstimate[] = []
    for (const inst of self.actions) {
        if (
            inst.def.tags.includes('pre_action') ||
            inst.def.tags.includes('post_action') ||
            inst.def.tags.includes('internal')
        )
            continue
        if (!inst.canUse()) continue
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        // 检查武器标签兼容性（缴械后 bare_hands 无法使用需要标签的招式；双持时任一武器满足即可）
        if (inst.def.requiredTags.length > 0) {
            const hasTag = inst.def.requiredTags.some((tag) => weaponTags.includes(tag))
            if (!hasTag) continue
        }
        // 检查资源消耗（缠劲等），距离/AP 由后续 trySelect 处理
        if (inst.def.chanCost && self.chan < inst.def.chanCost) continue
        const selfDmgEff = inst.def.effects?.find(
            (e): e is Extract<EffectDef, { type: 'self_damage' }> => e.type === 'self_damage',
        )
        if (selfDmgEff) {
            const dmg = calcSelfDamage(self.maxHp, selfDmgEff.ratio)
            if (self.hp <= dmg) continue
        }
        // 必要条件过滤
        const config = self.getConfig(inst.id)
        if (config?.conditionId) {
            const cond = getConditionPreset(config.conditionId)
            if (cond && !checkCondition(cond, self, state)) continue
        }
        candidates.push(calcExpectedDamage(inst.def, self, enemy, effRange, state))
    }

    // 1.5. 前摇辅助（buff/饮酒等）优先预留 AP，先于主招与移动执行
    const preCmds = planSupportActions(self, state, self.ap, 'pre_action')
    const preAp = preCmds.reduce(
        (s, c) => s + self.actionApCost(self.actions.find((a) => a.id === c.actionId)?.apCost ?? 0, state),
        0,
    )
    // 拾起兵器（0AP）并入前摇指令开头（先捡武器，再执行其他前摇/主招/移动）
    if (pickupCmdsOuter.length > 0) {
        preCmds.unshift(...pickupCmdsOuter)
    }

    // 2. 用回合计划生成器：枚举移动落点 × 招式序列，选伤害/AP 效率最优的完整回合计划
    const apBudget = self.ap - preAp - pickupMoveAp
    // 招式实例预处理成 id → 实例 Map（避免每个候选线性 find）
    const actionById = new Map(self.actions.map((a) => [a.id, a] as const))
    const candDefs = candidates.map((c) => actionById.get(c.actionId)?.def).filter((d): d is NonNullable<typeof d> => !!d)
    // candidates 已按当前距离评估过 → 传给 generatePlans 复用（pool 构建不再重复评估）
    const precomputed = new Map(candidates.map((c) => [c.actionId, c] as const))
    const plans = generatePlans(self, state, candDefs, apBudget, precomputed)
    const best = bestPlan(plans)
    if (!best) {
        // 没有可行攻击计划：朝风格理想距离移动（clinch/melee 贴脸靠近、ranged/mid 风筝远离），
        // clamp 到理想距离不过冲——贴脸时不再无效靠近（move[-] 原地空转）、风筝时不再盲目冲
        const style: AttackStyle = self.battleStyle
        const effRange = self.getEffectiveRange()
        const goal = style === 'clinch' || style === 'melee' ? effRange[0] : effRange[1]
        const dist = enemy ? state.position.distance(self.id, enemy.id) : 4
        const perAp = PositionSystem.apToRange(self.attrs.get('agility')) * (1 + calcExtraMoveEfficiency(state, self))
        const moveM = Math.min(perAp * Math.max(0, apBudget), Math.abs(dist - goal))
        const moveAp = moveM > 0 ? PositionSystem.moveApFor(moveM, perAp) : 0
        const fallbackMove: ActionCommand[] =
            moveAp > 0 ? [{ type: 'move', bestDistance: (dist > goal ? -1 : 1) * moveAp }] : []
        if (preCmds.length > 0) return [...preCmds, ...fallbackMove]
        return fallbackMove
    }
    // 计划已含招式+移动；前摇并入开头
    const cmds: ActionCommand[] = [...preCmds, ...best.cmds]

    // 3. 收招辅助（计划招式后执行；前摇辅助已在上方预留）
    const planAp = best.totalAp
    const postCmds = planSupportActions(
        self,
        state,
        Math.max(0, apBudget - planAp),
        'post_action',
        preCmds.map((c) => c.actionId).filter((x): x is string => !!x),
    )
    cmds.push(...postCmds)
    return cmds
}
