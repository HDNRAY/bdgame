/**
 * 常驻底栏（`BottomBar`）与它的四个弹层（`BottomPopups`）回归。
 *
 * 无 jsdom，渲染口径与 `tournament-panel.test.tsx` / `run-summary.test.tsx` 一致：
 * `renderToStaticMarkup`（useEffect 不跑，所以真正的 Esc / 焦点行为测不到 —— 见下）。
 *
 * 覆盖点：
 *   1. 底栏四项恰为 图鉴 / 玩法 / 设置 / 关于，纯文字、无 emoji；
 *   2. 语义：三个弹窗入口 `aria-haspopup="dialog"`，图鉴用 `aria-pressed`；
 *   3. 激活态：图鉴项按「层开着 或 路由是 /encyclopedia」点亮（`aria-pressed` + `.active`）；
 *   4. `BottomPopups`：打开哪一项就渲染哪个屏幕的关键文案；`null` 时什么都不渲染；
 *   5. 图鉴嵌屏：弹层里关掉搜索框 `autoFocus`（嵌入态），独立路由页保留。
 *
 * **明说测不到**（SSR 不跑 useEffect、没有布局）：Esc 关闭、点背景关闭、焦点归还、
 * 实际高度、触摸目标尺寸、真实点击开合。这些靠 `scripts/ui-geometry.mjs` 与浏览器目视。
 *
 * 变异验证：把 `aria-pressed` 写死 `false`（或删掉 `isPressed` 对 `routeEntry` 的判断），
 * 第 3 条必须变红；把 `autoFocus={!embedded}` 改成 `autoFocus`，第 5 条必须变红。
 */
