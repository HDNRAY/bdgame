import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { ActionDefinition } from '../../entities/action'
import { calcHitChance, calcRoll } from '../../calc/damage'
import type { ActionResult } from '../types'
import { consumeBuffsByTrigger, forEachBuffOf } from '../utils'

/** 命中判定，返回 false 则攻击终止 */
export function processHitCheck(
    action: ActionDefinition,
    r: ActionResult,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
    suppressTriggers = false,
): boolean {
    if (!suppressTriggers) engine.emit('on_attack', self, enemy)
    let defenderDodgeMod = enemy.dodgeMod
    // 防御方 buff 闪避率修正
    forEachBuffOf(engine.state.pendingBuffs, enemy.id, (def, layer) => {
        if (!def?.onDodgeChance) return
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
    })
    const baseHc = calcHitChance({
        attackerDexterity: self.attrs.get('dexterity'),
        attackerInsight: self.attrs.get('insight'),
        defenderAgility: enemy.attrs.get('agility'),
        defenderInsight: enemy.attrs.get('insight'),
        defenderDodgeMod,
    })
    let hc = action.onActionHitChance?.(baseHc, engine.state, self) ?? baseHc
    // buff 命中率钩子
    forEachBuffOf(engine.state.pendingBuffs, self.id, (def, layer) => {
        if (!def?.onHitChance) return
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
    })
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
    // 出招即消耗（on_attack）：钩子（onHitChance 等）已在判定前生效，判定后无论中不中都消耗
    if (!suppressTriggers) consumeBuffsByTrigger(self.id, engine, 'on_attack')
    if (!r.hit) {
        // 事件归属已由 scope 判定；dodge 与 on_dodged 反应随判定基准作用域
        engine.emitLog({ type: 'dodged', sourceId: self.id, targetId: enemy.id })
        if (!suppressTriggers) {
            engine.emit('on_dodged', self, enemy)
            // 攻击方 buff onDodged 钩子（自己攻击被对方闪避；遍历攻击方 buff，与 trigger on_dodged 同义）
            forEachBuffOf(engine.state.pendingBuffs, self.id, (def, layer) => {
                if (!def?.onDodged) return
                def.onDodged({
                    final: 0,
                    raw: 0,
                    attacker: self,
                    target: enemy,
                    source: action,
                    engine,
                    state: engine.state,
                    layer,
                })
            })
            // 防御方 buff onDodge 钩子（自己成功闪避；遍历防御方 buff，与 trigger on_dodge 同义）
            forEachBuffOf(engine.state.pendingBuffs, enemy.id, (def, layer) => {
                if (!def?.onDodge) return
                def.onDodge({
                    final: 0,
                    raw: 0,
                    attacker: self,
                    target: enemy,
                    source: action,
                    engine,
                    state: engine.state,
                    layer,
                })
            })
            engine.emit('on_dodge', enemy, self)
            consumeBuffsByTrigger(enemy.id, engine, 'on_dodge')
        }
        return false
    }

    if (!suppressTriggers) consumeBuffsByTrigger(self.id, engine, 'on_hit')
    return true
}
