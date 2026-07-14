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
    let defenderDodgeMod = enemy.dodgeMod
    // 防御方 buff 闪避率修正
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2 || parts[1] !== enemy.id) continue
        const def = getBuff(parts[0])
        if (!def?.onDodgeChance) continue
        defenderDodgeMod += def.onDodgeChance({
            final: 0,
            raw: 0,
            attacker: self,
            target: enemy,
            source: action,
            engine,
            state: engine.state,
            // buffOwnerId: parts[1],
            layer,
        })
    }
    const baseHc = calcHitChance({
        attackerDexterity: self.attrs.get('dexterity'),
        attackerInsight: self.attrs.get('insight'),
        defenderAgility: enemy.attrs.get('agility'),
        defenderInsight: enemy.attrs.get('insight'),
        defenderDodgeMod,
    })
    let hc = action.onActionHitChance?.(baseHc, engine.state, self) ?? baseHc
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
            source: action,
            engine,
            state: engine.state,
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
        // 防御方 buff onDodged 钩子（缩进一层）
        engine.state.log.indentDepth++
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== enemy.id) continue
            const def = getBuff(parts[0])
            if (!def?.onDodged) continue
            def.onDodged({
                final: 0,
                raw: 0,
                attacker: self,
                target: enemy,
                source: action,
                engine,
                state: engine.state,
                // buffOwnerId: parts[1],
                layer,
            })
        }
        engine.state.log.indentDepth--
        consumeBuffsByTrigger(enemy.id, engine, 'on_dodge')
        return false
    }

    consumeBuffsByTrigger(self.id, engine, 'on_hit')
    return true
}
