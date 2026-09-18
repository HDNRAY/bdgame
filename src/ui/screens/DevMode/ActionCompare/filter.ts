import type { ActionDefinition } from '../../../../engine/entities/action'
import type { Tag } from '../../../../engine/entities/tag'
import { TAG_CN } from '../../../../bridge/tagDisplay'

/**
 * ActionCompare 的筛选纯逻辑（无 React / 无样式依赖，便于直接单测）。
 * 页面只负责把它接到 URL 参数与 UI 上。
 */

/** 前置/后置辅助招不进对比表 */
export function isSupportAction(a: ActionDefinition): boolean {
    return a.tags.includes('pre_action') || a.tags.includes('post_action')
}

/** 候选池：对比页的招式全集（= 传入池去掉前置/后置辅助招） */
export function getCandidateActions(all: ActionDefinition[]): ActionDefinition[] {
    return all.filter((a) => !isSupportAction(a))
}

/** tag 选项：只列候选池里实际出现过的 tag，按 tagDisplay 的中文名排序（zh 排序） */
export function collectTagOptions(pool: ActionDefinition[]): Tag[] {
    const seen = new Set<Tag>()
    for (const a of pool) for (const t of a.tags) seen.add(t)
    return [...seen].sort((x, y) => (TAG_CN[x] ?? x).localeCompare(TAG_CN[y] ?? y, 'zh'))
}

/** 解析 ?tags=a,b：丢弃不在选项集合（候选池实际出现）里的脏值 */
export function parseTagParam(raw: string | null, valid: ReadonlySet<Tag>): Tag[] {
    if (!raw) return []
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is Tag => valid.has(s as Tag))
}

export interface CompareFilters {
    /** AP 档多选；空数组 = 不筛 */
    ap?: number[]
    /** 标签多选（OR：命中任一即保留）；空数组 = 不筛 */
    tags?: Tag[]
    /** 搜索词：匹配 name / id / tag */
    query?: string
}

/** AP × 标签 × 搜索 串联过滤（三者都生效，任一不通过即剔除） */
export function filterActions(
    pool: ActionDefinition[],
    { ap = [], tags = [], query = '' }: CompareFilters,
): ActionDefinition[] {
    const q = query.trim().toLocaleLowerCase()
    return pool.filter((a) => {
        if (ap.length > 0 && !ap.includes(a.apCost)) return false
        // OR 语义：命中任一选中 tag 即保留
        if (tags.length > 0 && !a.tags.some((t) => tags.includes(t))) return false
        if (!q) return true
        return [a.name, a.id, ...a.tags].some((v) => v.toLocaleLowerCase().includes(q))
    })
}
