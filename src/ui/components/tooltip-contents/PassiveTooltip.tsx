import type { Passive } from '../../../engine/entities/passive'
import { describeEffects } from '../../../engine/data/effectDisplay'
import { getAction } from '../../../engine/data/actions'
import { TagList } from '../ui/TagList/TagList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'
import { EntityItem } from '../ui/EntityItem/EntityItem'

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
                <div className="tt-extra tt-extra-dim">{describeEffects(passive.effects).join('；')}</div>
            )}
            {passive.grantsActions && passive.grantsActions.length > 0 && (
                <div className="tt-extra" style={{ marginTop: 'var(--sp-xxs)' }}>
                    <div className="tt-label">赋予招式:</div>
                    <div className="tt-flex-wrap">
                        {passive.grantsActions.map((id) => {
                            const def = getAction(id)
                            return def ? <EntityItem key={id} entity={def} type="action" /> : null
                        })}
                    </div>
                </div>
            )}
            {passive.triggers && passive.triggers.length > 0 && <TriggerEffects triggers={passive.triggers} />}
        </div>
    )
}
