// ════════════════════════════════════════
//  BottomBar — 常驻底栏（图鉴 / 玩法 / 设置 / 关于）
//
//  挂在 `<Routes>` 之外（见 src/App.tsx），所以出现在**所有路由**上、永不隐藏，
//  包括战斗 / 结算 / DevMode / 故事开场与章页。任何时候都能一键调字号、主题。
//
//  口径（见 docs/superpowers/specs/2026-10-09-bottom-footer-design.md）：
//   - 四项**纯文字、无边框、无图标**；
//   - 开合状态是**单值** `active`：天然实现「开着 A 直接切 B」「再点当前项关掉」；
//   - 浏览器后退（pathname 变化）→ 关掉弹层（弹层不跳路由、不暂停游戏）；
//   - 弹层是**弹层**不是路由：`/settings`、`/about`、`/encyclopedia` 三条深链接照旧完整渲染。
//
//  激活态（D2 + spec §9-3）：图鉴项按「全屏层开着 或 当前路由就是 /encyclopedia」，
//  其余三项按「自己的弹层正开着」。三项弹窗入口给 `aria-haspopup="dialog"`，
//  图鉴给 `aria-pressed`（它是全屏层，不是对话框）。底栏本身**不是** modal —— 不写 aria-modal。
// ════════════════════════════════════════

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BottomPopups, type BottomPopupKey } from './BottomPopups'
import './BottomBar.scss'

/** 四个入口（沿用首页原有顺序） */
const ENTRIES: { key: BottomPopupKey; label: string }[] = [
    { key: 'encyclopedia', label: '图鉴' },
    { key: 'gameplay', label: '玩法' },
    { key: 'settings', label: '设置' },
    { key: 'about', label: '关于' },
]

/** 路由深链接对应的入口（用来点亮激活态；不阻止路由页照旧渲染） */
const ROUTE_TO_ENTRY: Record<string, BottomPopupKey> = {
    '/encyclopedia': 'encyclopedia',
    '/settings': 'settings',
    '/about': 'about',
}

export function BottomBar() {
    /**
     * 开合状态：**单值** + 打开时的 pathname 快照。
     * 快照用来实现「浏览器后退 / 路由变化 → 关掉弹层」而**不在 effect 里 setState**
     * （`react-hooks/set-state-in-effect` 是 error 级）：pathname 变了，这个单值就自己失效，
     * 不需要任何清理 effect，弹层也不会自己写历史。
     */
    const [opened, setOpened] = useState<{ key: BottomPopupKey; at: string } | null>(null)
    const { pathname } = useLocation()
    const active = opened && opened.at === pathname ? opened.key : null

    const routeEntry = ROUTE_TO_ENTRY[pathname] ?? null

    /** 某一项是否处于激活态：图鉴 = 层开着或路由就在图鉴；其余 = 自己的层开着 */
    function isPressed(key: BottomPopupKey): boolean {
        if (key === 'encyclopedia') return active === 'encyclopedia' || routeEntry === 'encyclopedia'
        return active === key
    }

    return (
        <>
            <nav className="bottom-bar" aria-label="全局入口">
                {ENTRIES.map((e) => {
                    const pressed = isPressed(e.key)
                    return (
                        <button
                            key={e.key}
                            type="button"
                            className={`bottom-bar-item${pressed ? ' active' : ''}`}
                            aria-haspopup={e.key === 'encyclopedia' ? undefined : 'dialog'}
                            aria-pressed={e.key === 'encyclopedia' ? pressed : undefined}
                            onClick={() => setOpened((cur) => (cur?.key === e.key ? null : { key: e.key, at: pathname }))}
                        >
                            {e.label}
                        </button>
                    )
                })}
            </nav>
            <BottomPopups active={active} onClose={() => setOpened(null)} />
        </>
    )
}
