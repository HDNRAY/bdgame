import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.scss'

/**
 * Button — 通用按钮原子组件
 *
 * 背景：全仓约 20 个语义类各自把 `border + border-radius + background + color +
 * font-family + font-size + cursor:pointer` 这 7 个属性重写了一遍（编译后 38 条选择器）。
 * 这里按 variant（配色）× size（内边距/圆角/字号）收敛，语义类只保留布局残差
 * （margin / 个别 padding 差异 / 状态高亮色），不再重复基础七件套。
 *
 * 已迁：about/settings/encyclopedia 的返回键、confirm-dialog、mode-select、character-panel、
 * run-summary、selection-panel 的返回键、battle-screen 顶栏、meta-panel 动作、pixel-editor 一族。
 * 未迁（差异太大，见各自的 scss 注释）：log-panel / controls-bar 的 `.ctrl-btn`
 * （--color-entity-bg + 无描边 + 无圆角，没有匹配变体）、pixel-editor 的 `-swatch-tools button`
 * （字体是 UA 默认）、`<summary>` 折叠标题（不是 button）。
 */

/** 配色：default=面板底，primary=强调，ghost=透明底描边，plain=页面底色 */
export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'plain'
/** 尺寸：xs=最小（10px 小字族），sm=紧凑，md=常规，lg=大号 */
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
