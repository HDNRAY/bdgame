import type { Passive } from '../../../../engine/entities/passive'
import { Tooltip } from '../Tooltip/Tooltip'
import { PassiveTooltip } from '../../tooltip-contents/PassiveTooltip'
import '../EntityItem/EntityItem.scss'

interface PassiveItemProps {
    passive: Passive
}

/** 功法列表项 — 显示 "▸ 名称"，自带 PassiveTooltip */
export function PassiveItem({ passive }: PassiveItemProps) {
    return (
        <Tooltip content={<PassiveTooltip passive={passive} />}>
            <div className="entity-item">
                <span className="entity-item-name">▸ {passive.name}</span>
            </div>
        </Tooltip>
    )
}
