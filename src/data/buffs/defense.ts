import { processActionEffect } from '../../engine/combat/effects'
import type { BuffDef } from './types'
import { Tag } from '../../engine/entities/tag'
import { round1 } from '../../engine/util/math'
import { calcRoll } from '../../engine/calc/damage'

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
        description: '消耗AP减免斩/刺/钝伤害。',
        tags: ['defense'],
        onTakeDamage: ({ final, target, source, engine }) => {
            if (target.ap < 1 || final <= 4) return final
            const act = source
            if (!act?.tags?.some((t: Tag) => t === 'slash' || t === 'pierce' || t === 'unarmed')) return final
            target.spendAp(1)
            engine?.emitLog({ type: 'system', message: `[乌铠] ${target.name} 消耗1AP减免2点`, actorId: target.id })
            return Math.max(0, Math.round((final - 2) * 10) / 10)
        },
    },
    {
        id: 'guard_up',
        name: '守势',
        description: '凝神防守，招架率大幅提升。',
        tags: ['defense', 'stance'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'none' },
        onParryChance: () => 0.5,
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
        tags: ['defense', 'stance'],
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
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onDodgeChance: ({ attacker }) => {
            return attacker.attrs.get('agility') * 0.005
        },
        onParryChance: ({ attacker }) => {
            return attacker.attrs.get('dexterity') * 0.005
        },
    },
    {
        id: 'nuo_yi',
        name: '挪移',
        description: '以柔克刚，四两拨千斤。你加每点灵巧减少1%所受伤害。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, target }) => {
            const dexReduction = (target.attrs.get('dexterity') - 3) * 0.01
            return Math.round(final * (1 - dexReduction) * 10) / 10
        },
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
        description: '所受直伤-20%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final }) => Math.round(final * 0.8 * 10) / 10,
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
        name: '花棍',
        description: '灵巧转化为远程招架率。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onParryChance: ({ attacker, source }) => {
            if (!source?.tags.includes('range')) return 0
            return attacker.attrs.get('dexterity') * 0.02
        },
    },
    {
        id: 'stance_armor',
        name: '罡体',
        description: '刚体护身，免疫眩晕、击退、打断、缴械、击倒。',
        tags: ['super_armor', 'defense'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'none' },
        onReceiveDebuff: (ctx) => {
            if (['stun', 'stagger', 'knockdown', 'fumble_chance'].includes(ctx.buffId)) return 0
            return undefined
        },
    },
    {
        id: 'lingxi_finger',
        name: '灵犀一指',
        description: '灵犀一指，空手可格挡兵刃，招架时缴械对手，灵巧+4。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        attrMods: { dexterity: 4 },
        onCanParry: () => true,
        onParried: ({ target, attacker, engine, state }) => {
            processActionEffect(
                { type: 'disarm', chance: 1 },
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
            if (target.chan <= 0) return final
            target.spendChan(1)
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
                attacker.takeDamage(1)
                engine?.emitLog({
                    type: 'system',
                    message: `[软猬甲] ${target.name} 刺伤 ${attacker.name}，反伤2点`,
                    actorId: target.id,
                })
                const bleedKey = `bleed::${attacker.id}`
                const existing = state.pendingBuffs.get(bleedKey)
                if (existing) {
                    existing.restoreValue = (existing.restoreValue ?? 0) + 1
                } else {
                    state.pendingBuffs.set(bleedKey, {
                        restoreValue: 1,
                        extra: { bleedTriggerCount: 0, source: target.name, sourceId: target.id },
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
        description: '剑意淬炼肉身，slash/pierce伤害减免20%，单次受伤不超过最大生命的25%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, target, source }) => {
            let dmg = final
            if (source?.tags?.includes('slash') || source?.tags?.includes('pierce')) {
                dmg = Math.round(dmg * 0.8 * 10) / 10
            }
            const cap = Math.round(target.maxHp * 0.25 * 10) / 10
            return Math.min(dmg, cap)
        },
    },
    {
        id: 'zui_quan_dodge',
        name: '醉步',
        description: '醉态蹒跚，闪避率+5%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onDodgeChance: () => 0.05,
    },
    {
        id: 'qian_kun_fan_tan',
        name: '乾坤大挪移',
        description: '受伤时25%概率消耗2缠反弹最多30点伤害，自身仅承受剩余伤害。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, attacker, target, engine }) => {
            if (attacker === target || Math.random() >= 0.25) return final
            if (target.chan < 2) return final
            const reflectDmg = Math.min(Math.round(final), 30)
            if (reflectDmg <= 0) return final
            target.spendChan(2)
            attacker.takeDamage?.(reflectDmg)
            engine?.emitLog({
                type: 'system',
                message: `[乾坤大挪移] ${target.name} 消耗2缠反弹 ${reflectDmg} 点伤害给 ${attacker.name}，自承 ${final - reflectDmg} 点`,
                actorId: target.id,
            })
            return final - reflectDmg
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
        id: 'drunken_dodge',
        name: '醉仙望月步',
        description: '闪避+15%。',
        tags: ['defense'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'none' },
        onDodgeChance: () => 0.15,
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
        id: 'drunken_step_watcher',
        name: '醉仙望月',
        description: '饮酒后触发，获得15%闪避。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onAction: ({ source, target, engine, state }) => {
            if (!source?.tags.includes('jiu')) return
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'drunken_dodge', stacks: 1 },
                    { self: target, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
        },
    },
    {
        id: 'zhu_ye_qing',
        name: '竹叶青',
        description: '每秒回复1%气血，持续10秒。',
        tags: ['defense'],
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'none' },
        tickInterval: 1000,
        onTickHeal: ({ target }) => Math.round(target.maxHp * 0.01 * 10) / 10,
    },
    {
        id: 'bu_lao_quan',
        name: '不老泉',
        description: 'AP恢复速度增加，持续15秒。',
        tags: ['defense'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'none' },
        tickInterval: 1000,
        onTickHeal: ({ target, engine }) => {
            const apGain = Math.max(1, Math.round(target.attrs.get('wisdom') * 0.2))
            target.ap = Math.min(target.maxAp, target.ap + apGain)
            engine?.emitLog({
                type: 'system',
                message: `[不老泉] ${target.name} AP +${apGain}`,
                actorId: target.id,
            })
            return 0
        },
    },
    {
        id: 'shao_dao_zi',
        name: '烧刀子',
        description: '烈酒烧心，暴击率+50%，持续15秒。',
        tags: ['defense'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'none' },
        onCritChance: () => 0.5,
    },
    {
        id: 'po_lang_zhu_zhi_buff',
        name: '破狼竹枝',
        description: '招架后减免3点伤害。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onParryReduction: ({ final }) => Math.max(0, Math.round((final - 3) * 10) / 10),
    },
    // ── 无刀取 ──
    {
        id: 'sword_capture',
        name: '无刀取',
        description: '空手入白刃。招架成功后有50%概率缴械对手。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        onCanParry: () => true,
        onParried: ({ target, attacker, engine, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'disarm', chance: 0.5 },
                    { self: target, enemy: attacker, engine, tMs: state.turn.currentTime },
                )
            }
        },
    },
    // ── 料敌机先 ──
    {
        id: 'combat_instinct',
        name: '料敌机先',
        description: '每点洞察+1%招架率、+1%闪避率。',
        tags: [],
        expiry: { type: 'permanent' },
        onParryChance: ({ attacker }) => attacker.attrs.get('insight') * 0.005,
        onDodgeChance: ({ attacker }) => attacker.attrs.get('insight') * 0.005,
    },
    {
        id: 'ni_zhuan_jing_mai',
        name: '逆转经脉',
        description: '逆转经脉运行，概率抵抗麻痹，降低被暴击率。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onReceiveDebuff: ({ buffId }) => {
            if (buffId !== 'paralyze') return
            const { success } = calcRoll(0.6)
            if (success) return 0
        },
        onCritTakenChance: () => -0.5,
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
    // ── 能量护盾 ──
    {
        id: 'energy_shield_buff',
        name: '能量护盾',
        description: '吸收6点以下伤害，共50点。AP上限-1。',
        tags: ['buff', 'craft', 'defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        maxApMod: -1,
        onTakeDamage: ({ final, target, engine, layer }) => {
            if (final <= 0 || !engine) return final
            if (!layer.extra) layer.extra = { absorbed: 0 }
            const prev = (layer.extra.absorbed as number) ?? 0
            const remaining = 50 - prev
            if (remaining <= 0) return final
            const absorb = Math.min(6, final, remaining)
            const overflow = final - absorb
            const newVal = prev + absorb
            layer.extra.absorbed = newVal
            if (newVal >= 50) {
                engine.emitLog({
                    type: 'system',
                    message: `[能量护盾] 耗尽！吸收${absorb}点（50/50）${overflow > 0 ? `，溢出${overflow}点` : ''}`,
                    actorId: target.id,
                })
                if (layer.mods?.maxApMod) {
                    target.maxApMod -= layer.mods.maxApMod as number
                    target.capAp()
                }
                engine.state.pendingBuffs.delete(`energy_shield_buff::${target.id}`)
                return overflow > 0 ? overflow : 0
            }
            engine.emitLog({
                type: 'system',
                message: `[能量护盾] 吸收${absorb}点（${Math.round(newVal * 10) / 10}/50）`,
                actorId: target.id,
            })
            return Math.max(0, Math.round(overflow * 10) / 10)
        },
    },
    {
        id: 'martial_arts_dodge',
        name: '武学·避',
        description: '暴击推演出的闪避预判，每层闪避+1%、招架+1%。',
        tags: ['defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        onDodgeChance: ({ layer }) => layer.restoreValue * 0.01,
        onParryChance: ({ layer }) => layer.restoreValue * 0.01,
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
]
