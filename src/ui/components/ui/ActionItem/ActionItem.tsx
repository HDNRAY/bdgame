import type { Action } from '../../../../engine/entities/action'
import { Tooltip } from '../Tooltip/Tooltip'
import { ActionTooltip } from '../../tooltip-contents/ActionTooltip'
import '../EntityItem/EntityItem.scss'

interface ActionItemProps {
    action: Action
}

/** 招式列表项 — 显示 "▸ 名称 AP 次数"，自带 ActionTooltip */
export function ActionItem({ action }: ActionItemProps) {
    const maxUses = action.def.maxUses
    const hasFiniteUses = maxUses !== undefined && maxUses < 999
    return (
        <Tooltip content={<ActionTooltip action={action.def} remainingUses={action.remainingUses} />}>
            <div className="entity-item">
                <span className="entity-item-name">▸ {action.name}</span>
                <span className="entity-item-meta">
                    {action.apCost > 0 && <span className="action-ap">{action.apCost}AP</span>}
                    {hasFiniteUses && (
                        <span className="action-uses">
                            {' '}
                            ×{action.remainingUses}/{maxUses}
                        </span>
                    )}
                </span>
            </div>
        </Tooltip>
    )
}
