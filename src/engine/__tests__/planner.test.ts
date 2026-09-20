import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import type { BattleState } from '../combat/types'
import { gen } from '../../data/opponents/index'
import { OTSU, FANGLIE, DOCTOR, XUNXIANG, AJIU } from '../../data/opponents/index'
import { BattleEngine } from '../combat/engine'
import { generatePlans, bestPlan, optimalRangeBand, intentDirection, intentGoal, intentTarget } from '../ai/planner'
import type { ActionDefinition } from '../entities/action'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

function makeChar(id: string, name: string, preset: unknown): Character {
    const build = gen(preset as never, 33)
    return new Character({ ...build, id, name })
}

/** 造一个完整引擎状态（battle_start 已过，双方就位） */
function makeState(self: Character, enemy: Character, distance = 4): BattleState {
    const engine = new BattleEngine(self, enemy, distance, true)
    return engine.state
}

const candsOf = (c: Character): ActionDefinition[] =>
    c.actions
        .map((a) => a.def)
        .filter((d) => !d.tags.some((t) => ['pre_action', 'post_action', 'internal'].includes(t)))

describe('planner · 落点由「最优射程带 + 风格意图」算出（不穷举）', () => {
    it('ranged：意图是远端 → 目标往外走，且不超出最优带', () => {
        const self = makeChar('A', '博士', DOCTOR)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        const cands = candsOf(self)
        const band = optimalRangeBand(self, state, cands, 4)
        expect(band).not.toBeNull()
        expect(intentDirection(self, enemy)).toBe('far')
        const target = intentTarget(self, state, cands, 4, self.maxAp)
        // 要么已经在远端（null），要么往外走
        expect(target === null || target > 4).toBe(true)
        if (target !== null) expect(target).toBeLessThanOrEqual(band!.hi + 1e-6)
    })

    it('melee：已在最优带内就不移动（不再无脑贴脸/追）', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const probe = makeState(self, enemy, 4)
        const band = optimalRangeBand(self, probe, candsOf(self), 4)
        expect(band).not.toBeNull()
        const mid = (band!.lo + band!.hi) / 2
        const state = makeState(self, enemy, mid)
        const cands = candsOf(self)
        expect(intentDirection(self, enemy)).toBe('near')
        expect(intentGoal(self, state, cands, mid)).toBeNull()
        expect(intentTarget(self, state, cands, mid, self.maxAp)).toBeNull()
    })

    it('melee：打不到时必须进带子（走到预算允许处，不整档作废）', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 9)
        const cands = candsOf(self)
        const band = optimalRangeBand(self, state, cands, 9)!
        const target = intentTarget(self, state, cands, 9, self.maxAp)
        expect(target).not.toBeNull()
        expect(target!).toBeLessThan(9) // 朝带子靠近
        // 不会越过「远端入口」（预算不足就是走到头，下回合继续）
        expect(target!).toBeGreaterThanOrEqual(band.hi - 0.15 - 1e-6)
    })

    it('计划里最多一次移动（后置移动是「先打后动」，不是额外再走一段）', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        self.ap = self.maxAp
        const plans = generatePlans(self, state, candsOf(self), self.ap)
        expect(plans.length).toBeGreaterThan(0)
        for (const p of plans) {
            expect(p.cmds.filter((c) => c.type === 'move').length).toBeLessThanOrEqual(1)
        }
    })
})

