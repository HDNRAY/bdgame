/**
 * 结算页在终局流程里的位置（假战斗：玩家必胜，才能稳定走到真结局）。
 *
 * 顺序：真结局终章（已存在的一页，`TRUE_ENDING_EPILOGUE`）→ 结算页。
 * 合页后只有这两页：终章读完就直接是结算页（战绩 + 最终构筑 + 结算按钮同页），
 * 不再有「对局统计」中间页与 `statsSeen` 中间状态。
 * 假战斗不带 stats，所以结算页也不该出现「本局战斗统计」空块。
 * 同 `run-summary.test.tsx`：静态渲染 + Tooltip 换成只渲染子节点。
 */
import type { ReactNode } from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const battle = vi.hoisted(() => ({ playerWins: true }))

vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_player: unknown, enemy: { id: string }) => ({
        winner: battle.playerWins ? 'player' : enemy.id,
        // 只有回放日志、没有 stats：本局统计为空（覆盖「没数据不摆空块」）
        engine: { state: { log: { getAll: () => [] } } },
    }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))

vi.mock('../components/ui/Tooltip/Tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import { useRogueliteStore } from '../stores/roguelite-store'
import { META_SAVE_KEY, setMetaStorage } from '../../game/meta-save'
import { RogueliteScreen } from '../screens/RogueliteScreen/RogueliteScreen'

beforeAll(() => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
})
afterAll(() => {
    vi.unstubAllGlobals()
})

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
function drive(): void {
    let turns = 0
    const store = () => useRogueliteStore.getState()
    while (!store().gameState?.finished && turns++ < 900) {
        const rounds = store().gameState?.rounds ?? []
        const round = rounds[rounds.length - 1]
        if (!round || round.choices.length === 0) break
        const leave = round.choices.findIndex((c) => c.label === '转身，离开。')
        store().select(leave >= 0 ? leave : 0)
    }
}

/** 渲染 RogueliteScreen（zustand 的 SSR 快照读 getInitialState，先把当前状态同步过去） */
function renderScreen(): string {
    Object.assign(useRogueliteStore.getInitialState(), useRogueliteStore.getState())
    return renderToStaticMarkup(
        <MemoryRouter>
            <RogueliteScreen />
        </MemoryRouter>,
    )
}

describe('结算页在流程里的位置（真结局线）', () => {
    beforeEach(() => {
        battle.playerWins = true
        setMetaStorage(seededStorage())
        useRogueliteStore.getState().reset()
        useRogueliteStore.getState().confirmWorldIntro()
        useRogueliteStore.getState().confirmChapterIntro()
    })

    it('终章 → 结算页，终章还在最前', () => {
        drive()
        const store = () => useRogueliteStore.getState()
        expect(store().gameState?.finished).toBe(true)
        // 这局没有战斗统计（假战斗不产 stats），但战绩数字照常有（引擎在结算处累加）
        expect(store().gameState?.runStats).toBeUndefined()
        const state = store().gameState!
        const battles = state.runBattles!
        expect(battles.total).toBeGreaterThan(0)
        expect(battles.wins + battles.losses).toBe(battles.total)
        // 战绩比「结算时还能看到的回合结果」多：终局那一步把最后一节（n33 决赛 + 终局事件）的
        // rounds 清掉了，所以数回合列表会漏 —— 这正是战绩要在战斗结算处累加的原因。
        const visible = [...state.history, ...state.rounds].filter((r) => r.result).length
        expect(battles.total).toBeGreaterThan(visible)

        // 1. 终章页先盖着（结算内容没把它挤掉）
        const epilogue = renderScreen()
        expect(epilogue).toContain('终章')
        expect(epilogue).not.toContain('最终构筑')
        expect(epilogue).not.toContain('再来一局')

        // 2. 读完终章 → 结算页：一页里同时有战绩、最终构筑与按钮；没有战斗统计就不摆这一块
        store().confirmEnding()
        const finish = renderScreen()
        expect(finish).toContain('本局结算')
        expect(finish).toContain('带着遗憾向前')
        expect(finish).toContain('最终构筑')
        expect(finish).toContain(`<b>${battles.total}</b> 场战斗`)
        expect(finish).toContain('再来一局')
        expect(finish).not.toContain('本局战斗统计')
    })

    it('结算页一步到位：终章之后不再需要点「继续」这类中间步骤', () => {
        drive()
        const store = () => useRogueliteStore.getState()
        store().confirmEnding()

        const finish = renderScreen()
        expect(finish).toContain('再来一局')
        // 中间状态已删：读完终章直接就是结算页
        expect('statsSeen' in store()).toBe(false)
        expect('confirmStats' in store()).toBe(false)
    })
})
