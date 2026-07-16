import type { TriggerSlot } from '../../../../engine/entities/trigger'
import { getAction } from '../../../../data/actions'
import { getTriggerName } from '../../../../bridge/triggerDisplay'
import { describeEffects } from '../../../../data/effectDisplay'

interface TriggerEffectsProps {
    triggers: TriggerSlot[]
}

/** 将触发的条件和效果直接展示为文字（跳过内部招式名） */
export function TriggerEffects({ triggers }: TriggerEffectsProps) {
    if (!triggers || triggers.length === 0) return null
    return (
        <>
            <hr className="tt-separator" />
            {triggers.map((t, i) => {
                const name = getTriggerName(t.condition.type)
                const actionEffects = t.actionId ? getAction(t.actionId)?.effects : undefined
                const effects = actionEffects ?? t.effects
                return (
                    <div key={i} className="tt-extra tt-extra-dim">
                        <span>触发</span> {name}
                        {effects && effects.length > 0 && <span> → {describeEffects(effects).join('；')}</span>}
                    </div>
                )
            })}
        </>
    )
}
