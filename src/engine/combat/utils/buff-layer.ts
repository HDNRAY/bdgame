import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { BuffLayer } from '../types'
import { getBuff } from '../../data/buffs'
import type { TriggerEvent } from '../../entities/trigger'

/** 调度 buff 过期事件 */
export function scheduleBuffExpiry(engine: BattleEngine, layerKey: string, duration: number): void {
    engine.state.turn.scheduleSystemEventAt(
        `buff_end_${layerKey}`,
        engine.state.turn.currentTime + duration,
        'buff_end',
    )
}

/** 反转 buff 的属性修正 */
export function revertBuffMods(layer: BuffLayer | undefined, char: Character, engine: BattleEngine): void {
    if (!layer?.mods) return
    for (const [attr, delta] of Object.entries(layer.mods)) {
        char.attrs.modify(attr as AttrName, -(delta as number))
        if (attr === 'agility') engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'))
    }
}

/** 根据 trigger 消耗该角色的 consumed buff */
export function consumeBuffsByTrigger(charId: string, engine: BattleEngine, trigger: TriggerEvent): void {
    for (const [k] of engine.state.pendingBuffs) {
        const parts = k.split('::')
        if (parts.length < 2 || parts[1] !== charId) continue
        const def = getBuff(parts[0])
        if (def?.expiry?.type !== 'consumed' || def.expiry.trigger !== trigger) continue
        engine.state.pendingBuffs.delete(k)
    }
}
