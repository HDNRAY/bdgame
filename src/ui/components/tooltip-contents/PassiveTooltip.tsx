import type { Passive } from '../../../engine/entities/passive'
import { getAction } from '../../../engine/data/actions'
import { getTriggerName } from '../../../engine/data/triggers'
import { describeEffects } from '../../../engine/data/effectDisplay'
import { TagList } from '../ui/TagList/TagList'

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
            {passive.triggers && passive.triggers.length > 0 && (
                <>
                    <hr className="tt-separator" />
                    {passive.triggers.map((t, i) => {
                        const name = getTriggerName(t.condition.type)
                        const actionName = t.actionId ? getAction(t.actionId)?.name : undefined
                        return (
                            <div key={i} className="tt-extra" style={{ fontSize: 10, lineHeight: 1.7 }}>
                                <span style={{ color: '#888' }}>触发</span> {name}
                                {actionName && <span style={{ color: '#aaa' }}> → {actionName}</span>}
                                {!actionName && t.effects && t.effects.length > 0 && (
                                    <span style={{ color: '#aaa' }}> → {describeEffects(t.effects).join('；')}</span>
                                )}
                            </div>
                        )
                    })}
                </>
            )}
        </div>
    )
}
