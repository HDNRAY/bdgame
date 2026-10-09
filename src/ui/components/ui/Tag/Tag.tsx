import type { Tag as TagType } from '../../../../engine/entities/tag'
import { TAG_CN } from '../../../../bridge/tagDisplay'
import './Tag.scss'

interface TagProps {
    tag: TagType
    /** 可选点击事件 */
    onClick?: () => void
}

/**
 * 标签徽章。
 *
 * 颜色不内联：两套主题各有一套标签色（53 条），定义在 themes.css 的
 * `--tag-color-<tag>`，随 [data-theme] 自动切换（色位见 docs/ui-color-system.md 第 7 节）。
 * 这里只把变量名接上去；未登记的 tag 回落到 --color-text-dim。
 */
export function Tag({ tag, onClick }: TagProps) {
    const label = TAG_CN[tag] ?? tag
    const color = `var(--tag-color-${tag}, var(--color-text-dim))`
    return (
        <span
            className="tag-badge"
            style={{ borderColor: color, color }}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {label}
        </span>
    )
}
