import type { Character } from '../entities/character'
import type { EffectDef } from '../entities/action'
import { getActionRange } from '../entities/action'
import type { BattleState, ActionCommand } from '../combat/types'
import { getWeapon } from '../data/weapons/weapons'
import { PositionSystem } from '../combat/position'
import { calcSelfDamage } from '../calc/damage'
import { calcExpectedDamage, type DamageEstimate } from './expected-damage'
import { classifyAttackStyle, planMovement, type AttackStyle } from './move-planner'
import { planSupportActions } from './support-planner'
import { checkCondition } from '../entities/action-config'
import { getConditionPreset } from '../data/conditions'

/** AI 决策：返回本行动中要执行的一串指令 */
export function planEvent(self: Character, state: BattleState): ActionCommand[] {
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return []

    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const distance = state.position.distance(self.id, enemy.id)

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
                : basePerAp * (1 + (self.moveEfficiency ?? 0))
            const moveToPickupAp = distToDrop > 1 ? Math.ceil((distToDrop - 1) / perAp) : 0
            if (moveToPickupAp <= apBudget) {
                const cmds: ActionCommand[] = []
                if (moveToPickupAp > 0) {
                    cmds.push({ type: 'move', bestDistance: -(distToDrop - 1) })
                }
                // 找角色的捡武器招式（retrieve_weapon tag）
                const pickupAction = self.actions.find((a) => a.def.tags.includes('retrieve_weapon'))
                if (pickupAction) {
                    cmds.push({ type: 'support', actionId: pickupAction.id })
                }
                return cmds // 先去捡武器，下回合再攻击
            }
            // AP 不够走到掉落点：能走多少走多少
            if (apBudget > 0) {
                return [{ type: 'move', bestDistance: -apBudget }]
            }
        }
        // 无法捡武器（距离太远/AP不够），fall through 到正常 AI
    }

    // ── 1. 候选主招（非 support） ──
    const candidates: DamageEstimate[] = []
    for (const inst of self.actions) {
        if (inst.def.tags.includes('pre_action') || inst.def.tags.includes('post_action')) continue
        if (!inst.canUse()) continue
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        // 检查武器标签兼容性（缴械后 bare_hands 无法使用需要标签的招式）
        if (inst.def.requiredTags.length > 0) {
            const hasTag = inst.def.requiredTags.some((tag) => weapon.tags.includes(tag))
            if (!hasTag) continue
        }
        // 跳过纯位移招式（无伤害效果，如虎跃），近战时不应作为主招
        if (inst.id === 'big_leap') continue
        if (
            !inst.def.effects?.some(
                (e) => e.type === 'damage' || e.type === 'fixed_damage' || e.type === 'functional_damage',
            )
        )
            continue
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
        candidates.push(calcExpectedDamage(inst.def, self, enemy, weapon.range, state))
    }

    // 2. 分两组：有条件限制的按顺序选，默认的按伤害选
    const apBudget = self.ap
    const configOrder = new Map(self.build.actionConfigs?.map((c, i) => [c.actionId, i]))
    const huboKey = `zuoyou_hubo::${self.id}`
    const hasHubo = state.pendingBuffs.has(huboKey)

    // 有条件限制的招式（conditionId !== always）→ 按 configOrder 排序
    const conditionalCands = candidates.filter((c) => {
        const cfg = self.getConfig(c.actionId)
        return cfg?.conditionId && cfg.conditionId !== 'always'
    })
    conditionalCands.sort((a, b) => {
        const oa = configOrder.get(a.actionId) ?? 999
        const ob = configOrder.get(b.actionId) ?? 999
        return oa - ob
    })

    // 默认招式（无 conditionId 或 always）→ 按伤害排序
    const defaultCands = candidates.filter((c) => {
        const cfg = self.getConfig(c.actionId)
        return !cfg?.conditionId || cfg.conditionId === 'always'
    })
    defaultCands.sort((a, b) => {
        const scoreA = calcActionScore(a, hasHubo, apBudget)
        const scoreB = calcActionScore(b, hasHubo, apBudget)
        if (scoreA !== scoreB) return scoreB - scoreA
        const oa = configOrder.get(a.actionId) ?? 999
        const ob = configOrder.get(b.actionId) ?? 999
        if (oa !== ob) return oa - ob
        const effA = a.apCost > 0 ? a.expectedDamage / a.apCost : 0
        const effB = b.apCost > 0 ? b.expectedDamage / b.apCost : 0
        if (effA !== effB) return effB - effA
        return Math.random() - 0.5
    })

    // ── 3. 先选有条件限制的（按顺序），不行再按伤害选 ──
    let mainId: string | null = null
    let moveDelta = 0
    let moveAp = 0
    let dashActionId: string | undefined

    const style: AttackStyle = (self.build.battleStyle as AttackStyle) ?? classifyAttackStyle(weapon.range)

    /** 尝试选中一个候选，返回 true 表示继续遍历，false 表示已选中（mainId 已设）或终止 */
    function trySelect(est: DamageEstimate): boolean {
        if (apBudget < est.apCost) return true
        const mainDef = self.actions.find((a) => a.id === est.actionId)?.def
        if (!mainDef) return true
        const e = enemy!
        if (est.canReach) {
            let planRejected = false
            if (style === 'ranged' || style === 'mid') {
                const actionRange = getActionRange(mainDef, weapon.range, self)
                const idealDist = actionRange[1]
                if (Math.abs(distance - idealDist) >= 0.5) {
                    const minMoveCost = state.pendingBuffs.has(`min_move_cost::${self.id}`)
                    const plan = planMovement(
                        self,
                        e,
                        distance,
                        style,
                        weapon.range,
                        mainDef,
                        apBudget,
                        minMoveCost,
                        self.moveEfficiency,
                    )
                    if (plan && plan.apCost + est.apCost <= apBudget) {
                        mainId = est.actionId
                        moveDelta = plan.delta
                        moveAp = plan.apCost
                        dashActionId = plan.dashActionId
                        return false
                    }
                    planRejected = true
                }
            }
            if (planRejected) {
                if (!mainId) {
                    mainId = est.actionId
                    return false
                }
                return true
            }
            if (!mainId) {
                mainId = est.actionId
                return false
            }
            return true
        }
        // !canReach: 需要移动
        const minMoveCost = state.pendingBuffs.has(`min_move_cost::${self.id}`)
        const plan = planMovement(
            self,
            e,
            distance,
            style,
            weapon.range,
            mainDef,
            apBudget,
            minMoveCost,
            self.moveEfficiency,
        )
        if (plan && plan.apCost + est.apCost <= apBudget) {
            mainId = est.actionId
            moveDelta = plan.delta
            moveAp = plan.apCost
            dashActionId = plan.dashActionId
            return false
        }
        return true
    }

    // 先试条件组（按 configOrder 顺序）
    for (const est of conditionalCands) {
        if (!trySelect(est)) break
    }

    // 条件组没选中，走默认伤害组
    if (!mainId) {
        for (const est of defaultCands) {
            if (!trySelect(est)) break
        }
    }

    if (!mainId) {
        const preCmds = planSupportActions(self, state, apBudget, 'pre_action')
        if (preCmds.length > 0) return preCmds
        const postCmds = planSupportActions(self, state, apBudget, 'post_action')
        if (postCmds.length > 0) return postCmds
        // P5: 所有招式都出不了，尽量向理想距离移动
        const minMoveCost = state.pendingBuffs.has(`min_move_cost::${self.id}`)
        const basePerAp = PositionSystem.apToRange(self.attrs.get('agility'))
        const perAp = minMoveCost ? 2 : basePerAp * (1 + self.moveEfficiency)
        const bestDist = -(apBudget * perAp)
        return [{ type: 'move', bestDistance: bestDist }]
    }

    // 验证 mainId 对应招式存在（pickup_weapon 可能不在所有角色 action list 中）
    const mainInst = self.actions.find((a) => a.id === mainId)
    if (!mainInst) {
        return []
    }
    const mainDef2 = mainInst.def

    // ── 4. 辅助招式（前摇 → 主招 → 收招） ──
    const mainApUsed = moveAp + mainDef2.apCost
    const preCmds = planSupportActions(self, state, apBudget - mainApUsed, 'pre_action')
    const preId = preCmds[0]?.actionId
    const preAp = preId ? (self.actions.find((a) => a.id === preId)?.apCost ?? 0) : 0
    const postCmds = planSupportActions(
        self,
        state,
        apBudget - mainApUsed - preAp,
        'post_action',
        preId ? [preId] : undefined,
    )

    // ── 5. 组装命令 ──
    const cmds: ActionCommand[] = [...preCmds]

    if (dashActionId) {
        // 位移招式有 support 标签的用 support 指令（跳过战斗判定）
        const dashInst = self.actions.find((a) => a.id === dashActionId)
        if (dashInst?.def.tags.includes('pre_action') || dashInst?.def.tags.includes('post_action')) {
            cmds.push({ type: 'support', actionId: dashActionId })
        } else {
            cmds.push({ type: 'attack', actionId: dashActionId })
        }
        // dash 已处理位移，moveDelta 归零避免重复移动
        moveDelta = 0
        moveAp = 0
    } else if (moveDelta !== 0) {
        cmds.push({ type: 'move', bestDistance: moveDelta > 0 ? moveAp : -moveAp })
    }
    cmds.push({ type: 'attack', actionId: mainId })
    // post-support 放在攻击后
    cmds.push(...postCmds)

    // ── 6. 左右互搏 ──
    if (state.pendingBuffs.has(`zuoyou_hubo::${self.id}`) && weapon.tags.includes('dual_wield')) {
        const spent =
            moveAp +
            mainDef2.apCost +
            preCmds.reduce((s, c) => {
                const inst = self.actions.find((a) => a.id === c.actionId)
                return s + (inst?.apCost ?? 0)
            }, 0) +
            postCmds.reduce((s, c) => {
                const inst = self.actions.find((a) => a.id === c.actionId)
                return s + (inst?.apCost ?? 0)
            }, 0)
        const remaining = apBudget - spent
        if (remaining >= 1) {
            const second = pickBestSecondary(self, state, remaining)
            if (second) cmds.push({ type: 'attack', actionId: second })
        }
    }

    // ── 7. 行动后走位（只在招式射程外才走） ──
    const mainActionRange = getActionRange(mainDef2, weapon.range, self)
    if (enemy) {
        const basePerAp = PositionSystem.apToRange(self.attrs.get('agility'))
        const perAp = state.pendingBuffs.has(`min_move_cost::${self.id}`)
            ? 2
            : basePerAp * (1 + (self.moveEfficiency ?? 0))
        // 估算行动后的实际距离
        const preMoveDist = state.position.distance(self.id, enemy.id)
        const postMoveDist = moveDelta !== 0 ? preMoveDist + perAp * moveAp * (moveDelta > 0 ? 1 : -1) : preMoveDist
        // 已在招式射程内 → 不动
        if (postMoveDist >= mainActionRange[0] && postMoveDist <= mainActionRange[1]) {
            // 不操作
        } else if (postMoveDist < mainActionRange[0]) {
            // 太近 → 退到 range[0]
            const targetDist = mainActionRange[0]
            const rawAp = Math.ceil((targetDist - postMoveDist) / perAp)
            // 防 overshoot：试从 rawAp 往下找，确保最终距离 ≥ range[0]
            let apUsed = 0
            for (let a = rawAp; a >= 1; a--) {
                const finalDist = postMoveDist + perAp * a
                if (finalDist >= mainActionRange[0]) {
                    apUsed = a
                    break
                }
            }
            const existingCost = cmds.reduce((sum, c) => {
                if (c.type === 'move') return sum + Math.abs(c.bestDistance ?? 0)
                if (c.actionId) {
                    const inst = self.actions.find((a) => a.id === c.actionId)
                    return sum + (inst?.apCost ?? 0)
                }
                return sum
            }, 0)
            if (apUsed > 0 && existingCost + apUsed <= apBudget) {
                cmds.push({ type: 'move', bestDistance: apUsed })
            }
        } else {
            // 太远 → 进到 range[1]
            const targetDist = mainActionRange[1]
            const rawAp = Math.ceil((postMoveDist - targetDist) / perAp)
            let apUsed = 0
            for (let a = rawAp; a >= 1; a--) {
                const finalDist = postMoveDist - perAp * a
                if (finalDist <= mainActionRange[1]) {
                    apUsed = a
                    break
                }
            }
            const existingCost = cmds.reduce((sum, c) => {
                if (c.type === 'move') return sum + Math.abs(c.bestDistance ?? 0)
                if (c.actionId) {
                    const inst = self.actions.find((a) => a.id === c.actionId)
                    return sum + (inst?.apCost ?? 0)
                }
                return sum
            }, 0)
            if (apUsed > 0 && existingCost + apUsed <= apBudget) {
                cmds.push({ type: 'move', bestDistance: -apUsed })
            }
        }
    }

    return cmds
}

