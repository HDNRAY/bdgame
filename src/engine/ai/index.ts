import type { Character } from '../entities/character'
import type { BattleState, ActionCommand } from '../combat/types'
import type { ActionDefinition } from '../entities/action'
import { getWeapon } from '../data/weapons'
import { DistanceSystem } from '../combat/distance'
import { calcSelfDamage } from '../calc/damage'

/** 找到对己方和对方武器都最有利的距离 */
function findOptimalDistance(
    selfWeapon: { range: [number, number] },
    enemyWeapon: { range: [number, number] },
    currentDist: number,
): number {
    const [myMin, myMax] = selfWeapon.range
    const [enMin, enMax] = enemyWeapon.range
    // 在自身攻击范围内，且不在对方攻击范围内的距离中，选离当前位置最近的
    let best = currentDist
    let bestDist = Infinity
    for (let d = myMin; d <= myMax; d++) {
        if (d < enMin || d > enMax) {
            const dist = Math.abs(d - currentDist)
            if (dist < bestDist) {
                bestDist = dist
                best = d
            }
        }
    }
    return best
}

/** AI 决策：返回本行动中要执行的一串指令 */
export function planEvent(self: Character, state: BattleState, preferredMainId?: string): ActionCommand[] {
    const cmds: ActionCommand[] = []
    const weapon = getWeapon(self.build.weapon)
    const enemy = state.characters.find((c) => c.id !== self.id)

    // 1. 决定主招
    const mainId = preferredMainId ?? pickMainAction(self, state)
    if (!mainId) return cmds
    const mainDef = self.actions.find((a) => a.id === mainId)?.def
    if (!mainDef) return cmds

    // 2. 计算移动需要多少 AP
    const perAp = DistanceSystem.apToRange(self.attrs.get('agility'))
    let moveAp = 0
    let virtualDist = state.distance.current
    if (virtualDist > weapon.range[1]) {
        const need = virtualDist - weapon.range[1]
        moveAp = Math.ceil(need / perAp)
        virtualDist -= perAp * moveAp
    } else if (virtualDist < weapon.range[0]) {
        const need = weapon.range[0] - virtualDist
        moveAp = Math.ceil(need / perAp)
        virtualDist += perAp * moveAp
    }

    const apAfterMove = self.ap - moveAp

    // 3. 辅招（凝炁/聚炁）— 只有移动后 AP 够主招+辅招才放
    let bonusAp = 0
    for (const inst of self.actions) {
        if (!inst.def.tags.includes('support')) continue
        if (!inst.canUse()) continue
        if (inst.def.bonusTiming?.type !== 'before_main') continue
        // buff 辅招：已有则跳过
        if (inst.def.tags.includes('buff') && hasActiveBuffByAction(self, state, inst.def)) continue
        // 检查移动后 AP 够走完所有已选辅招 + 当前辅招 + 主招
        if (apAfterMove < bonusAp + inst.apCost + mainDef.apCost) continue
        cmds.push({ type: 'bonus', actionId: inst.id })
        bonusAp += inst.apCost
    }

    // 4. 移动进入攻击范围
    if (moveAp > 0) {
        cmds.push({ type: 'move', bestDistance: state.distance.current > weapon.range[1] ? -moveAp : moveAp })
    }

    const apAfterBonus = apAfterMove - bonusAp

    // 5. 攻击
    if (apAfterBonus >= mainDef.apCost && virtualDist >= weapon.range[0] && virtualDist <= weapon.range[1]) {
        cmds.push({ type: 'attack', actionId: mainId })
    }

    // 5.5 左右互搏：有 buff 时剩余 AP 再打一次
    if (state.pendingBuffs.has(`zuoyou_hubo::${self.id}`)) {
        const remainingAp = apAfterBonus - (apAfterBonus >= mainDef.apCost ? mainDef.apCost : 0)
        if (remainingAp >= 2) {
            const second = pickBestAttack(self, state, remainingAp)
            if (second) {
                cmds.push({ type: 'attack', actionId: second })
            }
        }
    }

    // 6. 行动后移动：有多余 AP 时根据双方武器距离调整位置
    if (enemy) {
        const enemyWeapon = getWeapon(enemy.build.weapon)
        const optimal = findOptimalDistance(weapon, enemyWeapon, state.distance.current)
        const delta = optimal - state.distance.current // + = 远离, - = 靠近
        if (delta !== 0) {
            const dist = Math.abs(delta)
            const apNeeded = Math.ceil(dist / perAp)
            const remainingAp = apAfterBonus - (apAfterBonus >= mainDef.apCost ? mainDef.apCost : 0)
            if (remainingAp >= apNeeded) {
                cmds.push({ type: 'move', bestDistance: delta > 0 ? apNeeded : -apNeeded })
            }
        }
    }

    return cmds
}

/** 选最优主招（AP 消耗大的优先，避免全程小招） */
function pickMainAction(self: Character, state: BattleState): string | null {
    return pickBestAttack(self, state, self.ap)
}

/** 选[剩余AP]下最优的攻击招式 */
function pickBestAttack(self: Character, state: BattleState, apRemaining: number): string | null {
    const sorted = [...self.actions].sort((a, b) => b.apCost - a.apCost)
    for (const inst of sorted) {
        if (inst.def.tags.includes('support')) continue
        if (!inst.canUse()) continue
        if (apRemaining < inst.apCost) continue
        // 自定义释放条件
        if (inst.def.canUse && !inst.def.canUse(self, state)) continue
        // 自伤招式：HP 不够则跳过
        const selfDmgEff = inst.def.effects?.find((e) => e.type === 'self_damage')
        if (selfDmgEff && selfDmgEff.type === 'self_damage') {
            const dmg = calcSelfDamage(self.maxHp, selfDmgEff.ratio)
            if (self.hp <= dmg) continue
        }
        return inst.id
    }
    return null
}

/** 判断某个招式对应的 buff 效果是否已激活 */
function hasActiveBuffByAction(self: Character, state: BattleState, def: ActionDefinition): boolean {
    for (const eff of def.effects ?? []) {
        if (eff.type === 'stat_buff' || eff.type === 'stat_multiply') {
            for (const [k] of state.pendingBuffs) {
                if (k.startsWith(`${eff.type}::${self.id}`)) return true
            }
        }
    }
    return false
}
