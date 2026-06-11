import type { GameEntity } from './base'
import type { Tag } from './tag'
import type { EffectDef } from './action'
import type { TriggerSlot } from './trigger'

/** 奇物 */
export interface Artifact extends GameEntity {
    tags: Tag[]
    /** 奇物效果（构造期执行） */
    effects?: EffectDef[]
    /** 奇物触发（运行时） */
    triggers?: TriggerSlot[]
}

// /** 义体 —— 带惩罚的强化部件 */
// export interface Implant extends Artifact {
//     /** 义体效果（构造期执行） */
// }
