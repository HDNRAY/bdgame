import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { WeaponDef } from '../../../data/weapons/weapons'
import { getBuff } from '../../../data/buffs'

/** 反转旧武器的 stat_buff 效果（御物除外） */
export function revertWeaponStatBuffs(weapon: WeaponDef | undefined, char: Character, engine: BattleEngine): void {
    if (!weapon || weapon.tags.includes('imperial')) return
    for (const eff of weapon.effects ?? []) {
        if (eff.type === 'stat_buff') {
            for (const [attr, value] of Object.entries(eff.attrs)) {
                char.attrs.modify(attr as AttrName, -value)
                if (attr === 'agility')
                    engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'), char.getHaste())
            }
        }
    }
}

/** 清除角色的武器 buff 层（仅清除带 weapon tag 的 buff） */
export function clearWeaponBuffLayers(charId: string, engine: BattleEngine): void {
    for (const [k, layer] of engine.state.pendingBuffs) {
        const parts = k.split('::')
        if (parts.length < 2 || parts[1] !== charId) continue
        if (!layer.mods || Object.keys(layer.mods).length === 0) continue
        const buffDef = getBuff(parts[0])
        if (!buffDef?.tags?.includes('weapon')) continue
        const char = engine.getCharacter(charId)
        if (!char) continue
        for (const [attr, delta] of Object.entries(layer.mods)) {
            if (attr === 'maxApMod') {
                char.maxApMod -= delta as number
                char.capAp()
            } else {
                char.attrs.modify(attr as AttrName, -(delta as number))
                if (attr === 'agility')
                    engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'), char.getHaste())
            }
        }
        engine.state.pendingBuffs.delete(k)
        engine.state.turn.removeEvents('buff_end_' + k)
    }
}
