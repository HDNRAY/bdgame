import { describe, it, expect, vi } from 'vitest'
import { evaluateWhen } from '../entities/condition'
import { buildNodeSpecs } from '../roguelite/map-builder'
import { injuryForNode } from '../roguelite/util'
import { ALL_EVENTS, getEvent } from '../../data/events/index'

const specs = buildNodeSpecs(ALL_EVENTS)

// n23 热身集成测试用：mock 战斗（本文件其余测试不跑真实战斗，无副作用）
const battle = vi.hoisted(() => ({ playerWins: true }))
vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_p: unknown, enemy: { id: string }) => ({
        winner: battle.playerWins ? 'player' : enemy.id,
        engine: { state: { log: { getAll: () => [] } } },
    }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))
import { RogueliteRun } from '../roguelite/engine'

function candidateAt(eventId: string, index: number) {
    return specs[index].candidates.find((c) => c.eventId === eventId)
}

describe('败场伤势按阶段', () => {
    it('一阶段 10 / 二阶段 15 / 三阶段 0', () => {
        expect(injuryForNode(1)).toBe(10)
        expect(injuryForNode(11)).toBe(10)
        expect(injuryForNode(12)).toBe(15)
        expect(injuryForNode(22)).toBe(15)
        expect(injuryForNode(23)).toBe(0)
        expect(injuryForNode(33)).toBe(0)
    })
})

describe('胜负分支（result.won 上下文）', () => {
    it('evaluateWhen 可读 result.won', () => {
        const winWhen = { '==': [{ var: 'result.won' }, true] }
        const lossWhen = { '!': { var: 'result.won' } }
        expect(evaluateWhen(winWhen, { flags: {}, result: { won: true } })).toBe(true)
        expect(evaluateWhen(winWhen, { flags: {}, result: { won: false } })).toBe(false)
        expect(evaluateWhen(lossWhen, { flags: {}, result: { won: false } })).toBe(true)
        // 无 result（非战斗轮）→ 不满足，避免误入胜负分支
        expect(evaluateWhen(winWhen, { flags: {} })).toBe(false)
    })
})

describe('n23 开幕热身赛（tournament_open）', () => {
    const open = getEvent('tournament_open')!

    it('事件结构：开幕 → 各线热身战斗轮 → 胜负分支 → 赢授艺 / 输无奖励', () => {
        const warmupPick = open.rounds.find((r) => r.id === 'warmup_pick')!
        expect(warmupPick.choices).toHaveLength(5)
        for (const s of ['sect', 'veteran', 'wanderer', 'feud', 'xuanmen']) {
            expect(evaluateWhen(warmupPick.choices.find((c) => c.id === `warmup_${s}`)!.when, { flags: { story: s } })).toBe(true)
        }
        // 各线战斗轮：固定敌人
        expect(open.rounds.find((r) => r.id === 'warmup_sect')!.enemyId).toBe('layue')
        expect(open.rounds.find((r) => r.id === 'warmup_veteran')!.enemyId).toBe('hongti')
        expect(open.rounds.find((r) => r.id === 'warmup_wanderer')!.enemyId).toBe('laifeng')
        expect(open.rounds.find((r) => r.id === 'warmup_feud')!.enemyId).toBe('daixuan')
        expect(open.rounds.find((r) => r.id === 'warmup_xuanmen')!.enemyId).toBe('junshi')
        // 胜负分支
        const result = open.rounds.find((r) => r.id === 'warmup_result')!
        expect(result.choices.some((c) => c.id === 'warmup_win' && c.when && evaluateWhen(c.when, { flags: {}, result: { won: true } }))).toBe(true)
        expect(result.choices.some((c) => c.id === 'warmup_loss' && c.when && evaluateWhen(c.when, { flags: {}, result: { won: false } }))).toBe(true)
        // 赢 → 各线授艺功法
        const win = open.rounds.find((r) => r.id === 'warmup_win')!
        expect(win.choices.map((c) => c.id).sort()).toEqual(['combat_instinct', 'iaijutsu_mastery', 'insight_awareness', 'spirit_resonance', 'sword_dominion'])
        expect(win.choices.every((c) => c.type === 'passive')).toBe(true)
    })

    it('n23 不再计为修炼点配额机会', () => {
        // tournament_open 事件级奖励为 none，warmup 轮次级给功法
        expect(open.reward).toEqual({ kind: 'none' })
    })
})

