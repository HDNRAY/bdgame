import type {
    EventDef,
    CombatEventDef,
    BossEventDef,
    HealEventDef,
    ForgeEventDef,
    StoryEventDef,
    InteractiveEventDef,
} from '../entities/event'

/** Type guards for event types */
export function isInteractiveEvent(ev: EventDef): ev is InteractiveEventDef {
    return ev.type === 'story' && 'steps' in ev && 'firstStep' in ev
}

export function isCombatEvent(ev: EventDef): ev is CombatEventDef {
    return ev.type === 'combat'
}

export function isBossEvent(ev: EventDef): ev is BossEventDef {
    return ev.type === 'boss'
}

export function isHealEvent(ev: EventDef): ev is HealEventDef {
    return ev.type === 'heal'
}

export function isForgeEvent(ev: EventDef): ev is ForgeEventDef {
    return ev.type === 'forge'
}

export function isSimpleStoryEvent(ev: EventDef): ev is StoryEventDef {
    return ev.type === 'story' && !isInteractiveEvent(ev)
}
