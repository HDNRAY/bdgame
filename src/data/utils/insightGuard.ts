/**
 * 洞察减益防护共享回调。
 *
 * 多个被动/奇物（暗室抓雀功、机械眼球、战术护目镜）都要「洞察被降低时效果减半」
 * （迷眼 -4 → -2）。限制器回调是纯函数，抽成共享工厂，各载体（`insight_guard` buff 的
 * `statRestriction`）引用同一份逻辑，改动只需在此一处。
 */
import type { StatRestrictionCheck } from '../../engine/entities/character/source-layer'

/** 洞察被降低时效果减半（迷眼 -4 → -2）的共享 stat_restriction 回调 */
export function insightReductionHalfCheck(): StatRestrictionCheck {
    return (_char, attr, _current, delta) => {
        // 只拦洞察的降低（正向加成如机械眼 +4 不受影响）
        if (attr !== 'insight' || delta >= 0) return null
        return { delta: Math.round(delta / 2) }
    }
}
