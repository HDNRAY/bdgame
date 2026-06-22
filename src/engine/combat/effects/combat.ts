import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { ActionDefinition } from '../../entities/action'
import { calcHitChance, calcRoll } from '../../calc/damage'
import { getBuff } from '../../data/buffs'
import type { ActionResult } from '../types'
import { consumeBuffsByTrigger } from '../utils'

/** 命中判定，返回 false 则攻击终止 */
export function processHitCheck(
    action: ActionDefinition,
    r: ActionResult,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
): boolean {
    engine.emit('on_attack', self, enemy)
    const rangeDodgeMod =
        engine.state.pendingBuffs.has(`ranged_dodge::${enemy.id}`) &&
        engine.state.position.distance(self.id, enemy.id) >= 5
            ? 0.15
            : 0
    const baseHc = calcHitChance({
        attackerDexterity: self.attrs.get('dexterity'),
        attackerInsight: self.attrs.get('insight'),
        defenderAgility: enemy.attrs.get('agility'),
        defenderInsight: enemy.attrs.get('insight'),
        defenderDodgeMod: enemy.dodgeMod + rangeDodgeMod,
    })
    let hc = action.onActionHitChance?.(baseHc) ?? baseHc
    // buff 命中率钩子
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== self.id) continue
        const def = getBuff(parts[0])
        if (!def?.onHitChance) continue
        const hcMod = def.onHitChance({
            final: 0,
            raw: 0,
            attacker: self,
            target: enemy,
            action,
            engine,
            buffOwnerId: parts[1],
            layer,
        })
        hc = hc + hcMod
    }
    const hitResult = calcRoll(hc)
    r.hit = hitResult.success
    engine.emitLog({
        type: 'check_hit',
        sourceId: self.id,
        targetId: enemy.id,
        hitChance: hc,
        roll: hitResult.roll,
        result: hitResult.success,
    })
    if (!r.hit) {
        engine.emitLog({ type: 'dodged', sourceId: self.id, targetId: enemy.id })
        engine.emit('on_dodged', self, enemy)
        engine.emit('on_dodge', enemy, self)
        return false
    }

    consumeBuffsByTrigger(self.id, engine, 'on_hit')
    return true
}
