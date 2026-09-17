import type { AttrName } from './attributes'
import type { EffectDef } from './action'
import type { Character } from './character'
import { getWeapon } from '../../data/weapons/weapons'

/**
 * 构造期效果分发表（无战斗上下文）。
 *
 * 只处理「建立角色」这一步就能定下来的效果：属性加减、上限修正、触发槽上限、武器 tag、急速回调等。
 * 战斗中的效果走 `combat/effects/handlers.ts`，两边不要混。
 */
const handlers: Record<string, (char: Character, eff: EffectDef, sourceTags?: string[]) => void> = {
    haste(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'haste' }>
        if (e.value) char.haste += e.value
        if (e.eval) char.hasteCallbacks.push(e.eval)
    },
    buff_duration_mult(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'buff_duration_mult' }>
        if (e.eval) char.buffDurationCallbacks.push(e.eval)
    },
    attr_floor(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'attr_floor' }>
        for (const [attr, value] of Object.entries(e.attrs)) {
            char.attrs.minValues[attr as AttrName] = value
        }
    },
    stat_buff(char, eff, sourceTags) {
        const e = eff as Extract<EffectDef, { type: 'stat_buff' }>
        for (const [attr, value] of Object.entries(e.attrs)) {
            let delta = value as number
            for (const check of char.statRestrictionChecks ?? []) {
                const cur = char.attrs.get(attr as AttrName)
                const result = check(char, attr, cur, delta, sourceTags)
                if (!result) continue
                if (result.skip) {
                    delta = 0
                    break
                }
                if (result.delta !== undefined) delta = result.delta
            }
            if (delta === 0) continue
            const cur = char.attrs.get(attr as AttrName)
            char.attrs.set(attr as AttrName, cur + delta)
        }
    },
    stat_restriction(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'stat_restriction' }>
        char.statRestrictionChecks.push(e.check)
    },
    // 义体效果（构造期执行）
    max_hp_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'max_hp_mod' }>
        char.maxHpMod += e.value
    },
    trigger_slot_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'trigger_slot_mod' }>
        if (e.fn) {
            char.triggerSlotMod += e.fn(char)
        } else {
            char.triggerSlotMod += e.value ?? 0
        }
    },
    attr_convert(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'attr_convert' }>
        const src = char.attrs.get(e.from)
        const delta = e.mode === 'floor' ? Math.floor(src * e.ratio) : Math.round(src * e.ratio)
        for (const attr of e.to) {
            char.attrs.modify(attr as AttrName, delta)
        }
    },
    dodge_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'dodge_mod' }>
        char.dodgeMod += e.value
    },
    parry_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'parry_mod' }>
        char.parryMod += e.value
    },
    weapon_tag(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'weapon_tag' }>
        char.pendingWeaponTags.push(e.tag)
        const weapon = char.weaponDef ?? getWeapon(char.build.weapon)
        if (!weapon.tags.includes(e.tag)) {
            char.weaponDef = { ...weapon, tags: [...weapon.tags, e.tag] }
        }
    },
}

/** 应用一条构造期效果（`sourceTags` 供属性限制回调判断来源，如 `['weapon']`） */
export function applyPassiveEffect(type: string, char: Character, eff: EffectDef, sourceTags?: string[]): void {
    handlers[type]?.(char, eff, sourceTags)
}
