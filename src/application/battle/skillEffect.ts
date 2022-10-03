import { Skill } from 'application/models/Skill'
import { BattleCharacter } from './interfaces'

export enum TARGET_TYPE {
    SELF = 0,
    ALLY = 1,
    OPPONENT = 2,
    ALL = 3,
}

const SkillEffecterMap: {
    [key: string]: (params: Array<any>, skill: Skill, source: BattleCharacter, target: BattleCharacter) => any
} = {
    'strength-damage': (params, skill, source, target) => {
        const damage = source.realtimeAttributes!.base.strength * params[0]
        target.realtimeAttributes!.volumne.health -= damage
        return {
            description: `${source.name}的${skill.name}击中${target.name},造成${damage}伤害`,
        }
    },
}

export interface EffectRule {
    method: string
    params: Array<any>
    targetType: TARGET_TYPE
    targetCount: number
}

export class Effect {
    name: string
    params: Array<any>
    skill: Skill
    source: BattleCharacter
    target: BattleCharacter

    description: string = ''

    constructor(name: string, params: Array<any>, skill: Skill, source: BattleCharacter, target: BattleCharacter) {
        const exist = Effect.checkExist(name)
        if (!exist) {
            throw new Error('Effect not implemented')
        }
        this.name = name
        this.params = params
        this.skill = skill
        this.source = source
        this.target = target
    }

    static checkExist(name: string) {
        return !!SkillEffecterMap[name]
    }

    implement() {
        const { description } = SkillEffecterMap[this.name](this.params, this.skill, this.source, this.target)
        this.description = description
    }
}
