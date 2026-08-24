import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import type { BattleState } from '../combat/types'
import { gen } from '../../data/opponents/index'
import { OTSU, FANGLIE, DOCTOR } from '../../data/opponents/index'
import { BattleEngine } from '../combat/engine'
import { generatePlans, bestPlan, keyDistances } from '../ai/planner'

function makeChar(id: string, name: string, preset: unknown): Character {
    const build = gen(preset as never, 33)
    return new Character({ ...build, id, name })
}

/** 造一个完整引擎状态（battle_start 已过，双方就位） */
function makeState(self: Character, enemy: Character, distance = 4): BattleState {
    const engine = new BattleEngine(self, enemy, distance, true)
    return engine.state
}

describe('planner · 关键移动落点（三风格）', () => {
    it('melee 大津：落点含当前距离/进射程/贴脸', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        const cands = self.actions
            .map((a) => a.def)
            .filter((d) => !d.tags.some((t) => ['pre_action', 'post_action', 'internal'].includes(t)))
        const dists = keyDistances(self, state, cands)
        // 当前 4m + 进射程（横斩/穿云 range[1]=3）+ 贴脸（range[0]=1）
        expect(dists).toContain(4)
        expect(dists).toContain(3)
        expect(dists).toContain(1)
    })

    it('ranged 博士：落点含当前距离/风筝最远', () => {
        const self = makeChar('A', '博士', DOCTOR)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        const cands = self.actions
            .map((a) => a.def)
            .filter((d) => !d.tags.some((t) => ['pre_action', 'post_action', 'internal'].includes(t)))
        const dists = keyDistances(self, state, cands)
        expect(dists).toContain(4) // 当前
        // 有武器射程上限（hover_drone [0,6] 或招式范围）
        expect(dists.some((d) => d >= 6)).toBe(true)
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

    it('存在「落月起手 + 移动 + 近战招」混合计划（段1+移动+段2）', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        self.ap = self.maxAp
        const cands = self.actions
            .map((a) => a.def)
            .filter((d) => !d.tags.some((t) => ['pre_action', 'post_action', 'internal'].includes(t)))
        const plans = generatePlans(self, state, cands, self.ap)
        // 应存在：段1 有落月，移动指令在中间，段2 有近战招
        const mixed = plans.find((p) => {
            const hasLuoYue = p.cmds.some((c) => c.actionId === '_luo_yue')
            const hasMove = p.cmds.some((c) => c.type === 'move')
            const hasMeleeAfter = p.cmds.some((c) => c.actionId === 'horizontal_slash' || c.actionId === '_chuan_yun')
            return hasLuoYue && hasMove && hasMeleeAfter
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

describe('planner · 收尾移动（有 AP 才动）', () => {
    it('AP 用尽时不追加移动', () => {
        const self = makeChar('A', '大津', OTSU)
        const enemy = makeChar('B', '方烈', FANGLIE)
        const state = makeState(self, enemy, 4)
        self.ap = 2 // AP 很少，勉强够一招
        const cands = self.actions
            .map((a) => a.def)
            .filter((d) => !d.tags.some((t) => ['pre_action', 'post_action', 'internal'].includes(t)))
        const plans = generatePlans(self, state, cands, self.ap)
        for (const p of plans) {
            expect(p.totalAp).toBeLessThanOrEqual(self.ap + 1e-6)
        }
    })
})