describe('B 故事线切磋池（n10-21，3 选 1，story 专属）', () => {
    const spars: [string, string, number][] = [
        ['sect_spar_fangqing', 'sect', 13],
        ['veteran_spar_lixueying', 'veteran', 13],
        ['wanderer_spar_qilan', 'wanderer', 13],
        ['feud_spar_qilan', 'feud', 13],
        ['xuanmen_spar_xuanqi', 'xuanmen', 13],
    ]
    for (const [id, story, node] of spars) {
        it(`${id} 在 n${node} 是 fallback 候选且只对本线存活（含战斗轮）`, () => {
            const c = candidateAt(id, node - 1)
            expect(c).toBeDefined()
            expect(c?.fallback).toBe(true)
            const ev = getEvent(id)!
            expect(ev.rounds.some((r) => r.enemyId)).toBe(true)
            expect(evaluateWhen(c?.when, { flags: { story } })).toBe(true)
            expect(evaluateWhen(c?.when, { flags: { story: story === 'sect' ? 'feud' : 'sect' } })).toBe(false)
            // 每局一次（done 门控）
            expect(evaluateWhen(c?.when, { flags: { story, [`${id}_done`]: true } })).toBe(false)
        })
    }
})

describe('玄门 × 天工坊', () => {
    it('tiangong_weapon / offhand 对玄门不存活', () => {
        const tw = candidateAt('tiangong_weapon', 8)!
        expect(evaluateWhen(tw.when, { flags: { story: 'sect' } })).toBe(true)
        expect(evaluateWhen(tw.when, { flags: { story: 'xuanmen' } })).toBe(false)
        const to = candidateAt('tiangong_offhand', 24)!
        expect(evaluateWhen(to.when, { flags: { tiangong_done: true, weapon_one_handed: true, story: 'veteran' } })).toBe(true)
        expect(evaluateWhen(to.when, { flags: { tiangong_done: true, weapon_one_handed: true, story: 'xuanmen' } })).toBe(false)
        // 打工保留给玄门
        const tj = candidateAt('tiangong_job', 13)!
        expect(evaluateWhen(tj.when, { flags: { story: 'xuanmen' } })).toBe(true)
    })
})

describe('医馆条件化（n22 前 · 受伤 ≥50）', () => {
    it('受伤 50 以下不出现；50 及以上才进入池', () => {
        const c = candidateAt('branch_heal', 13)!
        expect(c).toBeDefined()
        expect(evaluateWhen(c.when, { flags: { injury: 30 } })).toBe(false)
        expect(evaluateWhen(c.when, { flags: { injury: 50 } })).toBe(true)
        expect(evaluateWhen(c.when, { flags: { injury: 80 } })).toBe(true)
    })
    it('n22 之后（三阶段）不再出现', () => {
        expect(candidateAt('branch_heal', 23)).toBeUndefined()
        expect(candidateAt('branch_heal', 31)).toBeUndefined()
    })
})

describe('n23 热身赛集成（mock 战斗全胜 → 赢 → 授艺）', () => {
    function driveToWarmup(seed: number): { reward: string; won: boolean } {
        battle.playerWins = true
        vi.spyOn(Math, 'random').mockReturnValue(seed)
        const run = new RogueliteRun()
        let state = run.getState()
        let guard = 0
        let won = false
        let rewardChoice = ''
        while (!state.finished && guard++ < 800) {
            const round = state.rounds[state.rounds.length - 1]
            if (!round || round.choices.length === 0) break
            let idx = 0
            if (state.nodeIndex === 1 && round.id === 'pick') {
                idx = round.choices.findIndex((c) => c.id === 'origin_sect')
                if (idx < 0) break
            }
            if (state.nodeIndex === 23 && round.id === 'warmup_result') {
                won = round.choices.some((c) => c.id === 'warmup_win')
            }
            if (state.nodeIndex === 23 && round.id === 'warmup_win') {
                rewardChoice = round.choices[0]?.id ?? ''
            }
            run.selectChoice(idx)
            state = run.getState()
        }
        vi.restoreAllMocks()
        return { reward: rewardChoice, won }
    }

    it('道种热身赢 → 授艺剑意领域', () => {
        const r = driveToWarmup(0.5)
        expect(r.won).toBe(true)
        expect(r.reward).toBe('sword_dominion')
    })
})
