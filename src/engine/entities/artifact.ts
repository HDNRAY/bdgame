import type { GameEntity } from './base'
import type { EffectDef } from './action'

/** 奇物 */
export interface Artifact extends GameEntity {
    /** 奇物效果（构造期执行） */
    effects?: EffectDef[]
}
