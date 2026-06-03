import type { Condition, ConditionContext } from '../entities/trigger'

/** 通用条件匹配 */
export function matchCondition(cond: Condition, ctx: ConditionContext): boolean {
    return cond.check ? cond.check(ctx) : true
}
