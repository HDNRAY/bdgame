import { Castable, Targetable } from './interfaces'
import Skill from './Skill'

export default class SkillObject {
    source: Castable
    target: Targetable
    skill: Skill

    constructor(params: SkillObjectContructorInterface) {
        this.skill = params.skill
        this.source = params.source
        this.target = params.target
    }
}

export interface SkillObjectContructorInterface {
    source: Castable
    target: Targetable
    skill: Skill
}
