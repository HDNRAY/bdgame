import { processActionEffect } from '../../engine/combat/effects'
import { round1 } from '../../engine/util/math'
import type { Character } from '../../engine/entities/character'
import type { BattleState } from '../../engine/combat/types'
import { forEachBuffOf, revertBuffMods } from '../../engine/combat/utils'
import { applyAttrMods } from '../../engine/combat/utils/buff-layer'
import { BuffDef } from './types'

/** 重器负担：力量不足按差值扣身法；身上带 heavy_reduce 标记的 buff（玄剑/潮汐）各减 2 点 */
function calcHeavyPenalty(char: Character, tier: number, state: BattleState): number {
    // 实际力道 = 角色当前力量（重武器自身不提供力量，战斗 buff 的力量变化会反映到这里）
    const realStr = char.attrs.get('strength')
    const diff = Math.max(0, tier - realStr)
    let reduce = 0
    forEachBuffOf(state.pendingBuffs, char.id, (def) => {
        if (def?.tags?.includes('heavy_reduce')) reduce += 2
    })
    return Math.max(0, diff - reduce)
}

export const WEAPON_BUFFS: BuffDef[] = [
    {
        id: 'heavy_load',
        name: '重器负担',
        description: '力量不足以驾驭重器，身法受限。力量每差1点身法-1；玄剑/潮汐可化解部分负担。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 首次建层即初始化惩罚（restoreValue 即力道档位）；战斗中力道变化由 onTurnEnd 按当前力量重算
        onBuffApplied: ({ self: char, state, layer }) => {
            const tier = layer.restoreValue ?? 0
            layer.extra = { inited: true, tier }
            const pen = calcHeavyPenalty(char, tier, state)
            if (pen > 0) {
                const mods = applyAttrMods(char, state, { agility: -pen }, '重器负担')
                layer.mods = mods
            }
        },
        // 战斗中力道变化（血战到底/七十二变等）在回合末刷新惩罚
        onTurnEnd: ({ attacker: char, state, layer }) => {
            if (!layer.extra?.inited) return
            const tier = (layer.extra.tier as number) ?? 0
            const pen = calcHeavyPenalty(char, tier, state)
            const current = Math.abs((layer.mods?.agility as number) ?? 0)
            if (current === pen) return
            if (current > 0) revertBuffMods(layer, char, state)
            if (pen > 0) {
                const mods = applyAttrMods(char, state, { agility: -pen }, '重器负担')
                layer.mods = mods
            } else {
                layer.mods = undefined
            }
        },
    },
    {
        id: 'overlord_blade',
        name: '霸刀在手',
        description: '离心力驱动的巨刃，势不可挡。近战招架率+20%，远程+50%，招架减免减半。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryChance: ({ source }) => (source?.tags.includes('range') ? 0.5 : 0.2),
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = round1(blocked * 0.5)
            return raw - reduced
        },
    },
    {
        id: 'dark_iron_weight',
        name: '玄铁剑重',
        description: '玄铁重剑，无锋无刃。命中+15%，暴击+10%，招架减免减半。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        onHitChance: () => 0.15,
        onCritChance: () => 0.1,
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const kept = round1(blocked * 0.4)
            return raw - kept
        },
    },
    {
        id: 'dinghai_pressure',
        name: '定海',
        description: '锭海神铁的压制力场，距离越近伤害越高。',
        tags: ['weapon', 'heavy'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, target, state, source }) => {
            // 召唤物（分身等）不吃本体武器的距离加成
            if (source?.tags?.includes('summon')) return final
            const dist = state.position.distance(attacker.id, target.id)
            const bonus = round1((attacker.attrs.get('strength') * 0.6 * Math.max(0, 6 - dist)) / 6)
            return round1(final + bonus)
        },
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = round1(blocked * 0.6)
            return raw - reduced
        },
    },
    {
        id: 'zhen_bei_ji_buff',
        name: '镇北戟',
        description: '千星重铸的赛博战戟。击中施加霜冻，被招架施加麻痹，被闪避叠游身。',
        tags: ['weapon', 'electric', 'polearm'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, attacker, target, engine, state, source }) => {
            if (engine && source && !source.tags?.includes('internal')) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'frost', stacks: 1, chance: 1 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
            return final
        },
    },
    {
        id: 'engine_hammer_buff',
        name: '引擎铁锤',
        description: '天工锻造的电磁锤。maxAP-1，所有伤害附加推演×0.1。',
        tags: ['weapon', 'electric', 'blunt'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, attacker }) => {
            const bonus = round1(attacker.attrs.get('wisdom') * 0.1)
            return final + bonus
        },
    },
    {
        id: 'xiu_dong_buff',
        name: '绣冬',
        description: '势沉力猛，力道化为锋芒。力道×0.14 附加伤害。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, attacker }) => {
            const bonus = round1(attacker.attrs.get('strength') * 0.14)
            return final + bonus
        },
    },
    {
        id: 'po_jun_buff',
        name: '破军',
        description: '丈二铁枪，势大力沉。暴击率+5%，暴击伤害+10%。',
        tags: ['weapon', 'pierce'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritChance: () => 0.05,
        onCritDamage: () => 0.1,
    },
    {
        id: 'chun_lei_buff',
        name: '春雷',
        description: '春雷灵巧加成，灵巧增伤。',
        tags: ['weapon', 'damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker }) => {
            const bonus = round1(attacker.attrs.get('dexterity') * 0.14)
            return final + bonus
        },
    },
    {
        id: 'buer_sword',
        name: '不二剑灵',
        description: '最快的剑之一，出剑必中要害，暴击率+15%。',
        tags: ['weapon', 'damage'],
        expiry: { type: 'permanent' },
        onCritChance: () => 0.15,
    },
    {
        id: 'iron_back_buff',
        name: '无相',
        description: '玉环化甲，拳劲透体，伤害穿透。免疫缴械。',
        tags: ['damage', 'weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDisarmChance: () => -1,
        onDealDamage: ({ final }) => {
            const pierce = Math.round(final / 3)
            return { normal: final - pierce, piercing: pierce }
        },
    },
]
