import type { Tag as TagType } from '../../../../engine/entities/tag'
import { TAG_CN, TAG_COLOR } from '../../../../engine/data/tagDisplay'
import './Tag.scss'

interface TagProps {
    tag: TagType
    /** 可选点击事件 */
    onClick?: () => void
}

/** 标签徽章 */
export function Tag({ tag, onClick }: TagProps) {
    const label = TAG_CN[tag] ?? tag
    const color = TAG_COLOR[tag] ?? '#888'
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
