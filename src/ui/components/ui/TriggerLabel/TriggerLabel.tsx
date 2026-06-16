import type { TriggerSlot } from '../../../../engine/entities/trigger'
import { getTriggerName } from '../../../../engine/data/triggers'

interface TriggerLabelProps {
    slot: TriggerSlot
}

/** 触发条件标签 — 显示触发时机的中文名（如 "招架时"） */
export function TriggerLabel({ slot }: TriggerLabelProps) {
    return <>{getTriggerName(slot.condition.type)}</>
}
