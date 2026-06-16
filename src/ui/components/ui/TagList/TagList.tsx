import type { Tag as TagType } from '../../../../engine/entities/tag'
import { Tag } from '../Tag/Tag'
import './TagList.scss'

interface TagListProps {
    tags: TagType[]
}

/** 标签列表行 — 将 Tag 数组渲染为一行徽章 */
export function TagList({ tags }: TagListProps) {
    if (tags.length === 0) return null
    return (
        <div className="tag-list">
            {tags.map((t) => (
                <Tag key={t} tag={t} />
            ))}
        </div>
    )
}
