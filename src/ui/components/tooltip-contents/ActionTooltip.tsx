import type { ActionDefinition } from '../../../engine/entities/action'
import { describeActionNotes } from '../../../bridge/actionDisplay'
import { TagList } from '../ui/TagList/TagList'
import { EffectList } from '../ui/EffectList/EffectList'

interface ActionTooltipProps {
    action: ActionDefinition
    /** 当前剩余次数 */
    remainingUses?: number
}

/** 招式 tooltip 内容 */
export function ActionTooltip({ action, remainingUses }: ActionTooltipProps) {
    // 前缀文案（命中/暴击/爆伤/范围/上限/剩余/门槛）在 bridge 层统一生成
    const { extra, canUse } = describeActionNotes(action, remainingUses)

    return (
        <div className="tt-relative">
            <div className="tt-ap-cost">
                {action.apCost}AP
                {action.chanCost !== undefined && <span className="tt-chan-cost">/{action.chanCost}缠</span>}
            </div>
            <div className="tt-name">{action.name}</div>
            <TagList tags={action.tags} />
            {action.description && <div className="tt-desc">{action.description}</div>}
            <hr className="tt-separator" />
            {extra.length > 0 && <div className="tt-extra">{extra.join(' · ')}</div>}
            {canUse && <div className="tt-extra tt-extra-dim">条件：{canUse}</div>}
            {action.effects && action.effects.length > 0 && <EffectList effects={action.effects} />}
        </div>
    )
}
