import type { ChangeEvent, ReactNode } from 'react'
import './CompareScreen.scss'

/**
 * CompareScreen — DevMode 对比页的共用脚手架
 *
 * AttackCompare（`.ac*`）与 WeaponCompare（`.wc*`）两页的容器 / 控件行 / 搜索框 /
 * 说明段 / 评分表结构与排版逐条相同，抽到这里由两页共用。
 *
 * 样式必须写在组件自带的 CompareScreen.scss 里（不能只抽一个共用 scss 文件）：
 * 两页是各自的路由级页面，只有加载到本组件的那一页才会把这份样式带进产物。
 */

/** 对比页容器：标题 + 内容（`.cmp`） */
export function CompareScreen({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="cmp">
            <h2>{title}</h2>
            {children}
        </div>
    )
}

/** 控件行（`.cmp-controls`）；页内特有排布用 className 追加修饰类 */
export function CompareControls({ className = '', children }: { className?: string; children: ReactNode }) {
    return <div className={`cmp-controls${className ? ` ${className}` : ''}`}>{children}</div>
}

/** 控件标签（`.cmp-label`）；gap 表示与左邻控件拉开一段距离 */
export function CompareLabel({
    gap = false,
    htmlFor,
    children,
}: {
    gap?: boolean
    htmlFor?: string
    children: ReactNode
}) {
    return (
        <label className={`cmp-label${gap ? ' cmp-label-gap' : ''}`} htmlFor={htmlFor}>
            {children}
        </label>
    )
}

/** 搜索框（`.cmp-search-input`）：本地 state 实时输入，失焦时才由调用方提交（中文 IME 安全） */
export function CompareSearchInput({
    id,
    value,
    placeholder,
    onChange,
    onBlur,
}: {
    id: string
    value: string
    placeholder: string
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
    onBlur?: (e: ChangeEvent<HTMLInputElement>) => void
}) {
    return (
        <input
            id={id}
            className="cmp-search-input"
            type="search"
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            onBlur={onBlur}
        />
    )
}

/** 口径说明段（`.cmp-note`） */
export function CompareNote({ children }: { children: ReactNode }) {
    return <p className="cmp-note">{children}</p>
}

/** 评分表（`.cmp-table`）：表头由 head 传入，表体为 children */
export function CompareTable({ head, children }: { head: ReactNode; children: ReactNode }) {
    return (
        <table className="cmp-table">
            <thead>
                <tr>{head}</tr>
            </thead>
            <tbody>{children}</tbody>
        </table>
    )
}
