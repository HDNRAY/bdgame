import { Castable, Targetable } from 'application/models/interfaces'
import { Skill } from 'application/models/Skill'

export default class BattleScene {
    castASkill(source: Castable, target: Targetable, skill: Skill): void {
        // check target valid
        const targetValid = this.checkTargetValid(source, target, skill)
        if (!targetValid) {
            throw new Error('Invalid Target')
        }

        const sourceCostEnough = source.checkCastCost(skill)
        if (!sourceCostEnough) {
            throw new Error('Not Enough Resource')
        }

        source.onCost([])

        target.onEffect([])
        source.onEffect([])
    }

    private checkTargetValid(source: Castable, target: Targetable, skill: Skill): boolean {
        return true
    }
}
