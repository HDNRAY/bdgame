import { Castable } from './interfaces'
import { Skill, Cost, Effect } from './Skill'

export interface CharacterInfo {
    id: string
    name: string
}

export default class Character implements Castable {
    private _info: CharacterInfo

    public get info(): CharacterInfo {
        return this._info
    }

    constructor(params: CharacterInfo) {
        this._info = params
    }

    onCost(costs: Cost[]): void {}
    onEffect(effects: Effect[]): void {}
    checkCastCost(skill: Skill): boolean {
        return true
    }
}
