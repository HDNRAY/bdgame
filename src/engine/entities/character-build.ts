import type { AttrName } from './attributes'
import type { TriggerSlot } from './trigger'

/** 战前角色配置（可序列化） */
export interface CharacterBuild {
    id: string
    name: string
    /** 武器 ID，对应 WEAPON_DB */
    weapon: string
    baseAttrs: Partial<Record<AttrName, number>>
    actions: string[]
    triggers: TriggerSlot[]
    passives: string[]
    artifacts: string[]
}
