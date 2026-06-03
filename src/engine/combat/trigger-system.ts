import type { Condition } from '../entities/trigger'
import type { Character } from '../entities/character'

/** 条件匹配上下文 */
export interface MatchContext {
    actor: Character
    distance: number
}

/** 通用条件匹配：engine 不碰任何具体条件判断 */
export function matchCondition(cond: Condition, ctx: MatchContext): boolean {
    switch (cond.type) {
        case 'hp_below':
            return (ctx.actor.hp / ctx.actor.maxHp) * 100 < cond.value
        default:
            return true
    }
}
