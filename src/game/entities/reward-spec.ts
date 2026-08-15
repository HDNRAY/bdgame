// ════════════════════════════════════════
//  奖励规格（RewardSpec）
//  统一覆盖各种奖励情况：
//    points —— 修炼点（配额决定是否给，计数走 flags['points_granted']）
//    item   —— 从奖励池抽（可限定池/标签/ap 范围/指定 id/排除固有功法）
//    fixed  —— 固定几个里选（如 xiaohua 功法、n2 选武器、回忆三选一）
//    none   —— 无奖励（淘汰赛）
//    heal   —— 疗伤
// ════════════════════════════════════════

export type RewardSpec =
    | { kind: 'points' }
    | {
          kind: 'item'
          pool: 'action' | 'passive' | 'weapon' | 'artifact'
          /** 只在这些 id 里选 */
          ids?: string[]
          /** 排除这些 id（如天工坊不出起始武器） */
          excludeIds?: string[]
          /** 命中任一标签即通过（OR） */
          includeTags?: string[]
          /** 命中任一标签即排除（如 ['inherent'] 排除独臂/凝炁诀等固有功法） */
          excludeTags?: string[]
          apMin?: number
          apMax?: number
          noPrePost?: boolean
          /** 招式必须声明 requiredTags（n3 用：只出与武器关联的招式） */
          requireTags?: boolean
          /** 武器奖励挂载槽位（默认主手） */
          slot?: 'main' | 'offhand'
      }
    | { kind: 'fixed'; choices: { id: string; label: string; description?: string; type?: 'weapon' | 'points'; slot?: 'main' | 'offhand' }[] }
    | { kind: 'none' }
    | { kind: 'heal' }

/** 由事件自然奖励推算的"配额自然类型"：points 类事件被配额转为实体时，回退给功法。 */
export function rewardNaturalKind(spec: RewardSpec | undefined): 'points' | 'heal' | 'item' {
    if (!spec) return 'item'
    switch (spec.kind) {
        case 'points':
            return 'points'
        case 'heal':
            return 'heal'
        default:
            return 'item'
    }
}
