import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { BuffLayer } from '../types'

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
