import { CharacterAttribute } from 'application/models/Character'
import { Skill } from 'application/models/Skill'
import { BATTLE_RESULT } from './constant'
import Queue from './queue'
import { Effect } from './skillEffect'

export interface BattleEvent {
    type: string
    leftTime: number
    getEffects(state: BattleState): Array<Effect>
    hasNextTurn(): boolean
    // never called
    timeGoesBy(time: number): void
    // never called
    rebuild(): void
}

export interface BattleState {
    characters: Array<BattleUnit>
    actionLogs: Array<any>
    result: BATTLE_RESULT
    eventQueue: Queue
    turnCount: number
    start: Date
    eventsInTurn: Array<BattleEvent>
    effects: Array<Effect>
}

export interface BattleCharacter extends BattleUnit {
    type: 'character'
    staticAttributes: CharacterAttribute
    realtimeAttributes?: CharacterAttribute
}

export interface BattleSkill extends BattleUnit {
    type: 'skill'
}

export interface BattleUnit {
    name: string
    type: 'skill' | 'character'
    team: 0 | 1
    skill: Skill
    [key: string]: any
}
