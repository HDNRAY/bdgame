/**
 * 教学观战轮的观战文案（`RogueliteScreen.renderRound` 的教学分支）。
 *
 * 背景：观战轮的 `description`（各线新写的教程文案）以前只在轮到进 history、由 `RoundCard`
 * 渲染时才看得到；观战当下看不到。这里断言它被补进观战区，且**与机制提示并存**：
 *   - 有 description → 渲染 `.rs-tutorial-desc`（在 `.rs-tutorial-note` 之前）
 *   - 缺 description → 不渲染空块（没有 `.rs-tutorial-desc`），机制提示照旧
 *   - 其它轮次（场景/选项轮）→ 完全不出现 `.rs-tutorial-bar`
 *
 * 无 jsdom：renderToStaticMarkup（口径同 run-summary.test.tsx）；数据用真跑一局到观战轮。
 * 变异验证：把 description 那段从教学分支删掉 → 第一条断言必须变红。
 */
import type { ReactNode } from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { useRogueliteStore } from '../stores/roguelite-store'
import { setMetaStorage } from '../../game/meta-save'
import { RogueliteScreen } from '../screens/RogueliteScreen/RogueliteScreen'

vi.mock('../components/ui/Tooltip/Tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

beforeAll(() => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
})
afterAll(() => {
    vi.unstubAllGlobals()
})

beforeEach(() => {
    setMetaStorage(null)
    useRogueliteStore.getState().reset()
    useRogueliteStore.getState().confirmWorldIntro()
    useRogueliteStore.getState().confirmChapterIntro()
})

/** 一路选第一项，直到当前轮是教学观战轮（或没得选） */
function driveToTutorial(): void {
    const store = () => useRogueliteStore.getState()
    for (let i = 0; i < 40; i++) {
        const gs = store().gameState!
        const cur = gs.rounds[gs.rounds.length - 1]
        if (!cur) break
        if (cur.tutorial) return
        if (cur.choices.length === 0) break
        store().select(0)
    }
}

function currentRound() {
    const gs = useRogueliteStore.getState().gameState!
    return gs.rounds[gs.rounds.length - 1]
}

function renderScreen(): string {
    Object.assign(useRogueliteStore.getInitialState(), useRogueliteStore.getState())
    return renderToStaticMarkup(
        <MemoryRouter>
            <RogueliteScreen />
        </MemoryRouter>,
    )
}

describe('教学观战轮的观战文案', () => {
    it('观战当下就能读到 description，且与「不计胜负」机制提示并存（文案在前、提示在后）', () => {
        driveToTutorial()
        const round = currentRound()
        expect(round.tutorial).toBeTruthy()
        expect(round.description).toBeTruthy()

        const html = renderScreen()
        const descAt = html.indexOf('rs-tutorial-desc')
        const noteAt = html.indexOf('rs-tutorial-note')
        expect(descAt).toBeGreaterThan(-1)
        expect(noteAt).toBeGreaterThan(descAt)
        // 文案与机制提示两句都在
        expect(html).toContain(round.description!)
        expect(html).toContain('教学观战：')
        expect(html).toContain('AI 对局演示，不计胜负')
    })

    it('description 缺失时不渲染空块（机制提示照旧）', () => {
        driveToTutorial()
        const gs = useRogueliteStore.getState().gameState!
        const last = gs.rounds.length - 1
        useRogueliteStore.setState({
            gameState: {
                ...gs,
                rounds: gs.rounds.map((r, i) => (i === last ? { ...r, description: undefined } : r)),
            },
        })
        const html = renderScreen()
        expect(html).not.toContain('rs-tutorial-desc')
        expect(html).toContain('rs-tutorial-note')
        expect(html).toContain('教学观战：')
    })

    it('观战之后的普通选项轮不出现教学观战块', () => {
        driveToTutorial()
        useRogueliteStore.getState().select(0) // 观战轮的「继续」→ 场景轮
        replaceInitialState()
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <RogueliteScreen />
            </MemoryRouter>,
        )
        expect(currentRound().tutorial).toBeFalsy()
        expect(html).not.toContain('rs-tutorial-bar')
        expect(html).not.toContain('教学观战')
    })
})

/** 只同步 zustand 的 SSR 初始快照（与 renderScreen 内部同一步） */
function replaceInitialState(): void {
    Object.assign(useRogueliteStore.getInitialState(), useRogueliteStore.getState())
}
