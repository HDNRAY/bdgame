/**
 * DevMode tab 回归：
 *  1. 「单挑模式」（原首页入口）在 tab 列表里，且紧跟在「构筑试炼」之后；
 *  2. `?tab=duel` 确实渲染出选人面板 —— 原来从首页点进去能干的事，现在从这里一样能干；
 *  3. `?tab=summary`（结算页）没有真局时用确定性样例渲染与真局同一个组件，并标出「样例数据」。
 *
 * tab 顺序按 nav 里的按钮文字逐个比对（不是「包含」）：把单挑模式挪走 / 删掉 / 排到别处都会红。
 */
import type { ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { DevMode } from './DevMode'

// Tooltip 走 createPortal 挂到 document.body，SSR 里没有 document；这里只保留子节点
// （与 weapon-generic-art.test.tsx 同一处理，免得 tab 正文的 Tooltip 把静态渲染带崩）
vi.mock('../../components/ui/Tooltip/Tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

beforeAll(() => {
    // node 环境没有 window；SelectionPanel 的主题判定会读 window.matchMedia
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
})
afterAll(() => {
    vi.unstubAllGlobals()
})

/** 渲染某个 tab（默认 tab 是像素图测试，这里显式指定） */
function renderDev(tab: string): string {
    return renderToStaticMarkup(
        <MemoryRouter initialEntries={[`/dev?tab=${tab}`]}>
            <DevMode />
        </MemoryRouter>,
    )
}

/** 取出左侧 tab 栏的按钮文字（正文里出现同名文字不影响顺序断言） */
function navLabels(html: string): string[] {
    const start = html.indexOf('dev-mode-nav')
    const end = html.indexOf('dev-mode-content')
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    const nav = html.slice(start, end)
    return [...nav.matchAll(/dev-mode-nav-item[^>]*>([^<]*)</g)].map((m) => m[1])
}

describe('DevMode tab 列表', () => {
    it('单挑模式紧跟在构筑试炼之后', () => {
        expect(navLabels(renderDev('weapon'))).toEqual([
            '像素图测试',
            '像素编辑器',
            '构筑试炼',
            '单挑模式',
            '大会模拟',
            '元进度',
            '招式对比',
            '武器对比',
            '结算页',
        ])
    })

    it('单挑模式 tab 渲染选人面板（原首页入口的同一套功能）', () => {
        const html = renderDev('duel')
        expect(html).toContain('选择对战双方')
        expect(html).toContain('开始战斗')
        // 选人面板里点「备战」仍走 /build/:charId 路由
        expect(html).toContain('备战')
    })

    it('结算页 tab 没有真局时用样例数据渲染同一个结算页', () => {
        const html = renderDev('summary')
        // 与真局同一个组件：结局名 / 战绩 / 最终构筑 / 战斗统计 / 结算按钮
        expect(html).toContain('本局结算')
        expect(html).toContain('最终构筑')
        expect(html).toContain('本局战斗统计')
        expect(html).toContain('再来一局')
        expect(html).toContain('返回主菜单')
        expect(html).toContain('<b>12</b> 场战斗')
        // 样例必须在页面上标出来，免得被当成真局
        expect(html).toContain('样例数据')
    })
})
