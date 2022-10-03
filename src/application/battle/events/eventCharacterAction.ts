import { TARGET_TYPE } from '../constant'
import { BattleCharacter, BattleEvent, BattleState, BattleUnit } from '../interfaces'
import { Effect, EffectRule } from '../skillEffect'
import { isAlive } from '../utils'

const EVENT_CHARACTER_ACTION = 'event_character_action'

class EventCharacterAction implements BattleEvent {
    state: BattleState
    executor: BattleUnit
    type: string
    leftTime: number
    currentSkillId: number

    constructor(character: BattleUnit, state: BattleState) {
        this.state = state
        this.executor = character
        this.type = EVENT_CHARACTER_ACTION
        this.leftTime = getLeftTime(character)
        this.currentSkillId = 0
    }

    getEffects(state: BattleState) {
        const source = this.state.characters.filter((c) => c.team === this.executor.team)[0] as BattleCharacter
        const skill = this.executor.skill

        return skill.effects.reduce((result: Array<any>, effect: EffectRule) => {
            const { method, params, targetCount, targetType } = effect
            let targets: Array<BattleCharacter> = []

            if (targetType === TARGET_TYPE.SELF) {
                // first one should be player
                targets = [source]
            } else {
                let teamCondition: any
                switch (targetType) {
                    case TARGET_TYPE.OPPONENT:
                        teamCondition = (character: BattleCharacter) => character.team !== this.executor.team
                        break
                    case TARGET_TYPE.ALLY:
                        teamCondition = (character: BattleCharacter) => character.team === this.executor.team
                        break
                    case TARGET_TYPE.ALL:
                        teamCondition = () => true
                        break
                }
                const targetChoicesAlive = state.characters.filter(
                    (character) => isAlive(character) && teamCondition(character)
                ) as Array<BattleCharacter>
                targetChoicesAlive.sort(() => Math.random() - 0.5)
                targets = targetChoicesAlive.slice(0, targetCount)
            }

            const effects = targets.map((target) => {
                return new Effect(method, params, skill, source, target)
            })

            return result.concat(effects)
        }, [])
    }

    timeGoesBy(time: number) {
        this.leftTime -= time
    }

    hasNextTurn() {
        if (this.executor.type === 'skill') {
            return true
        }

        return isAlive(this.executor)
    }

    rebuild() {
        this.leftTime = getLeftTime(this.executor)
        return this
    }
}

const getLeftTime = (character: BattleUnit) => character.skill.cooldown

export default EventCharacterAction
