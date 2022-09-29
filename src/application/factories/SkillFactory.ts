import { Skill } from 'application/models/Skill'

export interface BuildRandomSkillParams {
    name: string
}

class SkillFactory {
    // constructor() {}

    static buildRandomSkill = (params: BuildRandomSkillParams): Skill => {
        const { name } = params
        return {
            name,
            costs: [],
            effects: [],
        }
    }
}

export default SkillFactory
