export interface Skill {
    name: string
    costs: Array<CostRule>
    effects: Array<EffectRule>

    // constructor(params: SkillContructorInterface) {
    //     this.name = params.name
    //     this.costs = params.costs || []
    //     this.effects = params.effects || []
    // }
}

export interface CostRule {}

export interface EffectRule {}

export interface Cost {}

export interface Effect {}

// export interface SkillContructorInterface {
//     name: string
//     costs?: Array<CostRule>
//     effects?: Array<EffectRule>
// }
