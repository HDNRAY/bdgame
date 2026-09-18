import type { EffectSlot } from '../../../../engine/entities/trigger'
import { isConstructSlot } from '../../../../engine/entities/trigger'
import { getAction } from '../../../../data/actions'
import { getTriggerName } from '../../../../bridge/triggerDisplay'
import { describeEffects } from '../../../../data/effectDisplay'

interface TriggerEffectsProps {
    triggers: EffectSlot[]
}

/** 将触发的条件和效果直接展示为文字（跳过内部招式名；构造期 on_construct 是内部时机，不列给玩家） */
export function TriggerEffects({ triggers }: TriggerEffectsProps) {
    const visible = (triggers ?? []).filter((t) => !isConstructSlot(t))
    if (visible.length === 0) return null
    return (
        <>
            <hr className="tt-separator" />
            {visible.map((t, i) => {
                const name = getTriggerName(t.condition.type)
                const actionEffects = t.actionId ? getAction(t.actionId)?.effects : undefined
                const effects = actionEffects ?? t.apply
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
