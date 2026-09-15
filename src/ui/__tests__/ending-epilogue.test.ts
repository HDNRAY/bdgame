import { describe, it, expect, vi, beforeEach } from 'vitest'

const battle = vi.hoisted(() => ({ playerWins: true }))

vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_player: unknown, enemy: { id: string }) => ({
        winner: battle.playerWins ? 'player' : enemy.id,
        engine: { state: { log: { getAll: () => [] } } },
    }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))

import { useRogueliteStore } from '../stores/roguelite-store'
import { META_SAVE_KEY, loadMeta, setMetaStorage } from '../../game/meta-save'
import { ENDING_NAMES, ENDING_NAME_DEFAULT, ENDING_NAME_FALLEN, TRUE_ENDING_EPILOGUE } from '../../data/story-intros'

/** 已通关一次的存档（有它才有「转身，离开」；没给 lastWinBuild → 隐藏boss 那轮跳过） */
function seededStorage() {
    const map = new Map<string, string>()
    map.set(
        META_SAVE_KEY,
        JSON.stringify({
            schemaVersion: 1,
            runs: 1,
            clears: 1,
            loopClears: 1,
            trueEndingDone: false,
            bossWins: 0,
            bossLosses: 0,
            lastWinEnding: 'loop',
        }),
    )
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
    }
}

/** 一路点下去：见到「转身，离开。」就点它，否则点第一项 */
function drive(): number {
    let turns = 0
    const store = () => useRogueliteStore.getState()
    while (!store().gameState?.finished && turns++ < 900) {
        const rounds = store().gameState?.rounds ?? []
        const round = rounds[rounds.length - 1]
        if (!round || round.choices.length === 0) break
        const leave = round.choices.findIndex((c) => c.label === '转身，离开。')
        store().select(leave >= 0 ? leave : 0)
    }
    return turns
}

describe('真结局 · 终章页（store 层）', () => {
    beforeEach(() => {
        battle.playerWins = true
        setMetaStorage(seededStorage())
        // reset 会新建 RogueliteRun（此时才读存档 → cleared_before）
        useRogueliteStore.getState().reset()
    })

    it('开局记 runs；连点三次「转身，离开。」才写出真结局', () => {
        const store = () => useRogueliteStore.getState()
        store().confirmWorldIntro()
        expect(store().endingSeen).toBe(false)

        drive()

        expect(store().gameState?.finished).toBe(true)
        expect(store().gameState?.flags['ending_true']).toBe(true)
        expect(store().gameState?.flags['leave_step']).toBe(2)
        // 终章页还没读 → 结算页等它读完
        expect(store().endingSeen).toBe(false)

        store().confirmEnding()
        expect(store().endingSeen).toBe(true)

        const meta = loadMeta()
        expect(meta.runs).toBe(2)
        expect(meta.clears).toBe(2)
        expect(meta.trueEndingDone).toBe(true)
        expect(meta.lastWinEnding).toBe('true')
    })

    it('结局显示名：得魁 / 带着遗憾向前 / 陨落于山腹 / 胜败乃兵家常事', () => {
        expect(ENDING_NAMES.loop).toBe('得魁')
        expect(ENDING_NAMES.true).toBe('带着遗憾向前')
        expect(ENDING_NAME_FALLEN).toBe('陨落于山腹')
        expect(ENDING_NAME_DEFAULT).toBe('胜败乃兵家常事')
    })

    it('终章页文案：终章 / 会长 / 讲的是接任后从炁印里知道的来龙去脉', () => {
        expect(TRUE_ENDING_EPILOGUE.kicker).toBe('终章')
        expect(TRUE_ENDING_EPILOGUE.title).toBe('会长')
        expect(TRUE_ENDING_EPILOGUE.text).toContain('炁印')
        expect(TRUE_ENDING_EPILOGUE.text).toContain('钟声')
        expect(TRUE_ENDING_EPILOGUE.text.length).toBeGreaterThan(150)
    })

    it('新开一局后终章页重新待读', () => {
        const store = () => useRogueliteStore.getState()
        store().confirmEnding()
        expect(store().endingSeen).toBe(true)
        store().reset()
        expect(store().endingSeen).toBe(false)
    })
})
