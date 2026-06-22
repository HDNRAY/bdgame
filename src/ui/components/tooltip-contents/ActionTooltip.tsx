import type { ActionDefinition } from '../../../engine/entities/action'
import { TagList } from '../ui/TagList/TagList'
import { EffectList } from '../ui/EffectList/EffectList'

interface ActionTooltipProps {
    action: ActionDefinition
    /** 当前剩余次数 */
    remainingUses?: number
}

/** 招式 tooltip 内容 */
export function ActionTooltip({ action, remainingUses }: ActionTooltipProps) {
    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, color: '#ffe66d', fontSize: 13, fontWeight: 'bold' }}>
                {action.apCost}AP
            </div>
            <div className="tt-name">{action.name}</div>
            <TagList tags={action.tags} />
            {action.description && <div className="tt-desc">{action.description}</div>}
            <hr className="tt-separator" />
            <div className="tt-extra">
                {action.target === 'self' && '自身'}
                {action.target === 'self' && action.onActionHitChance !== undefined && ' · '}
                {action.onActionHitChance !== undefined && '固定命中率'}
                {action.getRange &&
                    `${action.target !== undefined || action.onActionHitChance !== undefined ? ' · ' : ''}范围 依武器而定`}
                {action.maxUses !== undefined && ` · 上限 ${action.maxUses}次`}
                {remainingUses !== undefined && isFinite(remainingUses) && ` · 剩余 ${remainingUses}次`}
            </div>
            {action.effects && action.effects.length > 0 && <EffectList effects={action.effects} />}
        </div>
    )
}
