import type { TriggerSlot } from './trigger'
import type { Passive } from './passive'
import type { Artifact } from './artifact'

/** 战前角色配置（可序列化） */
export interface CharacterBuild {
    id: string
    name: string
    /** 武器 ID，对应 WEAPON_DB */
    weapon: string
    baseAttrs: Partial<Record<string, number>>
    moves: string[]
    triggers: TriggerSlot[]
    passives: Passive[]
    artifacts: Artifact[]
}
