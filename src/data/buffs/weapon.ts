import { processActionEffect } from '../../engine/combat/effects'
import { round1 } from '../../engine/util/math'
import { BuffDef } from './types'

export const WEAPON_BUFFS: BuffDef[] = [
    {
        id: 'overlord_blade',
        name: '霸刀在手',
        description: '霸刀在手，身法受限但势不可挡。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { agility: -6, strength: 6 },
        onParryChance: ({ source }) => (source?.tags.includes('range') ? 0.5 : 0.2),
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = round1(blocked * 0.4)
            return raw - reduced
        },
    },
    {
        id: 'dark_iron_weight',
        name: '玄铁剑重',
        description: '玄铁剑的沉重负担与无锋剑意。身法受限但力道大增，命中+10%，暴击+10%，招架只能减免一半伤害。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        attrMods: { agility: -10, strength: 6 },
        onHitChance: () => 0.1,
        onCritChance: () => 0.1,
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const half = round1(blocked * 0.5)
            return raw - half
        },
    },
    {
        id: 'dinghai_pressure',
        name: '定海',
        description: '锭海神铁的压制力场，距离越近伤害越高。',
        tags: ['weapon', 'heavy'],
        expiry: { type: 'permanent' },
        attrMods: { agility: -12 },
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
        description: '势沉力猛，暴击率提升。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritChance: () => 0.15,
    },
    {
        id: 'chun_lei_buff',
        name: '春雷',
        description: '春雷灵巧加成，灵巧增伤。',
        tags: ['weapon', 'damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker }) => {
            const bonus = round1(attacker.attrs.get('dexterity') * 0.15)
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
