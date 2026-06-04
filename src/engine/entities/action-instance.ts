import type { ActionDefinition } from './action'

/** 招式运行时实例（追踪限次/冷却等状态） */
export class ActionInstance {
    readonly def: ActionDefinition
    remainingUses: number

    constructor(def: ActionDefinition) {
        this.def = def
        this.remainingUses = def.maxUses ?? Infinity
    }

    get id() {
        return this.def.id
    }
    get name() {
        return this.def.name
    }
    get apCost() {
        return this.def.apCost
    }
    get bonus() {
        return this.def.bonus ?? false
    }
    get effects() {
        return this.def.effects
    }

    canUse(): boolean {
        return this.remainingUses > 0
    }

    use(): void {
        if (this.def.maxUses !== undefined) this.remainingUses--
    }
}
