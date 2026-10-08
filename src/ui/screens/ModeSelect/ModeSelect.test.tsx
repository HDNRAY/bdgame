/**
 * 首页（模式选择）回归：
 *  1. 主按钮就是「进入故事」四个字 —— 按钮内不再有副标题 / 说明；
 *  2. 页首标题与底部那排入口（图鉴 / 玩法 / 设置 / 关于）都还在；
 *  3. 「肉鸽模式」「开发中」「单挑模式」等旧字样不再出现。
 *
 * 断言只看**渲染出来的 DOM 文本**（不看源码）：把副标题加回按钮里、
 * 删掉底部任意一个入口、或退回旧按钮文案，这里立刻红。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ModeSelect } from './ModeSelect'

beforeAll(() => {
    // node 环境没有 window；主题为 'system' 时会读 window.matchMedia（与其它 SSR 测试同一处理）
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
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

/** 主入口按钮的按钮内文字（按钮里若嵌套了标签，一并取出来） */
function mainButtonText(html: string): string {
    const matched = html.match(/<button class="mode-select-btn mode-select-btn-main">([\s\S]*?)<\/button>/)
    if (!matched) throw new Error('渲染结果里没有「进入故事」主按钮')
    return domText(matched[1])
}

describe('首页模式选择', () => {
    it('主按钮文字恰好是「进入故事」，按钮内没有副标题 / 说明', () => {
        const html = renderHome()
        expect(mainButtonText(html)).toBe('进入故事')
        // 主入口只有一个（旧的「单挑模式」主按钮没有回来）
        expect(html.match(/mode-select-btn-main/g) ?? []).toHaveLength(1)
    })

    it('底部那排入口（图鉴 / 玩法 / 设置 / 关于）都还在', () => {
        const text = domText(renderHome())
        for (const label of ['图鉴', '玩法', '设置', '关于']) expect(text).toContain(label)
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
