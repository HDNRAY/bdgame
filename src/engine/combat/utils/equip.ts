import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { TriggerSlot } from '../../entities/trigger'
import { processActionEffect } from '../effects/action'

/** 对一组物品（武器/奇物等）依次触发 on_equip 内联效果 */
export function processOnEquipEffects(
    engine: BattleEngine,
    character: Character,
    items: { triggers?: TriggerSlot[] }[],
    tMs: number,
): void {
    for (const item of items) {
        for (const t of item.triggers ?? []) {
            if (t.condition.type !== 'on_equip') continue
            if (t.effects) {
                for (const eff of t.effects) {
                    processActionEffect(eff, { self: character, enemy: character, engine, tMs })
                }
            }
        }
    }
}
