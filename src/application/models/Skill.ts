import { EffectRule } from 'application/battle/skillEffect'
import { CostRule } from 'application/common/interface'

export interface Skill {
    id: string
    name: string
    cooldown: number
    costs: Array<CostRule>
    effects: Array<EffectRule>

    // constructor(params: SkillContructorInterface) {
    //     this.name = params.name
    //     this.costs = params.costs || []
    //     this.effects = params.effects || []
    // }
}

// export interface SkillContructorInterface {
//     name: string
//     costs?: Array<CostRule>
//     effects?: Array<EffectRule>
// }
