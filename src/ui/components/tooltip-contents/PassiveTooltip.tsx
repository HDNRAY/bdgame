import type { Passive } from '../../../engine/entities/passive'
import { describeEffects } from '../../../engine/data/effectDisplay'
import { TagList } from '../ui/TagList/TagList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'

interface PassiveTooltipProps {
    passive: Passive
}

/** 功法 tooltip 内容 */
export function PassiveTooltip({ passive }: PassiveTooltipProps) {
    return (
        <div>
            <div className="tt-name">{passive.name}</div>
            {passive.tags.length > 0 && <TagList tags={passive.tags} />}
            {passive.description && <div className="tt-desc">{passive.description}</div>}
            {passive.effects && passive.effects.length > 0 && (
                <div className="tt-extra" style={{ fontSize: 10, color: '#aaa', lineHeight: 1.6 }}>
                    {describeEffects(passive.effects).join('；')}
                </div>
            )}
            {passive.triggers && passive.triggers.length > 0 && <TriggerEffects triggers={passive.triggers} />}
        </div>
    )
}
