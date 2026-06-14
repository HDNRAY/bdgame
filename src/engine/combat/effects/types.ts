import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { EffectDef, ActionDefinition } from '../../entities/action'

export interface EffectCtx {
    eff: EffectDef
    self: Character
    enemy: Character
    engine: BattleEngine
    tMs: number
    action?: ActionDefinition
}