describe('planner · 后置移动（先打后动）', () => {
    it('冲脸招（天外飞仙 short_dash 5）打完能退开：位移排在出招之后', () => {
        // 天外飞仙 自带 short_dash 5：从 4m 用出去会把自己拖到武器射程内（贴身），
        // 所以必须有「先出招、再用剩余 AP 退到意图位置」的计划，否则打近战没法风筝。
        const self = makeChar('A', '凤寻香', XUNXIANG)
        const enemy = makeChar('B', '阿九', AJIU)
        const state = makeState(self, enemy, 4)
        self.ap = 6
        self.chan = 50 // 天外飞仙 消耗 MAX_CHAN
        const plans = generatePlans(self, state, candsOf(self), self.ap)
        expect(plans.length).toBeGreaterThan(0)
        const best = bestPlan(plans)!
        const atk = best.cmds.findIndex((c) => c.type === 'attack' && c.actionId === 'tian_wai_fei_xian')
        const mv = best.cmds.findIndex((c) => c.type !== 'attack')
        expect(atk).toBeGreaterThanOrEqual(0)
        expect(mv).toBeGreaterThan(atk) // 后置移动：先出招，再位移
    })
})

describe('planner · 回合计划生成（大津场景）', () => {
    it('生成至少一个可行计划，且总 AP 不超预算', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        self.ap = self.maxAp
        const cands = self.actions
            .map((a) => a.def)
            .filter((d) => !d.tags.some((t) => ['pre_action', 'post_action', 'internal'].includes(t)))
        const plans = generatePlans(self, state, cands, self.ap)
        expect(plans.length).toBeGreaterThan(0)
        for (const p of plans) {
            expect(p.totalAp).toBeLessThanOrEqual(self.ap + 1e-6)
            expect(p.totalDamage).toBeGreaterThan(0)
            expect(p.score).toBeGreaterThan(0)
        }
    })

    it('存在「段1 攻击 + 移动 + 段2 攻击」跨移动分段计划（连发 + 风筝意图）', () => {
        // 段1（移动前先打）只在有连发时才有内容；再叠加「ranged 意图往远端走」才会同回合既打又走
        const self = new Character({
            id: 'A',
            name: 'A',
            story: '',
            weapon: 'bare_hands',
            battleStyle: 'ranged',
            // 灵巧 16：漫天花雨有 requireAttrsMin 门槛，够不到就不生效
            baseAttrs: { strength: 16, vitality: 16, agility: 16, dexterity: 16, insight: 16, wisdom: 16 },
            rewards: [
                // 两张暗器招：段1 用一张起手，段2 才能用另一张接着打（同招不重复入段）
                { type: 'action' as const, id: 'dart_throw', name: '镖', description: '', tags: [] as never[] },
                { type: 'action' as const, id: 'throwing_knife', name: '飞刀', description: '', tags: [] as never[] },
                { type: 'passive' as const, id: 'fei_hua_shou', name: '漫天花雨', description: '', tags: [] as never[] },
            ],
        })
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 3)
        self.ap = self.maxAp
        const plans = generatePlans(self, state, candsOf(self), self.ap)
        const mixed = plans.find((p) => {
            const moveIdx = p.cmds.findIndex((c) => c.type === 'move')
            if (moveIdx <= 0) return false
            const before = p.cmds.slice(0, moveIdx)
            const after = p.cmds.slice(moveIdx + 1)
            return before.some((c) => c.type === 'attack') && after.some((c) => c.type === 'attack')
        })
        expect(mixed).toBeDefined()
    })

    it('最优计划：效率最高，效率相同取总伤害高者', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        self.ap = self.maxAp
        const cands = self.actions
            .map((a) => a.def)
            .filter((d) => !d.tags.some((t) => ['pre_action', 'post_action', 'internal'].includes(t)))
        const plans = generatePlans(self, state, cands, self.ap)
        const best = bestPlan(plans)
        expect(best).not.toBeNull()
        // best 的 score 应是所有计划里最高的
        const maxScore = Math.max(...plans.map((p) => p.score))
        expect(Math.abs(best!.score - maxScore)).toBeLessThan(1e-9)
    })
})

describe('planner · 移动预算', () => {
    it('AP 很少时计划不超预算', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        self.ap = 2 // AP 很少，勉强够一招
        const plans = generatePlans(self, state, candsOf(self), self.ap)
        for (const p of plans) {
            expect(p.totalAp).toBeLessThanOrEqual(self.ap + 1e-6)
        }
    })
})
