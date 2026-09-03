/**
 * 洞察减益防护共享效果。
 *
 * 多个被动/奇物（暗室抓雀功、机械眼球、战术护目镜）都要「洞察被降低时效果减半」
 * （迷眼 -4 → -2）。stat_restriction 的 check 是纯函数，抽成共享工厂，
 * 各载体直接展开引用同一份逻辑，改动只需在此一处。
 */
import type { Character } from '../../engine/entities/character'
import type { BattleState } from '../../engine/combat/types'

export interface InsightGuardEffect {
    type: 'stat_restriction'
    check: (
        char: Character,
        attr: string,
        current: number,
        delta: number,
        sourceTags?: string[],
        state?: BattleState,
    ) => { skip?: boolean; delta?: number } | null
}

/** 洞察被降低时效果减半（迷眼 -4 → -2）的共享 stat_restriction effect */
export function insightReductionHalf(): InsightGuardEffect {
    return {
        type: 'stat_restriction',
        check: (_char, attr, _current, delta) => {
            // 只拦洞察的降低（正向加成如机械眼 +4 不受影响）
            if (attr !== 'insight' || delta >= 0) return null
            return { delta: Math.round(delta / 2) }
        },
    }
}
