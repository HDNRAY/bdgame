import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import { Character } from '../entities/character'
import { gen, getOpponentDef } from '../../data/opponents'
import { getAction } from '../../data/actions'
import { forEachHookOf } from '../combat/utils'
import type { OpponentDef } from '../../data/opponents'
import type { ActionDefinition } from '../entities/action'
import type { BattleState } from '../combat/types'

/** 杨之改的 build（唯一带玄剑秘册的对手），可剥离指定奖励做对照 */
function make(drop: string[] = []) {
    const def = getOpponentDef('yangguo') as OpponentDef
    const d = { ...def, rewards: def.rewards.filter((r) => !drop.includes(r.id)) }
    const me = new Character(gen(d as OpponentDef, 33))
    const foe = new Character(gen(getOpponentDef('otsu')!, 33))
    const engine = new BattleEngine(me, foe, 4, false)
    return { me, foe, state: engine.state }
}

/** 引擎 #executeAction 口径：base + Σ onActionCost（下限 1）→ 身法/急速减免 */
function engineApCost(me: Character, foe: Character, state: BattleState, action: ActionDefinition): number {
    let cost = action.apCost
    forEachHookOf(state.pendingBuffs, 'onActionCost', me.id, (def, layer) => {
        const r = def.onActionCost?.({ final: 0, raw: 0, attacker: me, target: foe, state, layer, source: action } as never)
        cost = Math.max(1, cost + (r ?? 0))
    })
    return me.actionApCost(cost, state)
}

function penaltyOf(me: Character, state: BattleState): number {
    return Math.abs((state.pendingBuffs.get(`heavy_load::${me.id}`)?.mods?.agility as number) ?? 0)
}

describe('玄剑 · heavy_training', () => {
    it('招式 AP 折扣必须跨得过取整：同一条 5AP 招，带玄剑比不带便宜', () => {
        // 固定 -0.1 会被「×身法减免 → round1 到 1 位小数」抹平（3.9 与 4.0 都落到 3.40）
        const act = getAction('desolate_palm')!
        const withArt = make()
        const without = make(['dark_iron_sword_art'])
        const a = engineApCost(withArt.me, withArt.foe, withArt.state, act)
        const b = engineApCost(without.me, without.foe, without.state, act)
        expect(a).toBeLessThan(b)
    })

    it('重器身法负担 -2：只留玄剑（剥掉潮汐）时负担被减掉', () => {
        // 潮汐炁功同样带 heavy_reduce(-2)，都在时惩罚已归零 → 剥掉它才能看出玄剑这一层
        const withArt = make(['tide_inner_power'])
        const without = make(['tide_inner_power', 'dark_iron_sword_art'])
        expect(penaltyOf(without.me, without.state)).toBeGreaterThan(0)
        expect(penaltyOf(withArt.me, withArt.state)).toBeLessThan(penaltyOf(without.me, without.state))
    })
})
