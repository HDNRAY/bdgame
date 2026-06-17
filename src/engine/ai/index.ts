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
        const ordered = overrides.actionPriority(candidates, self, state)
        // actionPriority 内用 AP 效率二次排序（同级内效率高的排前）
        const orderMap = new Map(ordered.map((id, i) => [id, i]))
        candidates.sort((a, b) => {
            const ia = orderMap.get(a.actionId) ?? Infinity
            const ib = orderMap.get(b.actionId) ?? Infinity
            if (ia !== ib) return ia - ib
            // 同级内按 AP 效率排序
            return calcActionScore(b, hasHubo, apBudget) - calcActionScore(a, hasHubo, apBudget)
        })
    } else {
        candidates.sort((a, b) => {
            const scoreA = calcActionScore(a, hasHubo, apBudget)
            const scoreB = calcActionScore(b, hasHubo, apBudget)
            if (Math.abs(scoreA - scoreB) > 0.5) return scoreB - scoreA
            // 效率相近时，优先选总伤害高的
            return b.expectedDamage - a.expectedDamage
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
        return []
    }

    // 验证 mainId 对应招式存在（pickup_weapon 可能不在所有角色 action list 中）
    const mainInst = self.actions.find((a) => a.id === mainId)
    if (!mainInst) return []
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
        cmds.push({ type: 'move', bestDistance: moveDelta })
    }
    cmds.push({ type: 'attack', actionId: mainId })

    // ── 6. 左右互搏 ──
    if (state.pendingBuffs.has(`zuoyou_hubo::${self.id}`)) {
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

    // ── 7. 行动后走位（剩余 AP，但不走多余距离） ──
    if (enemy && moveDelta === 0) {
        const style = overrides?.forceStyle ?? classifyAttackStyle(weapon.range)
        const basePerAp = PositionSystem.apToRange(self.attrs.get('agility'))
        const perAp = state.pendingBuffs.has(`min_move_cost::${self.id}`)
            ? 2
            : basePerAp * (1 + (self.moveEfficiency ?? 0))
        // 理想距离：远程/中程保持在最大射程边缘，近战贴脸
        const idealDist = style === 'ranged' || style === 'mid' ? weapon.range[1] : Math.max(weapon.range[0], 2)
        const currentDist = state.position.distance(self.id, enemy.id)
        const postDelta = idealDist - currentDist
        if (Math.abs(postDelta) >= 1) {
            const dist = Math.abs(postDelta)
            const apUsed = Math.ceil(dist / perAp)
            if (apUsed > 0) {
                cmds.push({ type: 'move', bestDistance: postDelta > 0 ? apUsed : -apUsed })
            }
        }
    }

    return cmds
}

/** 计算招式的 AP 效率评分（考虑左右互搏） */
function calcActionScore(est: DamageEstimate, hasHubo: boolean, apBudget: number): number {
    if (est.apCost <= 0) return 0
    const dmgPerAp = est.expectedDamage / est.apCost
    if (!hasHubo) return dmgPerAp
    // 左右互搏：能用两次的招式总价值更高
    const maxUses = Math.min(2, Math.floor(apBudget / est.apCost))
    return dmgPerAp * maxUses
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
