import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import './SearchSelect.scss'

export interface SelectOption<T extends string | number> {
    value: T
    label: string
    /** 分组名（同组渲染在同一个标题下，保持首次出现顺序） */
    group?: string
    /** 右侧浅色补充说明 */
    hint?: string
}

interface SearchSelectProps<T extends string | number> {
    value: T
    options: SelectOption<T>[]
    onChange: (value: T) => void
    disabled?: boolean
    className?: string
    title?: string
    /** 展开后搜索框的占位文案 */
    searchPlaceholder?: string
    /** 无匹配项文案 */
    noMatchText?: string
    /** 无当前值（且没有匹配项）时的占位文案 */
    emptyText?: string
}

const Z_INDEX = 10000

/**
 * 可搜索下拉：输入框内直接过滤，必须选中一项才算数。
 * - 输入只用于过滤，不会提交任意文本（无匹配时回车无效）
 * - 点旁边 / Esc / Tab 离开 = 取消，保持原值不变
 * - 键盘：上下移动高亮、回车选中
 */
export function SearchSelect<T extends string | number>({
    value,
    options,
    onChange,
    disabled = false,
    className,
    title,
    searchPlaceholder = '输入以搜索…',
    noMatchText = '无匹配项',
    emptyText = '未选择',
}: SearchSelectProps<T>) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [hl, setHl] = useState(0)
    const [pos, setPos] = useState<CSSProperties>({})

    const wrapRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const popRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    const current = options.find((o) => o.value === value)

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter((o) => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q))
    }, [options, query])

    /** 分组渲染；分组不改变顺序，所以 filtered[k] 就是第 k 个渲染项 */
    const groups = useMemo(() => {
        const map = new Map<string, SelectOption<T>[]>()
        for (const o of filtered) {
            const key = o.group ?? ''
            const arr = map.get(key)
            if (arr) arr.push(o)
            else map.set(key, [o])
        }
        return [...map.entries()]
    }, [filtered])

    const updatePos = useCallback(() => {
        if (!wrapRef.current || !popRef.current) return
        computePosition(wrapRef.current, popRef.current, {
            placement: 'bottom-start',
            strategy: 'fixed',
            middleware: [
                offset(4),
                flip({ padding: 8 }),
                shift({ padding: 8 }),
                size({
                    padding: 8,
                    apply({ rects, availableHeight, elements }) {
                        elements.floating.style.minWidth = `${rects.reference.width}px`
                        elements.floating.style.maxHeight = `${Math.max(96, availableHeight)}px`
                    },
                }),
            ],
        }).then(({ x, y }) => setPos({ left: x, top: y }))
    }, [])

    const openList = useCallback(() => {
        if (disabled) return
        setQuery('')
        setHl(Math.max(0, options.findIndex((o) => o.value === value)))
        setOpen(true)
    }, [disabled, options, value])

    /** 取消：不提交，保持原值 */
    const cancel = useCallback(() => {
        setOpen(false)
        setQuery('')
    }, [])

    const commit = useCallback(
        (next: T) => {
            onChange(next)
            setOpen(false)
            setQuery('')
        },
        [onChange],
    )

    // 展开后定位 + 聚焦搜索框
    useEffect(() => {
        if (!open) return
        requestAnimationFrame(() => {
            updatePos()
            inputRef.current?.focus()
        })
    }, [open, updatePos])

    // 跟随滚动/缩放重新定位
    useEffect(() => {
        if (!open) return
        const onMove = () => updatePos()
        window.addEventListener('resize', onMove)
        window.addEventListener('scroll', onMove, true)
        return () => {
            window.removeEventListener('resize', onMove)
            window.removeEventListener('scroll', onMove, true)
        }
    }, [open, updatePos])

    // 点旁边 = 取消
    useEffect(() => {
        if (!open) return
        const onPointerDown = (e: PointerEvent) => {
            const t = e.target as Node | null
            if (!t) return
            if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
            cancel()
        }
        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [open, cancel])

    // 高亮项滚入可视区
    useEffect(() => {
        if (!open) return
        const el = listRef.current?.querySelector('.ss-item-hl')
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
    }, [open, hl, filtered.length])

    const move = (step: number) => {
        if (filtered.length === 0) return
        setHl((i) => (i + step + filtered.length) % filtered.length)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') openList()
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            move(1)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            move(-1)
        } else if (e.key === 'Enter') {
            e.preventDefault()
            const picked = filtered[hl]
            if (picked) commit(picked.value)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
        }
    }

    let flatIndex = -1

    return (
        <div className={`ss${disabled ? ' ss-disabled' : ''}${className ? ` ${className}` : ''}`} ref={wrapRef}>
            <input
                ref={inputRef}
                className="ss-input"
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                title={title}
                disabled={disabled}
                readOnly={!open}
                value={open ? query : (current?.label ?? '')}
                placeholder={open ? searchPlaceholder : (current?.label ?? emptyText)}
                onChange={(e) => {
                    setQuery(e.target.value)
                    setHl(0)
                }}
                onFocus={openList}
                onClick={() => {
                    if (!open) openList()
                }}
                onKeyDown={onKeyDown}
                onBlur={() => {
                    // 焦点离开（Tab / 点别处）→ 取消；点选项不会触发（弹层 mousedown 已 preventDefault）
                    if (open) cancel()
                }}
            />
            <span className="ss-caret" aria-hidden="true" />
            {open &&
                createPortal(
                    <div
                        className="ss-pop"
                        ref={popRef}
                        style={{ ...pos, position: 'fixed', zIndex: Z_INDEX }}
                        // 阻止 mousedown 夺走输入框焦点：否则 onBlur 会先取消、点击选项反而落空
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        <div className="ss-list" role="listbox" ref={listRef}>
                            {filtered.length === 0 && <div className="ss-empty">{noMatchText}</div>}
                            {groups.map(([group, items]) => (
                                <div key={group || '_'} className="ss-group">
                                    {group && <div className="ss-group-title">{group}</div>}
                                    {items.map((o) => {
                                        flatIndex++
                                        const idx = flatIndex
                                        return (
                                            <div
                                                key={`${group}/${String(o.value)}`}
                                                role="option"
                                                aria-selected={o.value === value}
                                                className={`ss-item${idx === hl ? ' ss-item-hl' : ''}${
                                                    o.value === value ? ' ss-item-cur' : ''
                                                }`}
                                                onMouseMove={() => setHl(idx)}
                                                onClick={() => commit(o.value)}
                                            >
                                                <span className="ss-item-label">{o.label}</span>
                                                {o.hint && <span className="ss-item-hint">{o.hint}</span>}
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    )
}
