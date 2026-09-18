import type { GameEntity } from './base'
import type { Tag } from './tag'
import type { EffectSlot } from './trigger'
import type { SummonDef } from './summon'

import type { ActionEnhancer } from './passive'

/** 奇物 */
export interface Artifact extends GameEntity {
    tags: Tag[]
    /**
     * 时机 → 效果列表：构造期贡献在 `on_construct` 槽（`apply` 走来源层账），其余槽是运行时触发。
     */
    effects?: EffectSlot[]
    /** 义体赋予角色的招式 */
    grantsActions?: string[]
    /** 召唤物（御物类奇物使用） */
    summon?: SummonDef
    /** 招式强化钩子（构造期执行） */
    actionEnhancer?: ActionEnhancer
}

// /** 义体 —— 带惩罚的强化部件 */
// export interface Implant extends Artifact {
//     /** 义体效果（构造期执行） */
// }
