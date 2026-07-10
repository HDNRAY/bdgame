import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { EffectDef, ActionDefinition } from '../../entities/action'
import { effectHandlers } from './handlers'

/** 处理一个效果（统一入口） */
export function processActionEffect(
    eff: EffectDef,
    opts: {
        self: Character
        enemy: Character
        engine: BattleEngine
        tMs: number
        action?: ActionDefinition
        triggered?: boolean
    },
): void {
    const { self, enemy, engine, tMs, action, triggered } = opts
    const handler = effectHandlers[eff.type]
    if (handler) handler({ eff, self, enemy, engine, tMs, action, triggered })
}

const PRE_HIT_EFFECT_TYPES = new Set<EffectDef['type']>([
    'dash',
    'short_dash',
    'add_buff',
    'remove_buff',
    'switch_weapon',
    'retrieve_weapon',
    'self_disarm',
    'self_damage',
    'functional_damage',
])

/** 判断效果类型是否为不受命中影响的先发效果 */
export function isPreHitEffect(type: EffectDef['type']): boolean {
    return PRE_HIT_EFFECT_TYPES.has(type)
}
