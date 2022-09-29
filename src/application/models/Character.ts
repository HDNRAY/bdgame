import { Castable } from './interfaces'
import { Skill, Cost, Effect } from './Skill'

export interface CharacterInfo {
    id: string
    name: string
}

export default class Character implements Castable {
    name: string
    onCost(costs: Cost[]): void {}
    onEffect(effects: Effect[]): void {}
    checkCastCost(skill: Skill): boolean {
        return true
    }

    constructor(params: CharacterInfo) {
        this.name = params.name
    }
}
