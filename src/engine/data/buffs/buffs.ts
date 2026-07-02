import { processActionEffect } from '../../combat/effects'
import { revertBuffMods } from '../../combat/utils'
import { applyAttrMods } from '../../combat/utils/buff-layer'
import { MAX_CHAN } from '../../constants'
import { Tag } from '../../entities/tag'
import { calcParryChance } from '../../calc/damage'
import type { BuffDef } from './types'

/** 增益状态 */
export const BUFF_DB: BuffDef[] = [
    // ── 战斗状态 ──
    {
        id: 'iaijutsu',
        name: '居合',
        description: '拔刀之势，蓄势待发。',
        tags: ['stance'],
        stacking: { type: 'none' },
    },
    {
        id: 'foresight',
        name: '看破',
        description: '洞察先机，招架率+30%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_parry' },
        stacking: { type: 'none' },
        onParryChance: () => 0.3,
    },
    {
        id: 'kanchuan',
        name: '看穿',
        description: '看穿对手攻击轨迹，闪避率+10%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_dodge' },
        stacking: { type: 'none' },
        onDodgeChance: () => 0.1,
    },
    {
        id: 'mind_eye',
        name: '心眼',
        description: '心眼已开，暴击率+25%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_crit' },
        stacking: { type: 'none' },
        onCritChance: () => 0.25,
    },
    {
        id: 'melee_stance',
        name: '守拙',
        description: '持械架势，招架率+10%。',
        tags: ['stance'],
        expiry: { type: 'permanent' },
        onParryChance: () => 0.1,
    },
    {
        id: 'polearm_stance',
        name: '撼岳',
        description: '重器架势，命中率+10%。',
        tags: ['stance'],
        expiry: { type: 'permanent' },
        onHitChance: () => 0.1,
    },
    {
        id: 'fist_stance',
        name: '穿花',
        description: '空手架势，闪避率+10%。',
        tags: ['stance'],
        expiry: { type: 'permanent' },
        onDodgeChance: () => 0.1,
    },
    {
        id: 'circle',
        name: '圆',
        description: '下次攻击，命中+40%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_hit' },
        stacking: { type: 'none' },
        onHitChance: () => 0.5,
    },
    {
        id: 'blade_qi',
        name: '刀炁',
        description: '每层增伤5%。累计10点治疗消一层。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        onTakeDamage: ({ final, layer }) => Math.round(final * (1 + layer.restoreValue * 0.05) * 10) / 10,
        onReceiveHeal: ({ layer, engine, target, final: amount }) => {
            const HEAL_PER_STACK = 10
            const acc = (layer.extra?.healAccumulator as number) ?? 0
            const total = acc + amount
            if (total < HEAL_PER_STACK) {
                layer.extra = { ...layer.extra, healAccumulator: total }
                return
            }
            const reduce = Math.min(layer.restoreValue, Math.floor(total / HEAL_PER_STACK))
            layer.restoreValue -= reduce
            layer.extra = { ...layer.extra, healAccumulator: total - reduce * HEAL_PER_STACK }
            engine?.emitLog({
                type: 'system',
                message: `[治疗] ${target?.name ?? ''} 刀炁 -${reduce}层，剩${layer.restoreValue}层`,
                actorId: target.id,
            })
        },
    },
    {
        id: 'overlord_blade',
        name: '霸刀在手',
        description: '霸刀在手，身法受限但势不可挡。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { agility: -8, strength: 4 },
        onParryChance: () => 0.2,
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = Math.round(blocked * 0.2 * 10) / 10
            return raw - reduced
        },
    },
    {
        id: 'overlord_art_buff',
        name: '霸刀刀路',
        description: '霸刀巨刃配合离心力，重器加持，命中+15%。',
        tags: [],
        expiry: { type: 'permanent' },
        onHitChance: ({ attacker }) => (attacker.weaponDef?.tags.includes('heavy') ? 0.15 : 0),
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '凝炁为刃，或凝炁与刃',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
    },

    // ── 属性类 ──
    {
        id: 'stat_multiply',
        name: '超越',
        description: '属性临时倍增。',
        tags: [],
        expiry: { type: 'duration_by_attr', attr: 'wisdom', multiplier: 150 },
        stacking: { type: 'independent' },
    },
    { id: 'stat_buff', name: '内劲', description: '属性临时变化。', tags: [], stacking: { type: 'independent' } },
    {
        id: 'stat_transfer',
        name: '汲取',
        description: '吸取目标属性。',
        tags: [],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'independent' },
    },

    {
        id: 'qi_shield',
        name: '炁盾',
        description: '吸收炁招式伤害，每次2点。',
        tags: [],
        onTakeDamage: ({ final, target, attacker, engine, action, layer, state }) => {
            const act = action
            const isQi = act?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (!isQi || final <= 0 || layer.restoreValue <= 0) return final
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
        tags: [],
        onTakeDamage: ({ final, target, action, engine }) => {
            if (target.ap < 1 || final <= 4) return final
            const act = action
            if (!act?.tags?.some((t: Tag) => t === 'slash' || t === 'pierce' || t === 'unarmed')) return final
            target.spendAp(1)
            engine?.emitLog({ type: 'system', message: `[乌铠] ${target.name} 消耗1AP减免2点`, actorId: target.id })
            return Math.max(0, Math.round((final - 2) * 10) / 10)
        },
    },
    {
        id: 'dimensional_blade',
        name: '次元刃',
        description: '凝炁为刃，削弱招架减伤效果。',
        tags: ['qi'],
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = Math.round(blocked * 0.3 * 10) / 10
            return raw - reduced
        },
    },
    {
        id: 'zuoyou_hubo',
        name: '左右互搏',
        description: '一次行动可使用两次主招式，非辅助招式AP-1。',
        tags: [],
        onActionCost: ({ action }) =>
            action && !action.tags.includes('pre_action') && !action.tags.includes('post_action') && action.apCost > 0
                ? -1
                : 0,
    },
    {
        id: 'last_stand',
        name: '九死剑诀',
        description: '损失血量增伤。',
        tags: [],
        onDealDamage: ({ final, attacker, layer }) => {
            const ratio = layer.restoreValue
            if (ratio <= 0 || attacker.hp >= attacker.maxHp) return final
            const missingRatio = 1 - attacker.hp / attacker.maxHp
            return Math.round(final * (1 + missingRatio * ratio) * 10) / 10
        },
    },

    // ── 内部追踪 ──
    { id: 'stun_track', name: '眩晕连续', description: '连续眩晕计数（5秒窗口）。', tags: [] },
    { id: 'steal_artifact_track', name: '盗亦有道', description: '飞龙探云手的成功率追踪。', tags: [] },

    // ── 战斗状态 ──
    {
        id: 'chan_orb_regen',
        name: '凝缠珠·流转',
        description: '凝缠珠之力流转不息，每2秒恢复3点缠劲。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 2000,
        onTickHeal: ({ attacker, engine }) => {
            attacker.addChan(3)
            engine?.emitLog({
                type: 'system',
                message: `[凝缠珠] ${attacker.name} 缠劲+3（${attacker.chan}层）`,
                actorId: attacker.id,
            })
            return 0
        },
    },
    {
        id: 'extreme',
        name: '极',
        description: '缠劲满时获得，下次≥5AP招式消耗所有缠劲，每层+1%暴击率和+2%暴伤。',
        tags: [],
        expiry: { type: 'permanent' },
        onCritChance: ({ action, attacker, layer, engine, state }) => {
            if ((action?.apCost ?? 0) < 5 || attacker.chan < MAX_CHAN) {
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
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        onCritDamage: ({ layer }) => layer.restoreValue * 0.25,
    },
    {
        id: 'guard_up',
        name: '守势',
        description: '凝神防守，招架率大幅提升。',
        tags: [],
        value: 0.35,
        expiry: { type: 'consumed', trigger: 'on_parry' },
        stacking: { type: 'none' },
        onParryChance: () => 0.35,
    },
    {
        id: 'frost_dex_bonus',
        name: '春雷',
        description: '春雷灵巧加成，灵巧增伤。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        attrMods: { strength: 4, agility: -2 },
        onDealDamage: ({ final, attacker }) =>
            Math.round((final + Math.round(attacker.attrs.get('dexterity') * 0.5 * 10) / 10) * 10) / 10,
    },
    {
        id: 'ranged_dodge',
        name: '斗笠掩踪',
        description: '距离≥5m时闪避+15%。',
        tags: [],
        expiry: { type: 'permanent' },
        onDodgeChance: ({ attacker, target, state }) => {
            const dist = state.position.distance(target.id, attacker.id)
            return dist >= 5 ? 0.15 : 0
        },
    },
    {
        id: 'elemental_immunity',
        name: '冰心',
        description: '免疫冰霜、麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'phantom_step',
        name: '魅影',
        description: '身法+1，持续5秒。可独立叠加。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'independent' },
        attrMods: { agility: 1 },
    },
    {
        id: 'min_move_cost',
        name: '跑得贼快',
        description: '步法精妙，移动消耗最低。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'ordinary_training',
        name: '平平无奇的锻炼',
        description: '日复一日的刻苦锻炼，身法提升闪避，灵巧提升招架。',
        tags: [],
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
        tags: [],
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
        tags: [],
        expiry: { type: 'permanent' },
        onCanParry: () => true,
        onDisarmChance: () => -0.3,
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '持续恢复生命，血越少恢复越多。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 1000,
        onTickHeal: ({ target }) => Math.round((target.maxHp - target.hp) * 0.01),
    },
    {
        id: 'qi_state',
        name: '凝炁状态',
        description: '炁劲充盈全身，全属性+1，炁系效果可作用于所有招式。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1 },
    },
    {
        id: 'qi_amplify',
        name: '炁意',
        description: '凝炁玉增幅，炁系招式伤害+15%。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, action, state }) => {
            const hasQiState = state.pendingBuffs.has(`qi_state::${attacker.id}`)
            const isQi = action?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi') || hasQiState
            if (!isQi) return final
            return Math.round(final * 1.1 * 10) / 10
        },
    },
    {
        id: 'paralyze_immunity',
        name: '雷体',
        description: '免疫麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'vigor_stance',
        name: '刚劲',
        description: '剑势·刚，力道+4/层，身法-2/层。最多2层。',
        tags: [],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { strength: 4, agility: -2 },
    },
    {
        id: 'gentle_stance',
        name: '柔劲',
        description: '剑势·柔，身法+4/层，力道-2/层。最多2层。',
        tags: [],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { agility: 4, strength: -2 },
    },
    {
        id: 'dark_room_sense',
        name: '暗室雀眼',
        description: '暗室练就的敏锐感知，免疫迷眼。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'yue_nv_buff',
        name: '越女剑意',
        description: '白猿授剑，灵巧化为剑势，附加灵巧×0.1伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker }) =>
            Math.round((final + Math.round(attacker.attrs.get('dexterity') * 0.1 * 10) / 10) * 10) / 10,
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '每 5 秒自动化解一层毒素，且恢复3点气血。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 5000,
        onTickHeal: ({ target, engine, state }) => {
            const poisonKey = `poison::${target.id}`
            const poisonLayer = state.pendingBuffs.get(poisonKey)
            if (poisonLayer && poisonLayer.restoreValue > 0) {
                poisonLayer.restoreValue -= 1
                engine?.emitLog({
                    type: 'system',
                    message: `[蜂草鱼囊] ${target.name} 解毒-1层`,
                    actorId: target.id,
                })
                if (poisonLayer.restoreValue <= 0) {
                    state.pendingBuffs.delete(poisonKey)
                }
            }
            return 3
        },
    },
    {
        id: 'thunder_constitution',
        name: '雷电锻体',
        description: '雷系伤害减免80%，其他伤害减免10%。',
        tags: [],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, action }) => {
            if (action?.tags?.includes('electric')) {
                return Math.round(final * 0.2 * 10) / 10
            }
            return Math.round(final * 0.9 * 10) / 10
        },
    },
    {
        id: 'thunder_bonus',
        name: '雷法',
        description: '攻击附加3点雷击伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        onAfterDealDamage: () => 3,
    },
    {
        id: 'cinnabar_mark',
        name: '守宫砂·印',
        description: '每次攻击积攒一颗雷印，满四颗后下一击爆发。',
        tags: [],
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

    // ── 缠劲溢出奖励 ──
    {
        id: 'zhou',
        name: '周',
        description: '缠劲充盈，周身劲力流转。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        attrMods: { strength: 1, agility: 1, vitality: 1, wisdom: 1, dexterity: 1, insight: 1 },
    },
    {
        id: 'poison_resist',
        name: '蛇毒不侵',
        description: '毒抗+70%。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'tide_power',
        name: '潮汐内力',
        description: '内力如潮汐涨落，力道和身法之间每2秒挪移1点。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 5, agility: 0 },
        tickInterval: 2000,
        onTickHeal: ({ attacker: char, engine, state, layer }) => {
            const current = layer.restoreValue ?? 0
            const next = current >= 5 ? 0 : current + 1
            revertBuffMods(layer, char, state)
            const str = 5 - next
            const agi = next
            const newMods = applyAttrMods(char, state, { strength: str, agility: agi }, '潮汐内力')
            layer.mods = newMods
            layer.restoreValue = next
            engine?.emitLog({
                type: 'system',
                message: `[潮汐内力] ${char.name} 力道${str} 身法${agi}`,
                actorId: char.id,
            })
            return 0
        },
    },
    {
        id: 'heavy_training',
        name: '玄铁剑法',
        description: '以力驭剑，重型武器身法负担减半。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'dark_iron_weight',
        name: '玄铁剑意',
        description: '玄铁剑的沉重负担与无锋剑意。身法受限但力道大增，招架只能减免一半伤害。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        attrMods: { agility: -10, strength: 4 },
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const half = Math.round(blocked * 0.4 * 10) / 10
            return raw - half
        },
    },
    {
        id: 'iron_defense',
        name: '铁布衫',
        description: '所受直伤-20%。',
        tags: [],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final }) => Math.round(final * 0.8 * 10) / 10,
    },
    {
        id: 'stone_skin',
        name: '石肤',
        description: '肌肤如岩石般坚硬，所受直伤-10%。',
        tags: [],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final }) => Math.round(final * 0.9 * 10) / 10,
    },
    {
        id: 'dinghai_pressure',
        name: '定海',
        description: '锭海神铁的压制力场，距离越近伤害越高。',
        tags: ['weapon'],
        expiry: { type: 'permanent' },
        attrMods: { agility: -12 },
        onDealDamage: ({ final, attacker, target, state }) => {
            const dist = state.position.distance(attacker.id, target.id)
            const bonus = Math.round(((attacker.attrs.get('strength') * 0.66 * Math.max(0, 6 - dist)) / 5) * 10) / 10
            return bonus > 0 ? Math.round((final + bonus) * 10) / 10 : final
        },
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = Math.round(blocked * 0.4 * 10) / 10
            return raw - reduced
        },
    },
    {
        id: 'santou_liubi',
        name: '三头六臂',
        description: '后续2个回合结束时AP回满。',
        tags: [],
        expiry: { type: 'permanent' },
        onTurnEnd: ({ attacker, state, engine, layer }) => {
            if (attacker.ap < attacker.maxAp) {
                attacker.ap = attacker.maxAp
                engine?.emitLog({
                    type: 'system',
                    message: `[三头六臂] ${attacker.name} AP回满（剩${layer.restoreValue - 1}次）`,
                    actorId: attacker.id,
                })
            }
            layer.restoreValue--
            if (layer.restoreValue <= 0) {
                const key = `santou_liubi::${attacker.id}`
                state.pendingBuffs.delete(key)
                state.turn.removeEvents('buff_end_' + key)
            }
        },
    },
    {
        id: 'hua_gun_parry',
        name: '花棍',
        description: '灵巧转化为远程招架率。',
        tags: [],
        expiry: { type: 'permanent' },
        onParryChance: ({ attacker, action }) => {
            if (!action?.tags.includes('range')) return 0
            return attacker.attrs.get('dexterity') * 0.02
        },
    },
    {
        id: 'qishier_bian',
        name: '七十二变',
        description: '地煞七十二变，夺天地之造化。每6秒轮流使力道、体质、身法、灵巧增加3点。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 6000,
        onTickHeal: ({ attacker: char, state, layer }) => {
            const cycle = ['strength', 'vitality', 'agility', 'dexterity']
            const nextIdx = ((layer.restoreValue ?? 0) + 1) % 4
            revertBuffMods(layer, char, state)
            const stat = cycle[nextIdx]
            const newMods = applyAttrMods(char, state, { [stat]: 3 }, '七十二变')
            layer.mods = newMods
            layer.restoreValue = nextIdx
            return 0
        },
    },
    {
        id: 'yuanting_yuezhi',
        name: '渊渟岳峙',
        description: '免疫身法/灵巧减益、位移、缴械、打断。',
        tags: ['super_armor'],
        expiry: { type: 'permanent' },
    },
    {
        id: 'calming_fragrance',
        name: '定心清香',
        description: '清香常驻',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { insight: 2, wisdom: 1 },
    },
    {
        id: 'calming_aftertaste',
        name: '定心余香',
        description: '余香留存10秒',
        tags: [],
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'independent' },
        attrMods: { insight: 2, wisdom: 1 },
    },
    {
        id: 'stance_armor',
        name: '罡体',
        description: '刚体护身，免疫眩晕、击退、打断、缴械、击倒。',
        tags: ['super_armor'],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'none' },
    },
    {
        id: 'yuxin_sword_mastery',
        name: '真假无用',
        description: '双剑合璧，可叠层 buff 上限+2。',
        tags: [],
        expiry: { type: 'permanent' },
        onBuffApply: (raw) => raw * 2,
    },
    {
        id: 'nineteen_stops',
        name: '十九停',
        description: '每层命中+3%、暴击+2%、暴伤+1%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 19 },
        onHitChance: ({ layer }) => layer.restoreValue * 0.03,
        onCritChance: ({ layer }) => layer.restoreValue * 0.02,
        onCritDamage: ({ layer }) => layer.restoreValue * 0.01,
    },
    {
        id: 'lingxi_finger',
        name: '灵犀一指',
        description: '灵犀一指，空手亦可格挡兵刃，灵巧+4。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { dexterity: 4 },
        onCanParry: () => true,
    },
    {
        id: 'xuan_ji',
        name: '玄机',
        description: '袖里玄机。每触发一次触发器招式叠1层，15层满时下一招非辅助招式强化。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 9 },
    },
    {
        id: 'tianji_ready',
        name: '天机',
        description: '袖里玄机已满，下一招非辅助招式必中、无视招架、必定暴击。',
        tags: [],
        expiry: { type: 'permanent' },
        onHitChance: () => 1,
        onCanBeParried: () => false,
        onCritChance: () => 1,
    },
    {
        id: 'xiu_li',
        name: '袖里',
        description: '千丝万缕，只在他衣袖之间。闪避获得1层缠劲；受伤消耗1层缠劲减免3点。',
        tags: [],
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
        tags: [],
        onTakeDamage: ({ final, target, attacker, engine, state, action }) => {
            const reduced = Math.max(0, Math.round((final - 1) * 10) / 10)
            if (action?.tags?.includes('unarmed')) {
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
        id: 'golden_light',
        name: '金光',
        description: '金光咒护体，受伤时消耗1层缠劲减免3点。',
        tags: [],
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
    },
    {
        id: 'golden_bell_guard',
        name: '金玲',
        description: '金玲索护体，炁伤-2；招架时额外减免2点。',
        tags: [],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, action }) => {
            if (action?.tags?.includes('qi')) {
                return Math.max(0, Math.round((final - 2) * 10) / 10)
            }
            return final
        },
        onParryReduction: ({ final }) => Math.max(0, Math.round((final - 2) * 10) / 10),
    },
    {
        id: 'buer_sword',
        name: '不二剑灵',
        description: '起手暴击大增但身法略滞，剑意逐回合恢复。',
        tags: [],
        expiry: { type: 'permanent' },
        onCritDamage: ({ layer }) => layer.restoreValue * 0.05,
        onDodgeChance: ({ layer }) => -(layer.restoreValue * 0.02),
        onTurnEnd: ({ layer }) => {
            if (layer.restoreValue > 0) {
                layer.restoreValue = Math.max(0, layer.restoreValue - 1)
            }
        },
    },
    {
        id: 'sword_intent_tempering',
        name: '剑意淬体',
        description: '剑意淬炼肉身，slash/pierce伤害减免25%，单次受伤不超过最大生命的25%。',
        tags: [],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, target, action }) => {
            let dmg = final
            if (action?.tags?.includes('slash') || action?.tags?.includes('pierce')) {
                dmg = Math.round(dmg * 0.75 * 10) / 10
            }
            const cap = Math.round(target.maxHp * 0.25 * 10) / 10
            return Math.min(dmg, cap)
        },
    },
    {
        id: 'tongtian',
        name: '通天大物',
        description: '悟生离死别，所有伤害受推演按AP加成。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, action }) => {
            const bonus = attacker.attrs.get('wisdom') * (action?.apCost ?? 1) * 0.1
            return Math.round((final + bonus) * 10) / 10
        },
    },
    {
        id: 'yu_du_shu',
        name: '剧毒吐纳',
        description: '剧毒吐纳，每10秒释放毒素。血量充裕时仅降对手推演；受伤过重时毒雾失控。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 10000,
        onTickDamage: ({ attacker: self, engine }) => {
            if (!engine) return 0
            const target = engine.getOpponent(self.id)
            if (!target) return 0
            const tMs = engine.state.turn.currentTime
            if (self.hp / self.maxHp < 0.6) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 },
                    self,
                    target,
                    engine,
                    tMs,
                )
                processActionEffect(
                    { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 1 },
                    self,
                    target,
                    engine,
                    tMs,
                )
            } else {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'confuse', stacks: 1, chance: 1 },
                    self,
                    target,
                    engine,
                    tMs,
                )
            }
            return 0
        },
    },
    {
        id: 'gu_tong_body',
        name: '蛊童圣体',
        description: '从小被炼的毒体，拳脚互传毒。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, target, attacker, engine, action }) => {
            if (action?.tags?.includes('unarmed') && Math.random() < 0.4) {
                attacker.spendAp(1)
                if (engine) {
                    const tMs = engine.state.turn.currentTime
                    processActionEffect(
                        { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 },
                        attacker,
                        target,
                        engine,
                        tMs,
                    )
                }
            }
            return final
        },
        onTakeDamage: ({ final, attacker, target, engine, action }) => {
            if (action?.tags?.includes('unarmed') && Math.random() < 0.4) {
                target.spendAp(1)
                if (engine) {
                    const tMs = engine.state.turn.currentTime
                    processActionEffect(
                        { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 },
                        target,
                        attacker,
                        engine,
                        tMs,
                    )
                }
            }
            return final
        },
    },
    {
        id: 'venom_gland',
        name: '毒腺',
        description: '每10秒消耗4层自身毒素，获得1点洞察，持续30秒。不满4层时不触发。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 10000,
        onTickHeal: ({ attacker: self, engine, state }) => {
            const poisonKey = `poison::${self.id}`
            const poisonLayer = state.pendingBuffs.get(poisonKey)
            if (!poisonLayer || poisonLayer.restoreValue < 4) return 0
            poisonLayer.restoreValue -= 4
            if (poisonLayer.restoreValue <= 0) {
                state.pendingBuffs.delete(poisonKey)
            }
            const now = state.turn.currentTime
            const appId = `${now}_${Math.random().toString(36).slice(2, 6)}`
            const key = `venom_gland_insight::${self.id}::${appId}`
            const mods = applyAttrMods(self, state, { insight: 1 }, '毒腺')
            state.pendingBuffs.set(key, { restoreValue: 1, mods })
            state.turn.scheduleSystemEventAt(`buff_end_${key}`, now + 30000, 'buff_end')
            engine?.emitLog({
                type: 'system',
                message: `[毒腺] ${self.name} 消耗4层毒，洞察+1（30s）`,
                actorId: self.id,
            })
            return 0
        },
    },
    {
        id: 'martial_arts_dodge',
        name: '武学·避',
        description: '暴击推演出的闪避预判，每层闪避+1%、招架+1%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 4 },
        onDodgeChance: ({ layer }) => layer.restoreValue * 0.01,
        onParryChance: ({ layer }) => layer.restoreValue * 0.01,
    },
    {
        id: 'martial_arts_crit',
        name: '武学·破',
        description: '推演出的破绽洞察，每层暴击+1%、爆伤+1%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 4 },
        onCritChance: ({ layer }) => layer.restoreValue * 0.01,
        onCritDamage: ({ layer }) => layer.restoreValue * 0.01,
    },
    {
        id: 'martial_arts_archive',
        name: '武学活宝典',
        description: '通晓天下武学，以推演预判。闪避/招架→武学·破+1层；暴击→武学·避+1层。',
        tags: [],
        expiry: { type: 'permanent' },
        onDodged: ({ engine, target, attacker, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'martial_arts_crit', stacks: 1 },
                    target,
                    attacker,
                    engine,
                    state.turn.currentTime,
                )
            }
        },
        onParried: ({ engine, target, attacker, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'martial_arts_crit', stacks: 1 },
                    target,
                    attacker,
                    engine,
                    state.turn.currentTime,
                )
            }
        },
        onCritical: ({ engine, attacker, target, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'martial_arts_dodge', stacks: 1 },
                    attacker,
                    target,
                    engine,
                    state.turn.currentTime,
                )
            }
        },
    },
    // ── 风水·四娘的专属 buff ──
    {
        id: 'no_parry_buff',
        name: '流风回雪',
        description: '招架率转化为等额闪避率。',
        tags: ['buff'],
        stacking: { type: 'none' },
        onCanParry: () => false,
        onDodgeChance: ({ target }) => {
            const dex = target.attrs.get('dexterity')
            const ins = target.attrs.get('insight')
            return calcParryChance(0, dex, ins) / 2
        },
    },
    {
        id: 'quick_glance_buff',
        name: '匆匆一瞥',
        description: '暴击伤害提升。',
        tags: ['buff'],
        stacking: { type: 'none' },
        onCritDamage: () => 0.15,
    },
    {
        id: 'draw_sword_combo_buff',
        name: '抽刀断水',
        tags: ['buff', 'slash'],
        description: '交替使用斩击可叠加增伤。',
        stacking: { type: 'none' },
        // 出招即记录到队列（滚动窗口，永远保留最近3招）
        onAction: ({ action, layer }) => {
            if (!action || !action.tags.includes('slash')) return
            layer.extra = layer.extra ?? {}
            const queue = (layer.extra.slashIds as string[]) ?? []
            // push 前算 diff：已有队列里有多少不同 ID
            const diff = queue.filter((id) => id !== action.id).length
            layer.restoreValue = diff
            // 再入队
            queue.push(action.id)
            if (queue.length > 3) queue.shift()
            layer.extra.slashIds = queue
        },
        // 命中后直接用存好的 diff
        onDealDamage: ({ final, action, layer, attacker, engine }) => {
            if (!action || !action.tags.includes('slash')) return final
            const diff = layer.restoreValue
            if (diff === 0) return final
            const mult = 1.2 ** diff
            if (engine) {
                const pct = Math.round((mult - 1) * 100)
                engine.emitLog({ type: 'system', message: `[抽刀断水] ${diff}层·+${pct}%`, actorId: attacker.id })
            }
            return final * mult
        },
    },
]
