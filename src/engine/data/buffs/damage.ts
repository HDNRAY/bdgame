import type { BuffDef } from './types'
import { MAX_CHAN } from '../../constants'
import type { ActionDefinition } from '../../entities/action'
import { processActionEffect } from '../../combat/effects'

export const DAMAGE_BUFFS: BuffDef[] = [
    {
        id: 'last_stand',
        name: '九死剑诀',
        description: '损失血量增伤。',
        tags: ['damage'],
        onDealDamage: ({ final, attacker, layer }) => {
            const ratio = layer.restoreValue
            if (ratio <= 0 || attacker.hp >= attacker.maxHp) return final
            const missingRatio = 1 - attacker.hp / attacker.maxHp
            return Math.round(final * (1 + missingRatio * ratio) * 10) / 10
        },
    },
    {
        id: 'extreme',
        name: '极',
        description: '缠劲满时获得，下次≥5AP招式消耗所有缠劲，每层+1%暴击率和+2%暴伤。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onCritChance: ({ source, attacker, layer, engine, state }) => {
            if (((source as ActionDefinition)?.apCost ?? 0) < 5 || attacker.chan < MAX_CHAN) {
                layer.restoreValue = 0
                return 0
            }
            const chan = attacker.chan
            attacker.spendChan(chan)
            layer.restoreValue = chan * 0.02
            const key = `extreme::${attacker.id}`
            state.pendingBuffs.delete(key)
            state.turn.removeEvents(`buff_end_${key}`)
            engine?.emitLog({
                type: 'system',
                message: `[极] ${attacker.name} 极意绽放，缠劲尽散`,
                actorId: attacker.id,
            })
            return chan * 0.01
        },
        onCritDamage: ({ layer }) => {
            if (!layer.restoreValue) return 0
            const bonus = layer.restoreValue
            layer.restoreValue = 0
            return bonus * 2
        },
    },
    {
        id: 'iaijutsu_focus',
        name: '居合·势',
        description: '招架或闪避后蓄势，每层暴击伤害+0.25。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        onCritDamage: ({ layer }) => layer.restoreValue * 0.25,
    },
    {
        id: 'frost_dex_bonus',
        name: '春雷',
        description: '春雷灵巧加成，灵巧增伤。',
        tags: ['weapon', 'damage'],
        expiry: { type: 'permanent' },
        attrMods: { strength: 4, agility: -2 },
        onDealDamage: ({ final, attacker }) =>
            Math.round((final + Math.round(attacker.attrs.get('dexterity') * 0.5 * 10) / 10) * 10) / 10,
    },
    {
        id: 'qi_amplify',
        name: '炁意',
        description: '凝炁玉增幅，炁系招式伤害根据推演加成。',
        tags: ['qi', 'damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, source }) => {
            const isQi = source?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (!isQi) return final
            const wis = attacker.attrs.get('wisdom')
            const mult = wis <= 4 ? 1.1 : wis >= 20 ? 1.3 : 1.1 + (wis - 4) * 0.0125
            return Math.round(final * mult * 10) / 10
        },
    },
    {
        id: 'yue_nv_buff',
        name: '越女剑意',
        description: '白猿授剑，灵巧化为剑势，附加灵巧×0.1伤害。',
        tags: ['pierce', 'slash', 'damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker }) =>
            Math.round((final + Math.round(attacker.attrs.get('dexterity') * 0.1 * 10) / 10) * 10) / 10,
    },
    {
        id: 'thunder_bonus',
        name: '雷法',
        description: '攻击附加3点雷击伤害（1点穿透）。',
        tags: ['qi', 'electric', 'damage'],
        expiry: { type: 'permanent' },
        onAfterDealDamage: () => ({ normal: 2, piercing: 1 }),
    },
    {
        id: 'cinnabar_mark',
        name: '守宫砂·印',
        description: '每次攻击积攒一颗雷印，满四颗后下一击爆发。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, layer, engine }) => {
            if (layer.restoreValue >= 4) {
                layer.restoreValue = 0
                engine?.emitLog({ type: 'system', message: '[守宫砂] 雷印爆发！伤害×1.5', actorId: attacker.id })
                return Math.round(final * 1.5 * 10) / 10
            }
            layer.restoreValue = (layer.restoreValue ?? 0) + 1
            engine?.emitLog({
                type: 'system',
                message: `[守宫砂] ${attacker.name} 雷印+1（${layer.restoreValue}/4）`,
                actorId: attacker.id,
            })
            return final
        },
    },
    {
        id: 'nineteen_stops',
        name: '十九停',
        description: '每层命中+3%、暴击+2%、暴伤+1%。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 19 },
        onHitChance: ({ layer }) => layer.restoreValue * 0.03,
        onCritChance: ({ layer }) => layer.restoreValue * 0.02,
        onCritDamage: ({ layer }) => layer.restoreValue * 0.01,
    },
    {
        id: 'tongtian',
        name: '通天大物',
        description: '悟生离死别，所有伤害受推演按AP加成。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, source }) => {
            const bonus = attacker.attrs.get('wisdom') * ((source as ActionDefinition)?.apCost ?? 1) * 0.1
            return Math.round((final + bonus) * 10) / 10
        },
    },
    {
        id: 'golden_light',
        name: '金光',
        description: '金光咒护体，受伤时消耗1层缠劲减免3点；非御物攻击消耗1层缠劲附加2点伤害。',
        tags: ['qi', 'defense', 'damage'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, target, engine }) => {
            if (target.chan <= 0) return final
            target.spendChan(1)
            engine?.emitLog({
                type: 'system',
                message: `[金光咒] ${target.name} 消耗1层缠劲减免3点（剩${target.chan}层）`,
                actorId: target.id,
            })
            return Math.max(0, Math.round((final - 3) * 10) / 10)
        },
        onAfterDealDamage: ({ source, attacker, engine }) => {
            if (source?.tags?.includes('imperial') || attacker.chan < 1) return 0
            attacker.spendChan(1)
            engine?.emitLog({
                type: 'system',
                message: `[金光咒] ${attacker.name} 消耗1层缠劲，附加2点伤害`,
                actorId: attacker.id,
            })
            return 2
        },
    },
    {
        id: 'blood_sacrifice',
        name: '血祭',
        description: '每招消耗3%最大气血，其中50%化为额外伤害，并开始气血回溯5%。',
        tags: ['damage'],
        expiry: { type: 'permanent' },
        onAction: ({ source, attacker, engine, state, layer }) => {
            if (!source || attacker.hp <= 0) return
            if (source.tags.includes('pre_action')) return
            const cost = Math.max(1, Math.round(attacker.maxHp * 0.03 * 10) / 10)
            if (attacker.hp <= cost) return
            attacker.takeDamage(cost)
            layer.restoreValue = cost
            // 追加独立的气血回溯（记录总回复量 = 5% maxHP，分10秒恢复）
            if (engine) {
                const totalRecovery = Math.round(attacker.maxHp * 0.015 * 10) / 10
                processActionEffect(
                    { type: 'add_buff', buffId: 'blood_recovery', stacks: totalRecovery },
                    attacker,
                    attacker,
                    engine,
                    state.turn.currentTime,
                )
            }
        },
        onDealDamage: ({ final, layer }) => {
            const cost = layer.restoreValue ?? 0
            if (cost <= 0) return final
            return Math.round((final + cost * 0.5) * 10) / 10
        },
    },
]
