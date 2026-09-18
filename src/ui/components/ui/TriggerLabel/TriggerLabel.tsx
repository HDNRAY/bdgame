import type { EffectSlot } from '../../../../engine/entities/trigger'
import { getTriggerName } from '../../../../bridge/triggerDisplay'

interface TriggerLabelProps {
    slot: EffectSlot
}

/** 触发条件标签 — 灰色显示触发时机（如 "招架时"） */
export function TriggerLabel({ slot }: TriggerLabelProps) {
    return <span className="trigger-condition">{getTriggerName(slot.condition.type)}</span>
}
