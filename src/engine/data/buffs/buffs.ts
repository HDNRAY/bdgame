import { processActionEffect } from '../../combat/effects'
import { revertBuffMods } from '../../combat/utils'
import { applyAttrMods } from '../../combat/utils/buff-layer'
import { calcParryChance } from '../../calc/damage'
import type { BuffDef } from './types'
import { DEFENSE_BUFFS } from './defense'
import { DAMAGE_BUFFS } from './damage'
import { ActionDefinition } from '../../entities/action'

/** 增益状态 */
export const BUFF_DB: BuffDef[] = [
    ...DAMAGE_BUFFS,
    ...DEFENSE_BUFFS,
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
        name: '刃炁',
        description: '每层增伤3%。累计10点治疗消一层。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 81 },
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
                message: `[治疗] ${target?.name ?? ''} 刃炁 -${reduce}层，剩${layer.restoreValue}层`,
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
        onParryChance: ({ source }) => (source?.tags.includes('range') ? 0.4 : 0.2),
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
        id: 'li_wu_xu_fa',
        name: '例无虚发',
        description: '暗器命中率+50%。',
        tags: [],
        expiry: { type: 'permanent' },
        onHitChance: ({ source }) => (source?.tags?.includes('thrown') ? 0.5 : 0),
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '凝炁为刃，削弱招架减伤效果。',
        tags: ['qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = Math.round(blocked * 0.3 * 10) / 10
            return raw - reduced
        },
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
        expiry: { type: 'duration', ms: 1500 },
        stacking: { type: 'independent' },
    },

    {
        id: 'zuoyou_hubo',
        name: '左右互搏',
        description: '一次行动可使用两次主招式，非辅助招式AP-1。',
        tags: [],
        onActionCost: ({ source }) => {
            const act = source as ActionDefinition
            return act && !act.tags.includes('pre_action') && !act.tags.includes('post_action') && act.apCost > 0
                ? -1
                : 0
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
        tags: ['buff'],
        expiry: { type: 'permanent' },
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '持续恢复生命，血越少恢复越多。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 2000,
        onTickHeal: ({ target }) => Math.round(10 + (target.maxHp - target.hp) * 0.1) / 10,
    },
    {
        id: 'vigor_stance',
        name: '刚劲',
        description: '剑势·刚，力道+4/层，身法-2/层。最多2层。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { strength: 4, agility: -2 },
    },
    {
        id: 'gentle_stance',
        name: '柔劲',
        description: '剑势·柔，身法+4/层，力道-2/层。最多2层。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { agility: 4, strength: -2 },
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '每 5 秒自动化解一层毒素，且恢复3点气血。',
        tags: ['heal'],
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
    // ── 缠劲溢出奖励 ──
    {
        id: 'zhou',
        name: '周',
        description: '缠劲充盈，周身劲力流转。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        attrMods: { strength: 1, agility: 1, vitality: 1, wisdom: 1, dexterity: 1, insight: 1 },
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
        id: 'dinghai_pressure',
        name: '定海',
        description: '锭海神铁的压制力场，距离越近伤害越高。',
        tags: ['weapon', 'heavy'],
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
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { insight: 2, wisdom: 2 },
    },
    {
        id: 'calming_aftertaste',
        name: '定心余香',
        description: '余香留存10秒',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'independent' },
        attrMods: { insight: 2, wisdom: 1 },
    },
    {
        id: 'yuxin_sword_mastery',
        name: '真假无用',
        description: '双剑合璧，可叠层 buff 上限+2。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        onBuffApply: (raw) => raw * 2,
    },
    {
        id: 'xuan_ji',
        name: '玄机',
        description: '袖里玄机。每触发一次触发器招式叠1层，9层满时下一招非辅助招式强化。',
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
        id: 'spirit_resonance_buff',
        name: '灵器共鸣',
        description: '将自身力道转化为召唤物的攻击力。',
        tags: ['summon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, source, layer }) => {
            if (!source?.tags?.includes('summon')) return final
            const bonus = ((source as ActionDefinition).apCost ?? 0) * layer.restoreValue
            return Math.round((final + bonus) * 10) / 10
        },
    },
    {
        id: 'buer_sword',
        name: '不二剑灵',
        description: '起手暴击大增但身法略滞，逐回合恢复。',
        tags: [],
        expiry: { type: 'permanent' },
        onCritDamage: ({ layer }) => layer.restoreValue * 0.04,
        onDodgeChance: ({ layer }) => -(layer.restoreValue * 0.01),
        onTurnEnd: ({ layer }) => {
            if (layer.restoreValue > 0) {
                layer.restoreValue = Math.max(0, layer.restoreValue - 1)
            }
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
            if (self.hp / self.maxHp < 0.7) {
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
        onDealDamage: ({ final, target, attacker, engine, source }) => {
            if (source?.tags?.includes('unarmed') && Math.random() < 0.4) {
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
        onTakeDamage: ({ final, attacker, target, engine, source }) => {
            if (source?.tags?.includes('unarmed') && Math.random() < 0.4) {
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
        onCritDamage: () => 0.25,
    },
    {
        id: 'draw_sword_combo_buff',
        name: '抽刀断水',
        tags: ['buff', 'slash'],
        description: '交替使用斩击可叠加增伤。',
        stacking: { type: 'none' },
        // 出招即记录到队列（滚动窗口，永远保留最近3招）
        onAction: ({ source, layer }) => {
            if (!source || !source.tags.includes('slash')) return
            layer.extra = layer.extra ?? {}
            const queue = (layer.extra.slashIds as string[]) ?? []
            // push 前算 diff：已有队列里有多少不同 ID
            const diff = queue.filter((id) => id !== source.id).length
            layer.restoreValue = diff
            // 再入队
            queue.push(source.id)
            if (queue.length > 3) queue.shift()
            layer.extra.slashIds = queue
        },
        // 命中后直接用存好的 diff
        onDealDamage: ({ final, source, layer, attacker, engine }) => {
            if (!source || !source.tags.includes('slash')) return final
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
    {
        id: 'bean_buff',
        name: '茴香气',
        description: '茴香豆的余香，全属性+1（除推演）。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 10000 },
        attrMods: { strength: 1, vitality: 1, agility: 1, dexterity: 1, wisdom: 1 },
    },
    // ── 酒鬼·无志 ──
    {
        id: 'you_shen',
        name: '游身',
        description: '游身步法，敏捷+1、灵巧+1。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        attrMods: { agility: 1, dexterity: 1 },
    },
    {
        id: 'jiu_yang_regen',
        name: '九阳真气',
        description: '九阳真气护体，每5秒回复1%生命。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 5000,
        onTickHeal: ({ target }) => Math.max(1, Math.round(target.maxHp * 0.01)),
    },
    // ── 灵剑·桑原 ──
    {
        id: 'sword_intent_burst',
        name: '灵炁爆发',
        description: '力道、身法、灵巧各+6持续15秒，之后各-8持续3秒。',
        tags: ['qi', 'buff'],
        expiry: { type: 'duration', ms: 18000 },
        attrMods: { strength: 6, agility: 6, dexterity: 6 },
        tickInterval: 15000,
        onTickHeal: ({ layer, engine, target, state }) => {
            revertBuffMods(layer, target, state)
            const newMods = applyAttrMods(target, state, { strength: -8, agility: -8, dexterity: -8 }, '灵炁爆发')
            layer.mods = newMods
            engine?.emitLog({
                type: 'system',
                message: `[灵炁爆发] ${target.name} 力竭，各属性-8（3秒）`,
                actorId: target.id,
            })
            return 0
        },
    },
    {
        id: 'sword_focus',
        name: '怒炁充盈',
        description: '每被闪避一次积攒怒气，下次命中附加 层数×3 点伤害，击中后重置。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        onDodged: ({ layer }) => {
            layer.restoreValue = (layer.restoreValue ?? 0) + 1
        },
        onDealDamage: ({ final, layer }) => {
            const stacks = layer.restoreValue ?? 0
            if (stacks > 0) {
                layer.restoreValue = 0
                return Math.round((final + stacks * 3) * 10) / 10
            }
            return final
        },
    },
    // ── 黑云·小树 ──
    {
        id: 'sword_enhance_buff',
        name: '灵炁灌注',
        description: '下次御物伤害+30%。',
        tags: ['imperial'],
        expiry: { type: 'consumed', trigger: 'on_hit' },
        stacking: { type: 'none' },
        onDealDamage: (ctx) => {
            if (!ctx.attacker.weaponDef?.tags.includes('imperial')) return ctx.final
            return Math.round(ctx.final * 1.3)
        },
    },
    // ── 战术腰包 ──
    {
        id: 'adrenaline_rush',
        name: '肾上腺素',
        description: 'AP恢复速度翻倍，持续15秒。',
        tags: [],
        expiry: { type: 'duration', ms: 15000 },
        tickInterval: 1000,
        onTickHeal: ({ target: char, engine }) => {
            const regenPerSec = Math.max(2, char.attrs.get('wisdom') * 0.2)
            const apGain = Math.max(1, Math.round(regenPerSec))
            char.ap = Math.min(char.maxAp, char.ap + apGain)
            engine?.emitLog({
                type: 'system',
                message: `[肾上腺素] ${char.name} AP +${apGain}`,
                actorId: char.id,
            })
            return 0
        },
    },
    // ── 弗思剑 ──
    {
        id: 'fusi_crit_stack',
        name: '弗思·蓄势',
        description: '闪避后本能蓄势，每层暴击率+3%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        onCritChance: ({ layer }) => layer.restoreValue * 0.03,
    },
    // ── 浮游眼 ──
    {
        id: 'floating_eye_buff',
        name: '浮游眼',
        description: '洞察流转，预判对手。洞察+4，暴击率+5%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { insight: 4 },
        onCritChance: () => 0.05,
    },
]
