import type { Effect } from './effect'

// ════════════════════════════════════════
//  故事定义（元数据 + 出身 + 开局奖励效果）
//  故事线的事件节点不再写在 StoryDef 上——由各事件自己的 placement + when(story==X) 声明。
// ════════════════════════════════════════

export interface StoryDef {
    id: string
    name: string
    characterName: string
    description: string
    /** n1 出身选项的出身事件 ID（如 origin_xuanmen）。 */
    originEventId: string
    /** 选择该故事时立即执行的效果（激活故事 flag + 开局奖励 + 决赛 Boss 等）。 */
    reward: Effect[]
}
