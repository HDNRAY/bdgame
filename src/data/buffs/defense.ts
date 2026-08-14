import { processActionEffect } from '../../engine/combat/effects'
import { forEachBuffOf } from '../../engine/combat/utils'
import type { BuffDef } from './types'
import { Tag } from '../../engine/entities/tag'
import { round1 } from '../../engine/util/math'
import { calcRoll } from '../../engine/calc/damage'
import type { BattleState } from '../../engine/combat/types'

/** 统计角色身上所有醉酒（jiu tag）buff 的层数：additive 按 restoreValue 计层，independent 每层计1 */
function countDrunkLayers(state: BattleState, charId: string): number {
    let count = 0
    forEachBuffOf(state.pendingBuffs, charId, (def, layer) => {
        if (!def?.tags?.includes('jiu')) return
        count += def.stacking?.type === 'additive' ? (layer.restoreValue ?? 1) : 1
    })
    return count
}

export const DEFENSE_BUFFS: BuffDef[] = [
    {
        id: 'qi_shield',
        name: '炁盾',
        description: '吸收炁招式伤害，每次2点。',
        tags: ['defense'],
        onTakeDamage: ({ final, target, engine, source, layer, state }) => {
            if (!source?.tags?.includes('qi') || final <= 0 || layer.restoreValue <= 0) return final
            const absorb = Math.min(2, final)
            layer.restoreValue--
            engine?.emitLog({
                type: 'system',
                message: `[炁盾] ${target.name} 吸收${absorb}点（剩${layer.restoreValue}次）`,
                actorId: target.id,
            })
            if (layer.restoreValue <= 0) state.pendingBuffs.delete(`qi_shield::${target.id}`)
            return Math.max(0, Math.round((final - absorb) * 10) / 10)
        },
    },
    {
        id: 'dmg_reduce',
        name: '乌铠',
        description: '消耗AP减免拳脚/斩/刺/钝伤害（1AP减免4点，每场最多20次）。',
        tags: ['defense'],
        onTakeDamage: ({ final, target, source, engine, layer }) => {
            if (target.ap < 1 || final <= 4) return final
            const act = source
            if (!act?.tags?.some((t: Tag) => t === 'slash' || t === 'pierce' || t === 'unarmed' || t === 'blunt'))
                return final
            // 每场最多减免 20 次
            const uses = (layer.extra?.uses as number | undefined) ?? 0
            if (uses >= 20) return final
            target.spendAp(1)
            layer.extra = { ...(layer.extra ?? {}), uses: uses + 1 }
            engine?.emitLog({ type: 'system', message: `[乌铠] ${target.name} 消耗1AP减免4点`, actorId: target.id })
            return Math.max(0, Math.round((final - 4) * 10) / 10)
        },
    },
    {
        id: 'guard_up',
        name: '守势',
        description: '凝神防守，招架率大幅提升。',
        tags: ['defense', 'stance'],
        expiry: { type: 'duration', ms: 6000 },
        stacking: { type: 'none' },
        onParryChance: () => 0.3,
    },
    {
        id: 'wind_hear_buff',
        name: '听风',
        description: '听风辩位，闪避率提升。闪避后向对手前移。',
        tags: ['defense', 'stance'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'none' },
        onDodgeChance: () => 0.2,
        onDodged: ({ target, attacker, engine, state }) => {
            if (!engine) return
            processActionEffect(
                { type: 'short_dash', maxDistance: 2 },
                { self: target, enemy: attacker, engine, tMs: state.turn.currentTime },
            )
        },
    },
    {
        id: 'wan_liu_gui_zong',
        name: '归宗',
        description: '完全招架远程攻击。',
        tags: ['defense'],
        expiry: { type: 'duration', ms: 5000 },
        onParryChance: ({ source }) => {
            if (!source?.tags.includes('range')) return 0
            return 1
        },
    },
    {
        id: 'ranged_dodge',
        name: '斗笠掩踪',
        description: '距离≥5m时闪避+15%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onDodgeChance: ({ attacker, target, state }) => {
            const dist = state.position.distance(target.id, attacker.id)
            return dist >= 5 ? 0.15 : 0
        },
    },
    {
        id: 'elemental_immunity',
        name: '冰心',
        description: '冰心玉壶，免疫霜冻，对麻痹、灼烧有50%几率免疫。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'frost') return 0
            if (ctx.buffId === 'paralyze') {
                const { success } = calcRoll(0.5)
                if (success) return 0
            }
            if (ctx.buffId === 'burn') {
                const { success } = calcRoll(0.5)
                if (success) return 0
            }
            return undefined
        },
    },
    {
        id: 'ordinary_training',
        name: '平平无奇的锻炼',
        description: '日复一日的刻苦锻炼，身法提升闪避，灵巧提升招架。',
        tags: ['defense', 'inherent'],
        expiry: { type: 'permanent' },
        onDodgeChance: ({ target }) => {
            return target.attrs.get('agility') * 0.002
        },
        onParryChance: ({ target }) => {
            return target.attrs.get('dexterity') * 0.002
        },
    },
    {
        id: 'nuo_yi',
        name: '挪移',
        description: '以柔克刚，四两拨千斤。每点灵巧增加0.6%招架率与0.6%招架减伤。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onParryChance: ({ target }) => target.attrs.get('dexterity') * 0.006,
        onParryReduction: ({ final, target }) =>
            Math.max(0, round1(final * (1 - target.attrs.get('dexterity') * 0.006))),
        onCanParry: () => true,
    },
    {
        id: 'silk_guard',
        name: '金丝护手',
        description: '金丝手套护持，无刃亦可格挡兵刃，缴械抗性+30%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onCanParry: () => true,
        onDisarmChance: () => -0.3,
    },
    {
        id: 'paralyze_immunity',
        name: '雷体',
        description: '免疫麻痹。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'paralyze') return 0
            return undefined
        },
    },
    {
        id: 'dark_room_sense',
        name: '黑暗视觉',
        description: '暗室练就的敏锐感知，免疫迷眼。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'sand_blind') {
                const { success } = calcRoll(0.8)
                if (success) return 0
            }
            return undefined
        },
    },
    {
        id: 'thunder_constitution',
        name: '雷电锻体',
        description: '雷系伤害减免80%，其他伤害减免10%。',
        tags: ['defense', 'electric'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, source }) => {
            if (source?.tags?.includes('electric')) {
                return Math.round(final * 0.2 * 10) / 10
            }
            return Math.round(final * 0.9 * 10) / 10
        },
    },
    {
        id: 'poison_resist',
        name: '蛇毒不侵',
        description: '毒抗+60%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
    },
    {
        id: 'iron_defense',
        name: '铁布衫',
        description: '所受直伤-15%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final }) => Math.round(final * 0.85 * 10) / 10,
    },
    {
        id: 'stone_skin',
        name: '石肤',
        description: '肌肤如岩石般坚硬，所受直伤-10%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final }) => Math.round(final * 0.9 * 10) / 10,
    },
    {
        id: 'hua_gun_parry',
        name: '舞花棍',
        description: '灵巧转化为远程招架率。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onParryChance: ({ target, source }) => {
            const dex = target.attrs.get('dexterity')
            if (!source?.tags.includes('range')) return dex * 0.01
            return dex * 0.02
        },
    },
    {
        id: 'stance_armor',
        name: '罡体',
        description: '刚体护身，免疫眩晕、击退、打断、缴械、击倒，并减伤10%。',
        tags: ['super_armor', 'defense'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'none' },
        onTakeDamage: ({ final }) => round1(final * 0.9),
        onReceiveDebuff: (ctx) => {
            if (['stun', 'knockdown', 'disarmed'].includes(ctx.buffId)) return 0
            return undefined
        },
    },
    {
        id: 'lingxi_finger',
        name: '灵犀一指',
        description: '灵犀一指，空手可格挡兵刃，招架时缴械对手，灵巧+3。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        attrMods: { dexterity: 3 },
        onCanParry: () => true,
        onParried: ({ target, attacker, engine, state }) => {
            processActionEffect(
                { type: 'disarm', chance: 0.4 },
                { self: target, enemy: attacker, engine: engine!, tMs: state.turn.currentTime },
            )
        },
    },
    {
        id: 'xiu_li',
        name: '袖里',
        description: '千丝万缕，只在他衣袖之间。闪避获得1层缠劲；受伤消耗1层缠劲减免3点。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, target, engine }) => {
            if (!target.spendChan(1)) return final
            engine?.emitLog({
                type: 'system',
                message: `[袖里] ${target.name} 消耗1层缠劲减免3点（剩${target.chan}层）`,
                actorId: target.id,
            })
            return Math.max(0, Math.round((final - 3) * 10) / 10)
        },
    },
    {
        id: 'soft_armor',
        name: '软猬',
        description: '软猬甲护体，减免所有伤害；受拳脚攻击时反伤并叠流血。',
        tags: ['defense'],
        onTakeDamage: ({ final, target, attacker, engine, state, source }) => {
            const reduced = Math.max(0, Math.round((final - 1) * 10) / 10)
            if (
                source?.tags?.includes('unarmed') &&
                !source?.tags?.includes('qi') &&
                !source?.tags?.includes('range')
            ) {
                // attacker.takeDamage(1)
                // engine?.emitLog({
                //     type: 'system',
                //     message: `[软猬甲] ${target.name} 刺伤 ${attacker.name}，反伤1点`,
                //     actorId: target.id,
                // })
                const bleedKey = `bleed::${attacker.id}`
                const existing = state.pendingBuffs.get(bleedKey)
                if (existing) {
                    existing.restoreValue = (existing.restoreValue ?? 0) + 1
                } else {
                    state.pendingBuffs.set(bleedKey, {
                        restoreValue: 1,
                        sourceId: target.id,
                        extra: { bleedTriggerCount: 0 },
                    })
                }
                engine?.emitLog({
                    type: 'system',
                    message: `[软猬甲] ${attacker.name} 被刺伤，流血+1`,
                    actorId: attacker.id,
                })
            }
            return reduced
        },
    },
    {
        id: 'golden_bell_guard',
        name: '金玲',
        description: '金玲索护体，炁伤-2；招架时额外减免2点。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, source }) => {
            if (source?.tags?.includes('qi')) {
                return Math.max(0, Math.round((final - 2) * 10) / 10)
            }
            return final
        },
        onParryReduction: ({ final }) => Math.max(0, Math.round((final - 2) * 10) / 10),
    },
    {
        id: 'sword_intent_tempering',
        name: '剑意淬体',
        description: '剑意淬炼肉身，slash/pierce伤害减免20%，单次受伤不超过最大生命的15%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, target, source }) => {
            let dmg = final
            if (source?.tags?.includes('slash') || source?.tags?.includes('pierce')) {
                dmg = Math.round(dmg * 0.8 * 10) / 10
            }
            const cap = Math.round(target.maxHp * 0.15 * 10) / 10
            return Math.min(dmg, cap)
        },
    },
    {
        id: 'zui_quan_dodge',
        name: '醉步',
        description: '醉态蹒跚，以身为步。每点身法+0.6%闪避；有酒劲buff时闪避额外+20%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onDodgeChance: ({ target, state }) => {
            const base = target.attrs.get('agility') * 0.006
            // 身上有带 jiu tag 的 buff（烧刀子/女儿红/霸王醉等）时闪避额外+25%
            const hasJiu = countDrunkLayers(state, target.id) > 0
            return hasJiu ? base * 1.2 : base
        },
    },
    {
        id: 'qian_kun_fan_tan',
        name: '醉里乾坤',
        description: '受伤时10%概率消耗等量缠劲（1缠:1伤）反弹最多8点伤害，自身仅承受剩余伤害。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, attacker, target, engine }) => {
            if (attacker === target || Math.random() >= 0.1) return final
            const reflectDmg = Math.min(Math.round(final), 8)
            if (reflectDmg <= 0) return final
            if (!target.spendChan(reflectDmg)) return final
            attacker.takeDamage?.(reflectDmg)
            engine?.emitLog({
                type: 'system',
                message: `[醉里乾坤] ${target.name} 消耗${reflectDmg}缠反弹 ${reflectDmg} 点伤害给 ${attacker.name}，自承 ${round1(final - reflectDmg)} 点`,
                actorId: target.id,
            })
            return round1(final - reflectDmg)
        },
    },
    {
        id: 'combat_armor_def',
        name: '斗铠',
        description: '非炁伤害减免1点。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, source, attacker }) => {
            const isQi = source?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (isQi || final <= 0) return final
            return Math.max(0, Math.round((final - 1) * 10) / 10)
        },
    },
    {
        id: 'drunken_step',
        name: '醉仙望月步',
        description: '醉态越深，身法越飘忽。每层醉酒获得6%闪避。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDodgeChance: ({ state, target }) => 0.06 * countDrunkLayers(state, target.id),
    },
    {
        id: 'blood_qi_protection',
        name: '血炁护体',
        description: '消耗15%当前气血换取护体真气，减伤10%并持续恢复。',
        tags: ['buff', 'defense'],
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'none' },
        onTakeDamage: ({ final }) => Math.round(final * 0.9 * 10) / 10,
        tickInterval: 1000,
        onTickHeal: ({ layer }) => Math.max(0.1, round1(layer.restoreValue / 10)),
    },
    {
        id: 'zhu_ye_qing',
        name: '竹叶青',
        description: '每3秒回复3点气血，持续9秒。',
        tags: ['defense', 'jiu'],
        expiry: { type: 'duration', ms: 9000 },
        stacking: { type: 'additive', max: 3 },
        tickInterval: 3000,
        onTickHeal: () => 3,
    },
    {
        id: 'bu_lao_quan',
        name: '不老泉',
        description: '每层AP恢复+0.3/秒，持续9秒。',
        tags: ['defense', 'jiu'],
        expiry: { type: 'duration', ms: 9000 },
        stacking: { type: 'additive', max: 3 },
        apRegenPerSec: ({ layer }) => 0.3 * (layer.restoreValue ?? 1),
    },
    {
        id: 'nv_er_hong',
        name: '女儿红',
        description: '每秒回复1.5点气血，持续4秒。',
        tags: ['defense', 'jiu'],
        expiry: { type: 'duration', ms: 4000 },
        stacking: { type: 'additive', max: 3 },
        tickInterval: 1000,
        onTickHeal: () => 1.5,
    },
    {
        id: 'ba_wang_zui',
        name: '霸王醉',
        description: '每层每秒回复1点缠劲，持续9秒。',
        tags: ['defense', 'jiu'],
        expiry: { type: 'duration', ms: 9000 },
        stacking: { type: 'additive', max: 3 },
        chanRegenPerSec: ({ layer }) => 1 * (layer.restoreValue ?? 1),
    },
    {
        id: 'shao_dao_zi',
        name: '烧刀子',
        description: '每层暴击率+9%，持续9秒。',
        tags: ['defense', 'jiu'],
        expiry: { type: 'duration', ms: 9000 },
        stacking: { type: 'additive', max: 3 },
        onCritChance: ({ layer }) => 0.09 * (layer.restoreValue ?? 1),
    },
    {
        id: 'po_lang_zhu_zhi_buff',
        name: '破狼竹枝',
        description: '招架后减免3点伤害。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onParryReduction: ({ final }) => Math.max(0, Math.round((final - 3) * 10) / 10),
    },
    {
        id: 'bu_dong_ming_wang_buff',
        name: '不动明王',
        description: '招架成功时消耗1层缠劲，额外减免3点伤害。缠劲不足时不触发。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryReduction: ({ final, target, engine }) => {
            if (!target.spendChan(1)) return final
            engine?.emitLog({
                type: 'system',
                message: `[不动明王] ${target.name} 招架卸力，消耗1缠减免3点（剩${target.chan}层）`,
                actorId: target.id,
            })
            return Math.max(0, round1(final - 3))
        },
    },
    // ── 无刀取 ──
    {
        id: 'sword_capture',
        name: '无刀取',
        description: '空手入白刃。招架率+10%，招架成功后有50%概率缴械对手。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onCanParry: () => true,
        onParryChance: () => 0.1,
        onParried: ({ target, attacker, engine, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'disarm', chance: 0.3 },
                    { self: target, enemy: attacker, engine, tMs: state.turn.currentTime },
                )
            }
        },
    },
    // ── 料敌机先 ──
    {
        id: 'insight_awareness',
        name: '料敌机先',
        description: '每点洞察+0.5%招架率、+0.5%闪避率。',
        tags: [],
        expiry: { type: 'permanent' },
        onParryChance: ({ target }) => target.attrs.get('insight') * 0.005,
        onDodgeChance: ({ target }) => target.attrs.get('insight') * 0.005,
    },
    {
        id: 'ni_zhuan_jing_mai',
        name: '逆转经脉',
        description: '逆转经脉运行，概率抵抗麻痹，降低被暴击伤害。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onReceiveDebuff: ({ buffId }) => {
            if (buffId !== 'paralyze') return
            const { success } = calcRoll(0.6)
            if (success) return 0
        },
        // 减爆伤：暴击伤害倍率 1.5 → 1.0（完全不疼）
        onCritTakenDamage: () => -0.5,
    },
    {
        id: 'enhanced_vision_buff',
        name: '超强视觉·听劲',
        description: '触觉敏锐，招架时洞察化解。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryReduction: ({ final, target }) => Math.max(0, round1(final - target.attrs.get('insight') * 0.1)),
    },
    // ── 能量护盾（缠劲化盾：1缠吸1伤，直伤最多吸收三分之一，缠不足按比例吸收） ──
    {
        id: 'energy_shield_buff',
        name: '能量护盾',
        description: '缠劲化盾，直伤最多吸收三分之一（1缠:1伤，缠不足按比例吸收）。',
        tags: ['buff', 'craft', 'defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 只走直伤（onTakeDamage）；DoT 不触发
        onTakeDamage: ({ final, target, engine }) => {
            if (final <= 0 || !engine) return final
            const maxAbsorb = Math.floor(final / 3) // 最多吸收三分之一（向下取整：2伤→0不吸）
            const chanAbsorb = round1(target.chan) // 1缠:1伤，缠越多能吸越多
            const absorb = Math.min(maxAbsorb, chanAbsorb)
            if (absorb <= 0) return final
            target.spendChan(absorb)
            engine.emitLog({
                type: 'system',
                message: `[能量护盾] ${target.name} 缠化盾吸收${absorb}点（耗缠${absorb}，剩${target.chan}）`,
                actorId: target.id,
            })
            return Math.max(0, round1(final - absorb))
        },
    },
    {
        id: 'martial_arts_dodge',
        name: '武学·避',
        description: '暴击推演出的闪避预判，每层闪避+1%、招架+1%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        onDodgeChance: ({ layer }) => layer.restoreValue * 0.02,
        onParryChance: ({ layer }) => layer.restoreValue * 0.02,
    },
    {
        id: 'rocket_boost',
        name: '火箭推进',
        description: '喷气式机动装置的推进力，免疫击倒。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'knockdown') return 0
            return undefined
        },
    },
    {
        id: 'hun_yuan_gong_buff',
        name: '混元炁',
        description:
            '混元护体，近身受到超过8点或炁伤害时反伤所受伤害的一半（缠耗为反伤的一半），自身仍承受全额伤害并击退对手。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onTakeDamage: ({ final, attacker, target, engine, state, source }) => {
            if (final <= 0 || !engine || attacker === target) return final
            const dist = state.position.distance(target.id, attacker.id)
            if (dist > 1) return final
            const isHeavyHit = final > 8
            const isQiHit = source?.tags.includes('qi') ?? false
            if (!isHeavyHit && !isQiHit) return final

            // 反伤所受伤害的一半，缠耗为反伤的一半（即所受伤害的 1/4），缠不足则不反伤
            const reflectDmg = Math.max(1, Math.round(final * 0.5))
            const chanCost = Math.max(1, Math.round(reflectDmg * 0.5))
            if (!target.spendChan(chanCost)) return final
            attacker.takeDamage(reflectDmg, engine)
            processActionEffect(
                { type: 'knockback', distance: 1 },
                { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
            )
            engine.emitLog({
                type: 'system',
                message: `[混元炁] ${target.name}消耗${chanCost}缠反伤${reflectDmg}并击退${attacker.name}（自承${round1(final)}）`,
                actorId: target.id,
            })
            return final
        },
    },
    // ── 菩提珠（静心） ──
    {
        id: 'pu_ti_zhu_buff',
        name: '菩提静心',
        description: '静心凝神，50%免疫临时失心。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId !== 'fumble_chance_temp') return undefined
            const { success } = calcRoll(0.5)
            if (success) return 0
            return undefined
        },
    },
    {
        id: 'chanzi_stance',
        name: '金刚不坏',
        description: '金刚不坏体，反震敌手。受到伤害时反伤10%。',
        tags: ['buff', 'defense'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'none' },
        onTakeDamage: ({ final, attacker, target, engine }) => {
            if (final <= 0 || !engine || attacker === target) return final
            const reflectDmg = Math.max(1, Math.round(final * 0.1))
            attacker.takeDamage(reflectDmg, engine)
            engine.emitLog({
                type: 'system',
                message: `[金刚不坏] ${target.name}反伤${reflectDmg}给${attacker.name}`,
                actorId: target.id,
            })
            return final
        },
    },
    {
        id: 'jin_zhong_zhao',
        name: '金钟罩',
        description: '金钟罩体，罡气护身。吸收30点伤害，免疫硬控；盾未破时每10秒修复1点。',
        tags: ['super_armor', 'defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onReceiveDebuff: (ctx) => {
            if (['stun', 'knockdown', 'disarmed'].includes(ctx.buffId)) return 0
            return undefined
        },
        tickInterval: 10000,
        onTickHeal: ({ target, engine, layer }) => {
            if (!layer.extra) layer.extra = {}
            const cur = (layer.extra.shieldRemaining as number) ?? 30
            if (cur < 30) {
                layer.extra.shieldRemaining = Math.min(30, cur + 1)
                engine?.emitLog({
                    type: 'system',
                    message: `[金钟罩] ${target.name} 护盾修复+1（${layer.extra.shieldRemaining}/30）`,
                    actorId: target.id,
                })
            }
            return 0
        },
        onTakeDamage: ({ final, target, engine, layer, state }) => {
            if (final <= 0) return final
            if (!layer.extra) layer.extra = {}
            const remaining = (layer.extra.shieldRemaining as number) ?? 30
            const absorb = Math.min(remaining, final)
            layer.extra.shieldRemaining = Math.round((remaining - absorb) * 10) / 10
            engine?.emitLog({
                type: 'system',
                message: `[金钟罩] ${target.name} 吸收${absorb}点（${layer.extra.shieldRemaining}/30）`,
                actorId: target.id,
            })
            if (layer.extra.shieldRemaining <= 0) {
                state.pendingBuffs.delete(`jin_zhong_zhao::${target.id}`)
            }
            return Math.max(0, Math.round((final - absorb) * 10) / 10)
        },
    },
]
