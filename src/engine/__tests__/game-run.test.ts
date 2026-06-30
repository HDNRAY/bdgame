import { describe, it, expect } from 'vitest'
import { GameRun } from '../systems/game-run'

describe('GameRun', () => {
    function step(run: GameRun, pick = 0) {
        run.getSelectionItems()
        return run.selectOption(pick)
    }

    it('选背景 +4 修炼点（sect 除外）', () => {
        const run = new GameRun('quick')
        expect(run.getCurrentNode().index).toBe(1)
        const items = run.getSelectionItems()
        expect(items).toHaveLength(3)
        const result = run.selectOption(0)
        const expected = items[0].id === 'sect' ? 0 : 4
        expect(result.cultPoints).toBe(expected)
        expect(run.state.build.story).toBe(items[0].id)
    })

    it('选武器', () => {
        const run = new GameRun('quick')
        step(run)
        expect(run.getCurrentNode().index).toBe(2)
        const items = run.getSelectionItems()
        expect(items).toHaveLength(3)
        run.selectOption(0)
        expect(run.state.build.weapon).toBe(items[0].id)
    })

    it('节点3固定出招式(first_action)', () => {
        const run = new GameRun('quick')
        step(run)
        step(run)
        expect(run.getCurrentNode().index).toBe(3)
        expect(run.getCurrentNode().type).toBe('first_action')
        const items = run.getSelectionItems()
        expect(items).toHaveLength(3)
        const prev = run.state.build.rewards.length
        run.selectOption(0)
        expect(run.state.build.rewards.length).toBe(prev + 1)
    })

    it('玄门：节点2只出御物武器', () => {
        const run = new GameRun('quick')
        const items = run.getSelectionItems()
        const idx = items.findIndex((i) => i.id === 'xuanmen')
        if (idx < 0) return
        run.selectOption(idx)
        expect(run.getCurrentNode().index).toBe(2)
        const wp = run.getSelectionItems()
        expect(wp).toHaveLength(3)
        for (const w of wp) {
            expect(['floating_silk', 'tri_orb', 'fei_jian']).toContain(w.id)
        }
    })

    it('天生道种(sect)：节点1给0点', () => {
        const run = new GameRun('quick')
        const items = run.getSelectionItems()
        const idx = items.findIndex((i) => i.id === 'sect')
        if (idx < 0) return
        const result = run.selectOption(idx)
        expect(result.cultPoints).toBe(0)
        expect(run.state.unspentCultPoints).toBe(1)
    })

    it('event节点生成3个选项', () => {
        const run = new GameRun('quick')
        step(run)
        step(run)
        step(run)
        expect(run.getCurrentNode().type).toBe('event')
        const items = run.getSelectionItems()
        expect(items).toHaveLength(3)
    })

    it('选择非cult奖励后rewards增加', () => {
        const run = new GameRun('quick')
        step(run)
        step(run)
        step(run)
        run.getSelectionItems()
        const result = run.selectOption(0)
        if (result.rewardChoices && result.rewardChoices.length > 0) {
            const rewardId = result.rewardChoices[0].id
            // 修炼点不走 rewards 数组，跳过
            if (rewardId === 'cult_reward') return
            const before = run.state.build.rewards.length
            run.selectReward(rewardId)
            expect(run.state.build.rewards.length).toBe(before + 1)
        }
    })
})
