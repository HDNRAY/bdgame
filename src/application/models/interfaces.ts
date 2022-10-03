import { Effect } from 'application/battle/skillEffect'
import { Cost } from 'application/common/interface'
import { Skill } from './Skill'

export interface Targetable {
    onTarget(): void
    onEffect(effects: Array<Effect>): void
    isCastable(): void
}

export interface Castable {
    checkCastCost(skill: Skill): boolean
    onCost(costs: Array<Cost>): void
    onEffect(effects: Array<Effect>): void
}
