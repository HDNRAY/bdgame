import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { EffectDef, ActionDefinition } from '../../entities/action'
import { effectHandlers } from './handlers'

/** 处理一个效果（统一入口） */
export function processActionEffect(
    eff: EffectDef,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
    tMs: number,
    action?: ActionDefinition,
): void {
    const handler = effectHandlers[eff.type]
    if (handler) handler({ eff, self, enemy, engine, tMs, action })
}
