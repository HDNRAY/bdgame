import type { Character } from '../entities/character'
import type { EffectDef } from '../entities/action'
import { getActionRange, getRuntimeAction } from '../../data/actions'
import type { BattleState, ActionCommand } from '../combat/types'
import { getWeapon } from '../../data/weapons/weapons'
import { forEachBuffOf } from '../combat/utils'
import { PositionSystem } from '../combat/position'
import { calcSelfDamage } from '../calc/damage'
import { calcExpectedDamage, type DamageEstimate } from './expected-damage'
import { classifyAttackStyle, planMovement, type AttackStyle } from './move-planner'
import { planSupportActions } from './support-planner'
import { checkCondition } from '../../game/entities/action-config'
import { getConditionPreset } from '../../data/conditions'
import { getAction as getBaseAction } from '../../data/actions'

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
            const moveToPickupAp = distToDrop > 1 ? PositionSystem.moveApFor(distToDrop - 1, perAp) : 0
            if (moveToPickupAp <= apBudget) {
                const cmds: ActionCommand[] = []
                if (moveToPickupAp > 0) {
                    cmds.push({ type: 'move', bestDistance: -moveToPickupAp })
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
        if (
            inst.def.tags.includes('pre_action') ||
            inst.def.tags.includes('post_action') ||
            inst.def.tags.includes('internal')
        )
            continue
        if (!inst.canUse()) continue
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        // 检查武器标签兼容性（缴械后 bare_hands 无法使用需要标签的招式）
        if (inst.def.requiredTags.length > 0) {
            const hasTag = inst.def.requiredTags.some((tag) => weapon.tags.includes(tag))
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
        candidates.push(calcExpectedDamage(inst.def, self, enemy, weapon.range, state))
    }

    // 1.5. 前摇辅助（buff/饮酒等）优先预留 AP，先于主招与移动执行
    const preCmds = planSupportActions(self, state, self.ap, 'pre_action')
    const preAp = preCmds.reduce(
        (s, c) => s + self.actionApCost(self.actions.find((a) => a.id === c.actionId)?.apCost ?? 0),
        0,
    )

    // 2. 分两组：有条件限制的按顺序选，默认的按计划总伤害选
    const apBudget = self.ap - preAp
    const configOrder = new Map(self.build.actionConfigs?.map((c, i) => [c.actionId, i]))
    const style: AttackStyle = self.battleStyle

    // 有条件限制的招式（有 conditionId）→ 按 configOrder 排序
    const conditionalCands = candidates.filter((c) => {
        const cfg = self.getConfig(c.actionId)
        return cfg?.conditionId !== undefined
    })
    conditionalCands.sort((a, b) => {
        const oa = configOrder.get(a.actionId) ?? 999
        const ob = configOrder.get(b.actionId) ?? 999
        return oa - ob
    })

    // 默认招式（无 conditionId）→ 按计划总伤害排序
    const defaultCands = candidates.filter((c) => {
        const cfg = self.getConfig(c.actionId)
        return cfg?.conditionId === undefined
    })
    defaultCands.sort((a, b) => {
        const scoreA = estimatePlan(a.actionId, self, state, apBudget, style)
        const scoreB = estimatePlan(b.actionId, self, state, apBudget, style)
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
        if (preCmds.length > 0) return preCmds
        const postCmds = planSupportActions(self, state, apBudget, 'post_action')
        if (postCmds.length > 0) return postCmds
        // P5: 所有招式都出不了，尽量向理想距离移动（bestDistance 语义 = AP，1位小数）
        return [{ type: 'move', bestDistance: -Math.round(apBudget * 10) / 10 }]
    }

    // 验证 mainId 对应招式存在（pickup_weapon 可能不在所有角色 action list 中）
    const mainInst = self.actions.find((a) => a.id === mainId)
    if (!mainInst) {
        return []
    }
    const mainDef2 = mainInst.def

    // ── 4. 收招辅助（主招之后执行；前摇辅助已在上方预留） ──
    const mainApUsed = moveAp + self.actionApCost(mainDef2.apCost)
    const postCmds = planSupportActions(
        self,
        state,
        apBudget - mainApUsed,
        'post_action',
        preCmds.map((c) => c.actionId).filter((x): x is string => !!x),
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

    // ── 6. 通用额外攻击（遍历 buff 调 getExtraAttack） ──
    let extraTotal = 0
    forEachBuffOf(state.pendingBuffs, self.id, (def) => {
        if (!def?.getExtraAttack) return
        extraTotal += def.getExtraAttack({ source: mainDef2 })
    })
    if (extraTotal > 0) {
        let spentExtra =
            moveAp +
            self.actionApCost(mainDef2.apCost) +
            preCmds.reduce((s, c) => {
                const inst = self.actions.find((a) => a.id === c.actionId)
                return s + (inst ? self.actionApCost(inst.apCost) : 0)
            }, 0) +
            postCmds.reduce((s, c) => {
                const inst = self.actions.find((a) => a.id === c.actionId)
                return s + (inst ? self.actionApCost(inst.apCost) : 0)
            }, 0)
        for (let i = 0; i < extraTotal; i++) {
            const remaining = apBudget - spentExtra
            if (remaining < 1) break
            const second = pickBestSecondary(self, state, remaining)
            if (!second) break
            cmds.push({ type: 'attack', actionId: second })
            const inst = self.actions.find((a) => a.id === second)
            if (inst) spentExtra += self.actionApCost(inst.def.apCost)
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

        // 远程/中程风筝：已在射程内但没到最远 → 用剩余 AP 尽量移到最远（与 planMovement 的目标距离一致）
        if ((style === 'ranged' || style === 'mid') && postMoveDist >= mainActionRange[0]) {
            const enemyStyle: AttackStyle =
                (enemy.build.battleStyle as AttackStyle) ?? classifyAttackStyle(enemy.weaponDef?.range ?? [0, 2])
            const kiteToMax =
                style === 'ranged' ||
                enemyStyle === 'melee' ||
                (enemyStyle === 'mid' && weapon.range[1] >= (enemy.weaponDef?.range?.[1] ?? 0))
            if (kiteToMax && postMoveDist < mainActionRange[1] - 0.5) {
                // 1位小数：从大到小试 AP 档（0.1 步进），取能落在射程内的最大档
                const rawAp = PositionSystem.moveApFor(mainActionRange[1] - postMoveDist, perAp)
                let apUsed = 0
                for (let a = rawAp; a >= 0.1; a = Math.round((a - 0.1) * 10) / 10) {
                    const finalDist = postMoveDist + perAp * a
                    if (finalDist <= mainActionRange[1] + 0.01) {
                        apUsed = a
                        break
                    }
                }
                const existingCost = cmds.reduce((sum, c) => {
                    if (c.type === 'move') return sum + Math.abs(c.bestDistance ?? 0)
                    if (c.actionId) {
                        const inst = self.actions.find((a) => a.id === c.actionId)
                        return sum + (inst ? self.actionApCost(inst.apCost) : 0)
                    }
                    return sum
                }, 0)
                if (apUsed > 0 && existingCost + apUsed <= apBudget) {
                    cmds.push({ type: 'move', bestDistance: apUsed })
                }
            }
        }

        // 已在招式射程内 → 不动
        if (postMoveDist >= mainActionRange[0] && postMoveDist <= mainActionRange[1]) {
            // 不操作
        } else if (postMoveDist < mainActionRange[0]) {
            // 太近 → 退到 range[0]（1位小数）
            const targetDist = mainActionRange[0]
            const rawAp = PositionSystem.moveApFor(targetDist - postMoveDist, perAp)
            // 防 overshoot：试从 rawAp 往下找（0.1 步进），确保最终距离 ≥ range[0]
            let apUsed = 0
            for (let a = rawAp; a >= 0.1; a = Math.round((a - 0.1) * 10) / 10) {
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
                    return sum + (inst ? self.actionApCost(inst.apCost) : 0)
                }
                return sum
            }, 0)
            if (apUsed > 0 && existingCost + apUsed <= apBudget) {
                cmds.push({ type: 'move', bestDistance: apUsed })
            }
        } else {
            // 太远 → 进到 range[1]（1位小数）
            const targetDist = mainActionRange[1]
            const rawAp = PositionSystem.moveApFor(postMoveDist - targetDist, perAp)
            let apUsed = 0
            for (let a = rawAp; a >= 0.1; a = Math.round((a - 0.1) * 10) / 10) {
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
                    return sum + (inst ? self.actionApCost(inst.apCost) : 0)
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

/** 估算以某招式为主招的整回合总伤害 */
function estimatePlan(
    mainId: string,
    self: Character,
    state: BattleState,
    apBudget: number,
    style: AttackStyle,
): number {
    const mainInst = self.actions.find((a) => a.id === mainId)
    if (!mainInst) return 0
    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return 0

    // 主招伤害
    const mainEst = calcExpectedDamage(mainInst.def, self, enemy, weapon.range, state)
    let total = mainEst.expectedDamage

    // 计算可触发的额外攻击次数
    let extraTotal = 0
    forEachBuffOf(state.pendingBuffs, self.id, (def) => {
        if (!def?.getExtraAttack) return
        extraTotal += def.getExtraAttack({ source: mainInst.def })
    })

    // 填充额外攻击
    const excludeIds = new Set<string>([mainId])
    if (extraTotal > 0 && mainEst.apCost > 0) {
        let remaining = apBudget - mainEst.apCost
        for (let i = 0; i < extraTotal && remaining >= 1; i++) {
            const id = pickBestSecondary(self, state, remaining, excludeIds)
            if (!id) break
            const secondDef = getRuntimeAction(id, self, state) ?? getBaseAction(id)
            if (secondDef) {
                total += calcExpectedDamage(secondDef, self, enemy, weapon.range, state).expectedDamage
                remaining -= self.actionApCost(secondDef.apCost)
                excludeIds.add(id)
            }
        }
    }

    // 符合战斗风格加成
    if (style === 'melee' && mainInst.def.tags.includes('melee')) total *= 1.3
    if (style === 'ranged' && mainInst.def.tags.includes('range')) total *= 1.3

    return total
}

function pickBestSecondary(
    self: Character,
    state: BattleState,
    apRemaining: number,
    excludeIds?: Set<string>,
): string | null {
    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return null
    const sorted = [...self.actions].filter((a) => {
        if (a.def.tags.includes('pre_action') || a.def.tags.includes('post_action')) return false
        if (!a.canUse()) return false
        if (a.id === 'big_leap') return false
        if (excludeIds?.has(a.id)) return false
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
