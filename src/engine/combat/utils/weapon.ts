import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { WeaponDef } from '../../../data/weapons/weapons'
import { forEachBuffOf } from './buff-loop'

/** 反转旧武器的 stat_buff 效果（御物除外） */
export function revertWeaponStatBuffs(weapon: WeaponDef | undefined, char: Character, _engine: BattleEngine): void {
    if (!weapon || weapon.tags.includes('imperial')) return
    for (const eff of weapon.effects ?? []) {
        if (eff.type === 'stat_buff') {
            for (const [attr, value] of Object.entries(eff.attrs)) {
                char.attrs.modify(attr as AttrName, -value)
            }
        }
    }
}

/** 清除角色的武器 buff 层（仅清除带 weapon tag 的 buff） */
export function clearWeaponBuffLayers(charId: string, engine: BattleEngine): void {
    forEachBuffOf(engine.state.pendingBuffs, charId, (buffDef, layer, _b, key) => {
        if (!layer.mods || Object.keys(layer.mods).length === 0) return
        if (!buffDef?.tags?.includes('weapon')) return
        const char = engine.getCharacter(charId)
        if (!char) return
        for (const [attr, delta] of Object.entries(layer.mods)) {
            if (attr === 'maxApMod') {
                char.maxApMod -= delta as number
                char.capAp()
            } else {
                char.attrs.modify(attr as AttrName, -(delta as number))
            }
        }
        engine.state.pendingBuffs.delete(key)
        engine.state.turn.removeEvents('buff_end_' + key)
    })
}
