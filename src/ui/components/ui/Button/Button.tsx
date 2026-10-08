import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.scss'

/**
 * Button — 通用按钮原子组件（完整契约见 Button.scss 顶部注释，两处必须同步）
 *
 * 变体（用途）：default=面板底上的常规动作；plain=页面底上的常规动作；
 * primary=实心强调主行动；ghost=透明底描边的次级动作；bare=无描边实体小块（工具条图标）。
 * 尺寸（用途）：xs=面板内紧凑图标 / 色块；sm=面板内动作；md=常规动作；lg=竖屏第一屏主入口。
 * 触摸目标 ≥44×44 是 H5 硬口径，由调用页在主要动作上补 `min-height: max(44px, …)` 保证
 * （范例 ModeSelect.scss 的 -btn-main / -btn-sm），Button 的尺寸档只管排版尺寸。
 *
 * 已迁：mode-select、character-panel、run-summary、selection-panel 返回键、battle-screen 顶栏、
 * meta-panel、pixel-editor 一族、settings、gameplay-modal、roguelite 退出键、tournament-sim、
 * log-panel / controls-bar 的 `.ctrl-btn`（用 bare 变体）。
 * 未迁（见各自的 scss 注释）：`pixel-editor-swatch-tools button`（字体是 UA 默认 13.3333px Arial，
 * 保零视觉要把魔法值写回残差）、`.card-build-btn`（是 `<button class="card">` 内部的 `<span>`，
 * 换成 button 会嵌套按钮）、`.card` 与各 tab / 选择项（卡片与导航语义，不是按钮）、
 * `<summary>` 折叠标题（不是 button）。
 *
 * API：不造新属性 —— variant / size / className（追加在 btn 类之后）之外，其余 `<button>` 原生
 * 属性（type / disabled / title / onClick / aria-* …）全部由 rest 透传。没有调用点需要 ref 或
 * fullWidth：需要撑满就由页面 scss 给 width / flex。
 */

/** 配色：default=面板底，plain=页面底，primary=实心强调，ghost=透明底描边，bare=无描边实体小块 */
export type ButtonVariant = 'default' | 'plain' | 'primary' | 'ghost' | 'bare'
/** 尺寸：xs=面板内紧凑（10px 小字族），sm=面板内动作，md=常规，lg=大号 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    children: ReactNode
}

export function Button({
    variant = 'default',
    size = 'md',
    className = '',
    children,
    ...rest
}: ButtonProps) {
    return (
        <button className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`} {...rest}>
            {children}
        </button>
    )
}
