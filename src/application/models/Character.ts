import { Effect } from 'application/battle/skillEffect'
import { Cost } from 'application/common/interface'
import { Castable } from './interfaces'
import { Skill } from './Skill'

export interface CharacterInfo {
    id: string
    name: string
}

export interface CharacterAttribute {
    volumne: {
        health: number
        mana: number
    }
    base: {
        strength: number
        // agility: number
        // intellligence: number
        // willPower: number
        // stamina: number
    }
    // defense: {
    //     physical: number
    // }
    // attack: {
    //     physical: number
    // }
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
