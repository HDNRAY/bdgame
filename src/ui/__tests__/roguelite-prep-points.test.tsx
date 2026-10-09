/**
 * 修炼点的显示位置（`RogueliteScreen`）：从 rs-header 移到「备战」按钮旁边。
 *
 * 无 jsdom，口径同 `run-summary.test.tsx`：renderToStaticMarkup + Tooltip 只渲染子节点。
 * 断言两件事：header 里不再有修炼点；它出现在 `rs-prep-row`（备战那一行）里，
 * 且 0 点时仍带 `rs-points-zero`（灰，历史口径不变）。
 *
 * 变异验证：把它挪回 header → 第一条断言必须变红。
 */
import type { ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { useRogueliteStore } from '../stores/roguelite-store'
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

/** 渲染指定节点 / 剩余修炼点的 RogueliteScreen（已选故事线，侧栏在） */
function renderAt(nodeIndex: number, unspentPoints: number): string {
    useRogueliteStore.getState().reset()
    const gs = useRogueliteStore.getState().gameState!
    useRogueliteStore.setState({
        worldIntroShown: true,
        chapterIntro: null,
        gameState: {
            ...gs,
            nodeIndex,
            unspentPoints,
            build: { ...gs.build, story: 'sect' },
        },
    })
    // zustand 的 SSR 快照读 getInitialState()，先把当前状态同步回去
    Object.assign(useRogueliteStore.getInitialState(), useRogueliteStore.getState())
    const html = renderToStaticMarkup(
        <MemoryRouter>
            <RogueliteScreen />
        </MemoryRouter>,
    )
    useRogueliteStore.getState().reset()
    return html
}

describe('修炼点显示位置', () => {
    it('在「备战」旁边，不在 header 里；0 点仍走零值灰', () => {
        const html = renderAt(10, 5)

        // header 段（到 rs-body 之前）里不再有修炼点
        const header = html.slice(html.indexOf('class="rs-header"'), html.indexOf('class="rs-body"'))
        expect(header).not.toContain('修炼点')

        // 备战那一行里才有，且跟在备战按钮后面
        expect(html).toContain('rs-prep-row')
        const prepAt = html.indexOf('rs-prep-btn')
        const pointsAt = html.indexOf('rs-points')
        expect(prepAt).toBeGreaterThan(-1)
        expect(pointsAt).toBeGreaterThan(prepAt)
        expect(html).toContain('修炼点 5')

        // 0 点仍是灰的（历史口径：rs-points-zero）
        expect(renderAt(10, 0)).toMatch(/class="rs-points rs-points-zero"/)
    })
})
