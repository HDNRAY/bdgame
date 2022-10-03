import { BattleEvent, BattleState } from '../interfaces'

const EVENT_BATTLE_START = 'event_battle_start'

export default class EventBattleStart implements BattleEvent {
    type: string
    leftTime: number

    constructor() {
        this.type = EVENT_BATTLE_START
        this.leftTime = 0
    }

    getEffects(state: BattleState) {
        return []
    }

    hasNextTurn() {
        return false
    }

    // never called
    timeGoesBy() {}

    // never called
    rebuild() {
        return null
    }
}
