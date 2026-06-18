import type { TriggerSlot } from '../../../../engine/entities/trigger'
import { getTriggerName } from '../../../../engine/data/triggers'

interface TriggerLabelProps {
    slot: TriggerSlot
}

/** 触发条件标签 — 灰色显示触发时机（如 "招架时"） */
export function TriggerLabel({ slot }: TriggerLabelProps) {
    return <span className="trigger-condition">{getTriggerName(slot.condition.type)}</span>
}
