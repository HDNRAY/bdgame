import type { Passive } from '../../../engine/entities/passive'
import { constructEffectsOf } from '../../../engine/entities/trigger'
import { describeEffects } from '../../../data/effectDisplay'
import { getAction } from '../../../data/actions'
import { TagList } from '../ui/TagList/TagList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'
import { EntityItem } from '../ui/EntityItem/EntityItem'

interface PassiveTooltipProps {
    passive: Passive
}

/** 功法 tooltip 内容 */
export function PassiveTooltip({ passive }: PassiveTooltipProps) {
    // 「自带效果」= 源的构造期槽（on_construct）的 apply；运行时触发由 TriggerEffects 展示
    const selfEffects = constructEffectsOf(passive)
    return (
        <div>
            <div className="tt-name">{passive.name}</div>
            {passive.tags.length > 0 && <TagList tags={passive.tags} />}
            {passive.description && <div className="tt-desc">{passive.description}</div>}
            {selfEffects.length > 0 && (
                <div className="tt-extra tt-extra-dim">{describeEffects(selfEffects).join('；')}</div>
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
            {passive.effects && passive.effects.length > 0 && <TriggerEffects triggers={passive.effects} />}
        </div>
    )
}
