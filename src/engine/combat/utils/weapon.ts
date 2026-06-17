import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { WeaponDef } from '../../data/weapons'

/** 反转旧武器的 stat_buff 效果（御物除外） */
export function revertWeaponStatBuffs(weapon: WeaponDef | undefined, char: Character, engine: BattleEngine): void {
    if (!weapon || weapon.tags.includes('imperial')) return
    for (const eff of weapon.effects ?? []) {
        if (eff.type === 'stat_buff') {
            for (const [attr, value] of Object.entries(eff.attrs)) {
                char.attrs.modify(attr as AttrName, -value)
                if (attr === 'agility') engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'))
            }
        }
    }
}

/** 清除角色的所有 buff 层（含 mods 的） */
export function clearWeaponBuffLayers(charId: string, engine: BattleEngine): void {
    for (const [k, layer] of engine.state.pendingBuffs) {
        const parts = k.split('::')
        if (parts.length < 2 || parts[1] !== charId) continue
        if (!layer.mods || Object.keys(layer.mods).length === 0) continue
        const char = engine.getCharacter(charId)
        if (!char) continue
        for (const [attr, delta] of Object.entries(layer.mods)) {
            char.attrs.modify(attr as AttrName, -(delta as number))
            if (attr === 'agility') engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'))
        }
        engine.state.pendingBuffs.delete(k)
        engine.state.turn.removeEvents('buff_end_' + k)
    }
}
