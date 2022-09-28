import { Castable } from './interfaces'
import Skill, { Cost, Effect } from './Skill'

export default class Character implements Castable {
    onCost(costs: Cost[]): void {}
    onEffect(effects: Effect[]): void {}
    checkCastCost(skill: Skill): boolean {
        return true
    }
}