import type { ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { BottomBar } from './BottomBar'
import { BottomPopups } from './BottomPopups'
import { useAppStore } from '../../../stores/app-store'
import { EncyclopediaScreen } from '../../../screens/EncyclopediaScreen/EncyclopediaScreen'

// 图鉴卡片里的 tooltip 走 createPortal(document.body)，node 环境没有 document；
// 与 tournament-panel.test.tsx 同一处理：只渲染子节点。
vi.mock('../../ui/Tooltip/Tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

beforeAll(() => {
    // node 环境没有 window / localStorage：主题与 uiScale 的持久化会读 localStorage
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
    useAppStore.getState().setTheme('light')
})
afterAll(() => {
    vi.unstubAllGlobals()
})

/** 渲染结果里的可见文本（去掉标签与属性，压平空白） */
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

/** 底栏四项（按 DOM 顺序，取每个按钮的文字） */
function barLabels(html: string): string[] {
    const bar = html.slice(html.indexOf('bottom-bar'), html.indexOf('</nav>'))
    return buttons(bar).map((b) => b.text)
}

/** 某个入口按钮的完整开标签 */
function barButton(html: string, label: string): { attrs: string; text: string } {
    const found = buttons(html).filter((b) => b.text === label)
    if (found.length !== 1) throw new Error(`底栏里「${label}」应有且仅有一个按钮，实际 ${found.length} 个`)
    return found[0]
}

function renderBar(path = '/'): string {
    return renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
            <BottomBar />
        </MemoryRouter>,
    )
}

function renderPopups(active: 'encyclopedia' | 'gameplay' | 'settings' | 'about' | null): string {
    return renderToStaticMarkup(
        <MemoryRouter initialEntries={['/']}>
            <BottomPopups active={active} onClose={() => {}} />
        </MemoryRouter>,
    )
}

describe('常驻底栏', () => {
    it('四项恰为 图鉴 / 玩法 / 设置 / 关于（纯文字）', () => {
        expect(barLabels(renderBar())).toEqual(['图鉴', '玩法', '设置', '关于'])
    })

    it('渲染结果里没有 emoji（AGENTS.md 禁令）', () => {
        expect(renderBar()).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    })

    it('三个弹窗入口给 aria-haspopup="dialog"，图鉴给 aria-pressed', () => {
        const html = renderBar()
        for (const label of ['玩法', '设置', '关于']) {
            expect(barButton(html, label).attrs).toContain('aria-haspopup="dialog"')
            expect(barButton(html, label).attrs).not.toContain('aria-pressed')
        }
        expect(barButton(html, '图鉴').attrs).toContain('aria-pressed')
        expect(barButton(html, '图鉴').attrs).not.toContain('aria-haspopup')
    })

    it('默认（没开层、路由是首页）四项都不处于激活态', () => {
        const html = renderBar('/')
        for (const label of ['图鉴', '玩法', '设置', '关于']) {
            expect(barButton(html, label).attrs).not.toContain('aria-pressed="true"')
            expect(barButton(html, label).attrs).not.toContain('active')
        }
    })

    it('路由是 /encyclopedia 时图鉴项点亮（aria-pressed="true" + active）', () => {
        const html = renderBar('/encyclopedia')
        const ency = barButton(html, '图鉴')
        expect(ency.attrs).toContain('aria-pressed="true"')
        expect(ency.attrs).toContain('active')
        // 其余三项仍然不亮：路由不点亮它们
        for (const label of ['玩法', '设置', '关于']) {
            expect(barButton(html, label).attrs).not.toContain('active')
        }
    })

    it('路由是 /settings 时**不**点亮设置项（激活态只认「层开着」，图鉴额外认路由）', () => {
        const html = renderBar('/settings')
        expect(barButton(html, '设置').attrs).not.toContain('active')
        expect(barButton(html, '图鉴').attrs).not.toContain('aria-pressed="true"')
    })
})

describe('底栏四个弹层', () => {
    it('全关时什么都不渲染', () => {
        expect(renderPopups(null)).toBe('')
    })

    it('打开设置 → 设置弹窗 + 设置屏内容', () => {
        const html = renderPopups('settings')
        expect(html).toContain('role="dialog"')
        expect(domText(html)).toContain('UI 缩放')
        expect(domText(html)).toContain('逐字显示')
    })

    it('打开关于 → 关于弹窗 + 关于屏内容', () => {
        const html = renderPopups('about')
        expect(html).toContain('role="dialog"')
        expect(domText(html)).toContain('赛博朋克 + 炼炁士 主题 1v1 肉鸽')
    })

    it('打开玩法 → 玩法弹窗（共用的 Modal 外壳）+ 玩法正文与「知道了」', () => {
        const html = renderPopups('gameplay')
        expect(html).toContain('role="dialog"')
        expect(domText(html)).toContain('对战玩法')
        expect(domText(html)).toContain('数值公式')
        expect(buttons(html).some((b) => b.text === '知道了')).toBe(true)
    })

    it('打开图鉴 → fullscreen 变体 + 图鉴屏内容', () => {
        const html = renderPopups('encyclopedia')
        expect(html).toContain('role="dialog"')
        expect(html).toContain('modal-panel-fullscreen')
        expect(html).toContain('placeholder="搜索名字、描述、标签…"')
    })

    it('设置弹层的主题选项不再带 emoji（太阳 / 月亮 / 手提电脑）', () => {
        const html = renderPopups('settings')
        expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
        for (const label of ['浅色', '深色', '系统']) expect(domText(html)).toContain(label)
    })
})

describe('图鉴嵌屏的搜索框 autoFocus', () => {
    it('嵌进弹层时不自动聚焦（避免移动端一打开就弹软键盘）', () => {
        const html = renderPopups('encyclopedia')
        expect(html).toContain('encyclopedia-search-input')
        expect(html).not.toContain('autofocus')
    })

    it('独立路由页仍然自动聚焦', () => {
        const html = renderToStaticMarkup(
            <MemoryRouter initialEntries={['/encyclopedia']}>
                <EncyclopediaScreen />
            </MemoryRouter>,
        )
        expect(html).toContain('autofocus')
    })
})
