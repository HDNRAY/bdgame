/**
 * 首页（模式选择）回归：
 *  1. 主按钮就是「进入故事」四个字 —— 按钮内不再有副标题 / 说明；
 *  2. 页首标题还在，而底部那排入口（图鉴 / 玩法 / 设置 / 关于）**已搬走** ——
 *     它们现在是常驻底栏（`src/ui/components/layouts/BottomBar/`），断言移入 `BottomBar.test.tsx`；
 *  3. 「肉鸽模式」「开发中」「单挑模式」等旧字样不再出现。
 *
 * 断言只看**渲染出来的 DOM 文本**（不看源码）：把副标题加回按钮里、
 * 把四个入口再塞回首页、或退回旧按钮文案，这里立刻红。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ModeSelect } from './ModeSelect'
import { useAppStore } from '../../stores/app-store'

beforeAll(() => {
    // node 环境没有 window；主题为 'system' 时会读 window.matchMedia（与其它 SSR 测试同一处理）
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    // node 环境没有 localStorage：主题与 uiScale 的持久化会读它
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
    useAppStore.getState().setTheme('light')
})
afterAll(() => {
    vi.unstubAllGlobals()
})

/** 首页（MemoryRouter 提供 useNavigate 上下文） */
function renderHome(): string {
    return renderToStaticMarkup(
        <MemoryRouter>
            <ModeSelect />
        </MemoryRouter>,
    )
}

/** 渲染结果里的可见文本（去掉标签与属性，压平空白）—— 判字样只看它，不看源码 */
function domText(html: string): string {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** 渲染结果里所有 <button>（开标签属性 + 按钮内文字） */
function buttons(html: string): { attrs: string; text: string }[] {
    return [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({
        attrs: m[1],
        text: domText(m[2]),
    }))
}

/** 主入口按钮：按**按钮文案**定位，不绑定 class 串（换 Button 组件 / 改类名都不该让它红） */
function mainButton(html: string): { attrs: string; text: string } {
    const found = buttons(html).filter((b) => b.text === '进入故事')
    if (found.length !== 1) throw new Error(`渲染结果里「进入故事」按钮应有且仅有一个，实际 ${found.length} 个`)
    return found[0]
}

describe('首页模式选择', () => {
    it('主按钮文字恰好是「进入故事」，按钮内没有副标题 / 说明', () => {
        const html = renderHome()
        // 主入口只有一个（旧的「单挑模式」主按钮没有回来）
        expect(mainButton(html).text).toBe('进入故事')
    })

    it('底部那排入口已搬去常驻底栏：首页不再自带「图鉴 / 玩法 / 设置 / 关于」', () => {
        const html = renderHome()
        const all = buttons(html)
        // 有文字的按钮只剩一个：主入口「进入故事」（四条入口按钮整体搬走了）。
        // 无文字的还有 /dev 那块透明热区（构建时开启 dev 才渲染），不参与这条断言。
        const withText = all.filter((b) => b.text !== '')
        expect(withText).toHaveLength(1)
        expect(withText[0].text).toBe('进入故事')
        for (const label of ['图鉴', '玩法', '设置', '关于']) {
            expect(all.some((b) => b.text === label)).toBe(false)
        }
    })

    it('页首标题还在（结构）', () => {
        expect(renderHome()).toContain('mode-select-title')
    })

    it('不再出现「肉鸽 / 开发中 / 单挑模式」等旧字样', () => {
        const text = domText(renderHome())
        for (const word of ['肉鸽', '开发中', '敬请期待', '单挑模式', '1v1 快速对决', '故事线 · 逐节点推进']) {
            expect(text).not.toContain(word)
        }
    })
})
