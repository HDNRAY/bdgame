import type { Character } from '../entities/character'
import type { EffectDef } from '../entities/action'
import type { BattleState, ActionCommand } from '../combat/types'
import { getWeapon } from '../data/weapons'
import { PositionSystem } from '../combat/position'
import { calcSelfDamage } from '../calc/damage'
import { calcExpectedDamage, type DamageEstimate } from './expected-damage'
import { classifyAttackStyle, planMovement } from './move-planner'
import { planSupportActions } from './support-planner'
import type { AiOverrides } from '../data/opponents'
import { getOpponentDef } from '../data/opponents'

/** AI 决策：返回本行动中要执行的一串指令 */
export function planEvent(self: Character, state: BattleState): ActionCommand[] {
    const enemy = state.characters.find((c) => c.id !== self.id)
    if (!enemy) return []

    const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
    const distance = state.position.distance(self.id, enemy.id)
    const overrides = getOverrides(self.id)

    // ── 0. 缴械优先：先捡武器再考虑攻击 ──
    const disarmedKey = `disarmed::${self.id}`
    const disarmedLayer = state.pendingBuffs.get(disarmedKey)
    if (disarmedLayer) {
        const apBudget = self.ap - (overrides?.reserveAp ?? 0)
        const dropPos = disarmedLayer.extra?.dropPosition as number | undefined
        if (dropPos !== undefined) {
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
        }
        // 无法捡武器（距离太远/AP不够），fall through 到正常 AI
    }

    // ── 1. 候选主招（非 support） ──
    const candidates: DamageEstimate[] = []
    for (const inst of self.actions) {
        if (inst.def.tags.includes('support')) continue
        if (!inst.canUse()) continue
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        // 检查武器标签兼容性（缴械后 bare_hands 无法使用需要标签的招式）
        if (inst.def.requiredTags.length > 0) {
            const hasTag = inst.def.requiredTags.some((tag) => weapon.tags.includes(tag))
            if (!hasTag) continue
        }
        // 跳过纯位移招式（无伤害效果，如虎跃），近战时不应作为主招
        if (inst.id === 'big_leap') continue
        if (!inst.def.effects?.some((e) => e.type === 'damage' || e.type === 'fixed_damage')) continue
        const selfDmgEff = inst.def.effects?.find(
            (e): e is Extract<EffectDef, { type: 'self_damage' }> => e.type === 'self_damage',
        )
        if (selfDmgEff) {
            const dmg = calcSelfDamage(self.maxHp, selfDmgEff.ratio)
            if (self.hp <= dmg) continue
        }
        candidates.push(calcExpectedDamage(inst.def, self, enemy, weapon.range, distance))
    }

    // 2. 排序：AP 效率优先，左右互搏时低消耗招式价值翻倍
    const apBudget = self.ap - (overrides?.reserveAp ?? 0)
    const huboKey = `zuoyou_hubo::${self.id}`
    const hasHubo = state.pendingBuffs.has(huboKey)
    if (overrides?.actionPriority) {
        const weights = overrides.actionPriority(candidates, self, state)
        candidates.sort((a, b) => {
            const scoreA = calcActionScore(a, hasHubo, apBudget) + (weights[a.actionId] ?? 0)
            const scoreB = calcActionScore(b, hasHubo, apBudget) + (weights[b.actionId] ?? 0)
            if (scoreA !== scoreB) return scoreB - scoreA
            return b.expectedDamage - a.expectedDamage
        })
    } else {
        candidates.sort((a, b) => {
            const scoreA = calcActionScore(a, hasHubo, apBudget)
            const scoreB = calcActionScore(b, hasHubo, apBudget)
            // 主排序：总伤害（左右互搏时低消耗招式按双倍计）
            if (scoreA !== scoreB) return scoreB - scoreA
            // 平局决胜：AP 效率
            const effA = a.apCost > 0 ? a.expectedDamage / a.apCost : 0
            const effB = b.apCost > 0 ? b.expectedDamage / b.apCost : 0
            return effB - effA
        })
    }

    // ── 3. 遍历候选，找第一个可行的 ──
    let mainId: string | null = null
    let moveDelta = 0
    let moveAp = 0
    let dashActionId: string | undefined

    for (const est of candidates) {
        if (apBudget < est.apCost) continue
        if (est.canReach) {
            mainId = est.actionId
            break
        }
        const style = overrides?.forceStyle ?? classifyAttackStyle(weapon.range)
        const mainDef = self.actions.find((a) => a.id === est.actionId)?.def
        if (!mainDef) continue
        const minMoveCost = state.pendingBuffs.has(`min_move_cost::${self.id}`)
        const plan = planMovement(
            self,
            enemy,
            distance,
            style,
            weapon.range,
            mainDef,
            apBudget,
            minMoveCost,
            self.moveEfficiency,
        )
        if (plan) {
            mainId = est.actionId
            moveDelta = plan.delta
            moveAp = plan.apCost
            dashActionId = plan.dashActionId
            break
        }
    }

    if (!mainId) {
        const supportCmds = planSupportActions(self, state, apBudget, overrides?.supportBlacklist)
        if (supportCmds.length > 0) return supportCmds
        console.log(`[AI] ${self.name} no mainId, return []`)
        return []
    }

    // 验证 mainId 对应招式存在（pickup_weapon 可能不在所有角色 action list 中）
    const mainInst = self.actions.find((a) => a.id === mainId)
    if (!mainInst) {
        console.log(`[AI] ${self.name} mainId=${mainId} not found`)
        return []
    }
    const mainDef2 = mainInst.def

    // ── 4. 辅助招式 ──
    const supportCmds = planSupportActions(
        self,
        state,
        apBudget - moveAp - mainDef2.apCost,
        overrides?.supportBlacklist,
    )

    // ── 5. 组装命令 ──
    const cmds: ActionCommand[] = [...supportCmds]

    if (dashActionId) {
        // 位移招式有 support 标签的用 support 指令（跳过战斗判定）
        const dashInst = self.actions.find((a) => a.id === dashActionId)
        if (dashInst?.def.tags.includes('support')) {
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

    // ── 6. 左右互搏 ──
    if (state.pendingBuffs.has(`zuoyou_hubo::${self.id}`) && weapon.tags.includes('dual_wield')) {
        const spent =
            moveAp +
            mainDef2.apCost +
            supportCmds.reduce((s, c) => {
                const inst = self.actions.find((a) => a.id === c.actionId)
                return s + (inst?.apCost ?? 0)
            }, 0)
        const remaining = apBudget - spent
        if (remaining >= 2) {
            const second = pickBestSecondary(self, state, remaining)
            if (second) cmds.push({ type: 'attack', actionId: second })
        }
    }

    // ── 7. 行动后走位（只在武器射程外才走） ──
    if (enemy) {
        const basePerAp = PositionSystem.apToRange(self.attrs.get('agility'))
        const perAp = state.pendingBuffs.has(`min_move_cost::${self.id}`)
            ? 2
            : basePerAp * (1 + (self.moveEfficiency ?? 0))
        // 估算行动后的实际距离
        const preMoveDist = state.position.distance(self.id, enemy.id)
        const postMoveDist = moveDelta !== 0 ? preMoveDist + perAp * moveAp * (moveDelta > 0 ? 1 : -1) : preMoveDist
        // 已在武器射程内 → 不动
        if (postMoveDist >= weapon.range[0] && postMoveDist <= weapon.range[1]) {
            // 不操作
        } else if (postMoveDist < weapon.range[0]) {
            // 太近 → 退到 range[0]
            const targetDist = weapon.range[0]
            const rawAp = Math.ceil((targetDist - postMoveDist) / perAp)
            // 防 overshoot：试从 rawAp 往下找，确保最终距离 ≥ range[0]
            let apUsed = 0
            for (let a = rawAp; a >= 1; a--) {
                const finalDist = postMoveDist + perAp * a
                if (finalDist >= weapon.range[0]) {
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
            const targetDist = weapon.range[1]
            const rawAp = Math.ceil((postMoveDist - targetDist) / perAp)
            let apUsed = 0
            for (let a = rawAp; a >= 1; a--) {
                const finalDist = postMoveDist - perAp * a
                if (finalDist <= weapon.range[1]) {
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

/** 计算招式评分：总伤害为主，AP 效率为辅，左右互搏时低消耗招式按双倍总伤害比较 */
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
    const distance = state.position.distance(self.id, enemy.id)
    const sorted = [...self.actions].filter((a) => {
        if (a.def.tags.includes('support')) return false
        if (!a.canUse()) return false
        if (a.id === 'big_leap') return false
        if (!a.def.effects?.some((e) => e.type === 'damage' || e.type === 'fixed_damage')) return false
        if (a.def.requiredTags.length > 0) {
            const hasTag = a.def.requiredTags.some((tag) => weapon.tags.includes(tag))
            if (!hasTag) return false
        }
        return true
    })
    // 按 AP 效率排序（伤害/AP），选性价比最高的
    const scored = sorted.map((inst) => {
        const est = calcExpectedDamage(inst.def, self, enemy, weapon.range, distance)
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

function getOverrides(charId: string): AiOverrides | undefined {
    const def = getOpponentDef(charId)
    return def?.aiOverrides
}