/** 计算招式评分 */
function calcActionScore(est: DamageEstimate, hasHubo: boolean, apBudget: number): number {
    let score = est.expectedDamage
    // 左右互搏：能用两次的招式按双倍总伤害比较
    if (hasHubo && est.apCost > 0 && est.apCost <= apBudget / 2) {
        score *= 2
    }
    return score
}

function pickBestSecondary(self: Character, state: BattleState, apRemaining: number): string | null {
    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return null
    const sorted = [...self.actions].filter((a) => {
        if (a.def.tags.includes('pre_action') || a.def.tags.includes('post_action')) return false
        if (!a.canUse()) return false
        if (a.id === 'big_leap') return false
        if (
            !a.def.effects?.some(
                (e) => e.type === 'damage' || e.type === 'fixed_damage' || e.type === 'functional_damage',
            )
        )
            return false
        if (a.def.requiredTags.length > 0) {
            const hasTag = a.def.requiredTags.some((tag) => weapon.tags.includes(tag))
            if (!hasTag) return false
        }
        return true
    })
    // 按 AP 效率排序（伤害/AP），选性价比最高的
    const scored = sorted.map((inst) => {
        const est = calcExpectedDamage(inst.def, self, enemy, weapon.range, state)
        return { inst, score: est.apCost > 0 ? est.expectedDamage / est.apCost : 0, apCost: est.apCost }
    })
    scored.sort((a, b) => {
        if (Math.abs(a.score - b.score) > 0.5) return b.score - a.score
        return b.apCost - a.apCost // 效率相近选消耗高的
    })
    for (const { inst, apCost } of scored) {
        if (apCost > apRemaining) continue
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        return inst.id
    }
    return null
}
