import { processActionEffect } from '../../engine/combat/effects'
import { forEachBuffOf, revertBuffMods } from '../../engine/combat/utils'
import { applyAttrMods } from '../../engine/combat/utils/buff-layer'
import { calcParryChance, calcApRegenPerSec, calcRoll } from '../../engine/calc/damage'
import { round1 } from '../../engine/util/math'
import type { BuffDef } from './types'
import { DEFENSE_BUFFS } from './defense'
import { DAMAGE_BUFFS } from './damage'
import { ActionDefinition } from '../../engine/entities/action'
import { Tag } from '../../engine/entities/tag'
import { buffEnhanceActionRange } from './util'
import { WEAPON_BUFFS } from './weapon'

/** 是否为「非辅助主招」：天机只对这类招式生效并消耗（召唤物/辅招不吃必中必暴） */
function isMainMove(source: { tags: readonly string[] } | undefined): boolean {
    return (
        !!source &&
        !source.tags.includes('pre_action') &&
        !source.tags.includes('post_action') &&
        !source.tags.includes('summon')
    )
}

/** 招式段数：取 damage/fixed_damage 效果的 independentHits（默认 1）。御剑诀/灵器共鸣按段均摊 AP——多段招每段只吃到「AP÷段数」的平加 */
function actionHits(source: ActionDefinition | undefined): number {
    let hits = 1
    for (const e of source?.effects ?? []) {
        if (e.type === 'damage' || e.type === 'fixed_damage') hits = Math.max(hits, e.independentHits ?? 1)
    }
    return hits
}

/** 增益状态 */
export const BUFF_DB: BuffDef[] = [
    ...DAMAGE_BUFFS,
    ...DEFENSE_BUFFS,
    ...WEAPON_BUFFS,
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
        id: 'jing_ji',
        name: '惊击',
        description: '闪避后蓄势，下一击暴击率+30%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_crit' },
        stacking: { type: 'none' },
        onCritChance: () => 0.3,
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
        description: '锁定目标，洞察+2，对4AP及以上招式命中+30%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { insight: 2 },
        onHitChance: ({ source }) => (((source as ActionDefinition | undefined)?.apCost ?? 0) >= 4 ? 0.3 : 0),
    },
    {
        id: 'overlord_art_buff',
        name: '金刚轮舞',
        description: '巨刃配合离心力，重器加持，命中+15%。',
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
        tags: ['qi', 'weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = round1(blocked * 0.3)
            return raw - reduced
        },
    },
    {
        id: 'stat_multiply',
        name: '超越',
        description: '属性临时倍增。',
        tags: ['buff'],
        expiry: { type: 'duration_by_attr', attr: 'wisdom', multiplier: 150 },
        stacking: { type: 'independent' },
    },
    { id: 'stat_buff', name: '内劲', description: '属性临时变化。', tags: [], stacking: { type: 'independent' } },
    {
        id: 'stat_transfer',
        name: '汲取',
        description: '吸取目标属性，最多同时 4 层。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 1500 },
        stacking: { type: 'independent' },
    },
    {
        id: 'zuoyou_hubo',
        name: '分心错手',
        description: '一心二用，交替出手，可连续施展两次攻击。主招正常消耗，连招（第二招起）消耗-1。',
        tags: [],
        onActionCost: ({ layer, source }) => {
            const act = source as ActionDefinition
            if (!act || act.tags.includes('pre_action') || act.tags.includes('post_action') || act.apCost <= 0) return 0
            // 只减第二招起：本回合首个非辅助招正常消耗，之后每招 -1（onTurnEnd 重置）
            if (layer.extra?.firstActionDone) return -1
            if (!layer.extra) layer.extra = {}
            layer.extra.firstActionDone = true
            return 0
        },
        onTurnEnd: ({ layer }) => {
            if (layer.extra) layer.extra.firstActionDone = false
        },
        getExtraAttack: () => 1,
    },
    // ── 飞花手 ──
    {
        id: 'fei_hua_shou',
        name: '飞花手',
        description: '暗器出手如飞花，可连续追加投掷攻击。暗器招式AP消耗-20%。',
        tags: [],
        expiry: { type: 'permanent' },
        getExtraAttack: ({ source }) => {
            if (!source?.tags.includes('thrown')) return 0
            return 2
        },
        onActionCost: ({ source }) => {
            const act = source as ActionDefinition
            if (!act || !act.tags.includes('thrown')) return 0
            return -act.apCost * 0.2
        },
    },
    // ── 内部追踪 ──
    { id: 'stun_track', name: '眩晕连续', description: '连续眩晕计数（5秒窗口）。', tags: [] },
    { id: 'fumble_track', name: '失心连续', description: '连续失心计数（15秒窗口）。', tags: [] },
    { id: 'steal_artifact_track', name: '盗亦有道', description: '飞龙探云手的成功率追踪。', tags: [] },
    {
        id: 'summon_haste',
        name: '御物加速',
        description: '御物加速，召唤物开火更快，每层开火间隔缩短（上限4层）。',
        tags: ['imperial', 'buff', 'summon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 4 },
        onSummonInterval: ({ layer }) => Math.max(0.6, 1 - (layer.restoreValue ?? 0) * 0.05),
    },
    {
        id: 'spear_guard_stance',
        name: '秋水·守',
        description: '秋水之势，以静制动。招架率+10%。',
        tags: ['stance'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryChance: () => 0.1,
    },
    {
        id: 'spear_break_stance',
        name: '秋水·攻',
        description: '秋水之势，以流破坚。削弱对手招架。',
        tags: ['stance'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryPenetration: ({ final, raw }) => {
            const blocked = raw - final
            const half = round1(blocked * 0.2)
            return raw - half
        },
    },

    // ── 战斗状态 ──
    {
        id: 'chan_orb_regen',
        name: '凝缠珠·流转',
        description: '凝缠珠之力流转不息，每秒恢复1点缠劲。',
        tags: [],
        expiry: { type: 'permanent' },
        chanRegenPerSec: () => 2,
    },
    // ── 聚缠法衣（缠劲→力/身/巧/推演爆发） ──
    {
        id: 'ju_chan_fa_yi',
        name: '聚缠法衣',
        description: '每5秒吸收整12的缠劲（余数保留），每12缠化为力道、身法、灵巧、推演+2，持续5秒。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        tickInterval: 6000,
        onTickHeal: ({ target, engine }) => {
            const chanPerStack = 8
            const chan = target.chan
            if (chan <= 0) return 0
            // 只吸收整 chanPerStack 缠，余数保留到下一周期（如 26.2 缠只吸 24，留 2.2）
            const absorb = Math.floor(chan / chanPerStack) * chanPerStack
            if (absorb <= 0) return 0
            target.spendChan(absorb)
            const bonus = (absorb / chanPerStack) * 2
            if (bonus > 0 && engine) {
                processActionEffect(
                    {
                        type: 'stat_buff',
                        attrs: { strength: bonus, agility: bonus, dexterity: bonus, wisdom: bonus },
                        durationMs: 6000,
                    },
                    { self: target, enemy: target, engine, tMs: engine.state.turn.currentTime },
                )
            }
            engine?.emitLog({
                type: 'system',
                message: `[聚缠法衣] ${target.name} 吸收${absorb}缠，力/身/巧/推演+${bonus}（5s）`,
                actorId: target.id,
            })
            return 0
        },
    },
    // ── 移动效率（统一 buff 实现，onMoveEfficiency 每层加算） ──
    {
        id: 'hydraulic_leg_speed',
        name: '液压腿',
        description: '液压驱动，爆发力惊人。移动效率+30%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.3,
    },
    {
        id: 'jet_drive_speed',
        name: '喷气机动',
        description: '喷气推进，移动效率+20%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.2,
    },
    {
        id: 'frost_step_speed',
        name: '踏雪',
        description: '踏雪如履平地，移动效率+30%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.3,
    },
    {
        id: 'wheelchair_speed',
        name: '轮椅轻功',
        description: '以炁驱轮，如履平地。移动效率+30%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.3,
    },
    {
        id: 'can_ying_bu_speed',
        name: '残影步',
        description: '步法如残影，移动效率+20%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.2,
    },
    // ── 干将/莫邪（千星融古剑，双剑合璧） ──
    {
        id: 'zhuixing',
        name: '追星',
        description: '千星雄剑，以炁驱动。命中叠1层，每层移动效率+5%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 0) * 0.05,
    },
    {
        id: 'huixi',
        name: '回息',
        description: '千星雌剑，以炁驱动。命中叠1层，每层AP回复+0.2/s。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        apRegenPerSec: ({ layer }) => (layer.restoreValue ?? 0) * 0.2,
    },
    {
        id: 'jiu_yin_zhen_jing_buff',
        name: '九阴',
        description: '以洞察悟缠劲，每秒按洞察回复缠劲。',
        tags: ['qi'],
        expiry: { type: 'permanent' },
        chanRegenPerSec: ({ target }) => round1(target.attrs.get('insight') * 0.1),
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
        description: '剑势刚猛，以力破巧。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { strength: 4, agility: -2 },
    },
    {
        id: 'gentle_stance',
        name: '柔劲',
        description: '剑势连绵，以柔克刚。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { agility: 4, strength: -2 },
    },
    {
        id: 'thunder_swift',
        name: '迅雷',
        description: '迅雷之势，灵巧+1，洞察+1。最多2层。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { dexterity: 1, insight: 1 },
    },
    {
        id: 'chill_blade',
        name: '寒锋',
        description: '剑意凛冽，剑气浸骨。每层伤害+8%。最多2层。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'additive', max: 2 },
        onDealDamage: ({ final, layer }) => Math.round(final * (1 + layer.restoreValue * 0.08) * 10) / 10,
    },
    {
        id: 'bamboo_regen',
        name: '回春',
        description: '剑气如春竹吐纳，生生不息。',
        tags: ['heal', 'buff'],
        expiry: { type: 'duration', ms: 30000 },
        stacking: { type: 'additive', max: 2 },
        tickInterval: 3000,
        onTickHeal: ({ layer }) => layer.restoreValue,
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '每 5 秒自动化解一层毒素，且恢复2点气血。',
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
            return 2
        },
    },
    // ── 缠劲溢出奖励 ──
    {
        id: 'zhou',
        name: '周',
        description: '缠劲充盈，周身劲力流转。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 1 },
        attrMods: { strength: 2, agility: 2, vitality: 2, wisdom: 2, dexterity: 2, insight: 2 },
    },
    // ── 铸火诀（阿九·聚炁化火） ──
    {
        id: 'zhu_huo_jue_buff',
        name: '铸火',
        description: '聚炁化火，火中淬炼不伤。自身受到的灼烧伤害减半；施加的灼烧层数提升（推演≥15 时+2，否则+1）。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 自身受灼烧 tick 减半（过热/永久灼烧走 tick_buff 另一条路径，不受影响）
        onDebuffTick: ({ buffId, damage }) => {
            if (buffId !== 'burn') return undefined
            return Math.max(0, round1(damage * 0.5))
        },
        // 施加灼烧时直接叠加层数（wis≥15 +2，否则 +1；直接改 restoreValue，无递归）
        onDebuffApplied: ({ self, enemy, engine, buffId }) => {
            if (buffId !== 'burn') return
            const extra = self.attrs.get('wisdom') >= 15 ? 2 : 1
            const key = `burn::${enemy.id}`
            const layer = engine.state.pendingBuffs.get(key)
            if (layer) layer.restoreValue += extra
        },
    },
    // ── 万象剑意（浩然·剑意拟万象） ──
    {
        id: 'wan_xiang_jian_yi_buff',
        name: '万象剑意',
        description: '以剑意模拟天地万象。自身每有1层增益buff（不含debuff与永久buff），暴击伤害+3%。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritDamage: ({ attacker, state }) => {
            let layers = 0
            forEachBuffOf(state.pendingBuffs, attacker.id, (def, layer) => {
                if (!def) return
                if (def.tags?.includes('debuff')) return
                if (def.expiry?.type === 'permanent') return
                layers += layer.restoreValue ?? 1
            })
            return round1(layers * 0.03)
        },
    },
    {
        id: 'tide_power',
        name: '潮汐内力',
        description: '内力如潮汐涨落，力道和身法之间每2秒挪移1点（最多4点）。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 4, agility: 0 },
        tickInterval: 2000,
        onTickHeal: ({ attacker: char, engine, state, layer }) => {
            const current = layer.restoreValue ?? 0
            const next = current >= 4 ? 0 : current + 1
            revertBuffMods(layer, char, state)
            const str = 4 - next
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
        name: '玄剑',
        description: '以力驭剑，化繁为简。重型武器身法负担减半，招式AP消耗-0.2（最低1）。',
        tags: [],
        expiry: { type: 'permanent' },
        onActionCost: () => -0.2,
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
        description: '地煞七十二变，夺天地之造化。每6秒轮流使力道、体质、身法、灵巧增加6点。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        tickInterval: 6000,
        onTickHeal: ({ attacker: char, state, layer }) => {
            const cycle = ['strength', 'vitality', 'agility', 'dexterity']
            const nextIdx = ((layer.restoreValue ?? 0) + 1) % 4
            revertBuffMods(layer, char, state)
            const stat = cycle[nextIdx]
            const newMods = applyAttrMods(char, state, { [stat]: 6 }, '七十二变')
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
        onReceiveDebuff: (ctx) => {
            if (['stun', 'knockdown', 'disarmed'].includes(ctx.buffId)) return 0
            return undefined
        },
    },
    {
        id: 'calming_fragrance',
        name: '定心清香',
        description: '清香常驻',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { insight: 2, wisdom: 2 },
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
        id: 'yuxin_sword_mastery',
        name: '真假无用',
        description: '所有可叠层 buff 上限翻倍，但每次叠层消耗2缠。',
        tags: [],
        expiry: { type: 'permanent' },
        onBuffApply: (raw) => raw * 2,
        onStackGain: ({ char, delta, engine }) => {
            const cost = delta * 2
            if (char.chan < cost) return 0
            char.spendChan(cost)
            engine?.emitLog({
                type: 'system',
                message: `[真假无用] ${char.name} 叠层消耗${cost}缠`,
                actorId: char.id,
            })
            return delta
        },
    },
    {
        id: 'xuan_ji',
        name: '玄机',
        description: '袖里玄机。每触发一次触发器招式叠1层，9层满时下一招非辅助招式强化。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 9 },
    },
    {
        id: 'tianji_ready',
        name: '天机',
        description: '袖里玄机已满，下一招非辅助招式必中、无视招架、必定暴击。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        // 仅对「下一招非辅助主招」生效：召唤物/辅招不吃必中必暴（消耗前不泄漏）
        onHitChance: ({ source }) => (isMainMove(source) ? 1 : 0),
        onCanBeParried: ({ source }) => (isMainMove(source) ? false : true),
        onCritChance: ({ source }) => (isMainMove(source) ? 1 : 0),
        // 自包含消耗：主招必中必暴 → 必然暴击，暴击结算后删除自身并重置玄机（不再由引擎硬编码）
        onCritical: ({ attacker, engine, state, source }) => {
            if (!isMainMove(source)) return
            state.pendingBuffs.delete(`tianji_ready::${attacker.id}`)
            state.pendingBuffs.delete(`xuan_ji::${attacker.id}`)
            engine?.emitLog({
                type: 'system',
                message: `[天机] 「${attacker.name}」 天机已用（${(source as ActionDefinition).name}），玄机重置`,
                actorId: attacker.id,
            })
        },
    },
    {
        id: 'spirit_resonance_buff',
        name: '灵器共鸣',
        description: '将自身三分之一力道（向下取整）转化给召唤物，按召唤物数量平分；召唤物技能招按命中段数平分。',
        tags: ['summon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, attacker, source, layer }) => {
            if (!source?.tags?.includes('summon')) return final
            // 三分之一力道（向下取整）为固定池：召唤武器招按召唤物数量平分，召唤物技能招（如一夜鱼龙舞）按段数平分
            const poolStr = Math.floor(attacker.attrs.get('strength') / 3)
            if (poolStr <= 0) return final
            const summon = attacker.weaponDef?.summon
            const divisor =
                summon && summon.actionId === source.id
                    ? summon.maxCount(attacker)
                    : actionHits(source as ActionDefinition)
            const perHit = round1(poolStr / divisor)
            const bonus = perHit * layer.restoreValue
            return Math.round((final + bonus) * 10) / 10
        },
    },
    {
        id: 'yu_du_shu',
        name: '剧毒吐纳',
        description: '剧毒吐纳，每5秒释放毒素。血量越少，毒雾越烈。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 5000,
        onTickDamage: ({ attacker: self, engine }) => {
            if (!engine) return 0
            const target = engine.getOpponent(self.id)
            if (!target) return 0
            const tMs = engine.state.turn.currentTime
            const hpRatio = self.hp / self.maxHp
            const debuffChance = Math.min(1, Math.max(0, (0.8 - hpRatio) * 0.3))

            processActionEffect(
                { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: debuffChance * 0.5 },
                { self, enemy: target, engine, tMs },
            )
            processActionEffect(
                { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: debuffChance },
                { self, enemy: target, engine, tMs },
            )
            processActionEffect(
                { type: 'add_debuff', buffId: 'confuse', stacks: 1, chance: 1 },
                { self, enemy: target, engine, tMs },
            )

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
                        { self: attacker, enemy: target, engine, tMs },
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
        id: 'martial_arts_archive',
        name: '武学活宝典',
        description: '通晓天下武学，以推演预判。闪避/招架→武学·破+1层；暴击→武学·避+1层。',
        tags: [],
        expiry: { type: 'permanent' },
        onDodged: ({ engine, target, attacker, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'martial_arts_crit', stacks: 1 },
                    { self: target, enemy: attacker, engine, tMs: state.turn.currentTime },
                )
            }
        },
        onParried: ({ engine, target, attacker, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'martial_arts_crit', stacks: 1 },
                    { self: target, enemy: attacker, engine, tMs: state.turn.currentTime },
                )
            }
        },
        onCritical: ({ engine, attacker, target, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'martial_arts_dodge', stacks: 1 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
        },
    },
    {
        id: 'no_parry_buff',
        name: '流风回雪',
        description: '招架率转化为闪避率。',
        tags: [],
        stacking: { type: 'none' },
        onCanParry: () => false,
        onDodgeChance: ({ target }) => {
            const dex = target.attrs.get('dexterity')
            const ins = target.attrs.get('insight')
            return calcParryChance(dex, ins) / 3
        },
    },
    {
        id: 'draw_sword_combo_buff',
        name: '抽刀断水',
        tags: ['slash'],
        description: '交替使用斩击可叠加增伤；紧接重复上一招不归零、只是不再叠加，连打同一招会逐渐回落。',
        stacking: { type: 'none' },
        // 层数 = 最近 3 招窗口里与当前不同的招式数（上限3，×1.1^层）；紧接重复（diff=0）保持层数不归零
        // 窗口模型让 AI 有动机保持窗口多样（连打会掉层），比 streak 模型更不会只主用单招
        onAction: ({ source, layer }) => {
            if (!source || !source.tags.includes('slash')) return
            layer.extra = layer.extra ?? {}
            const queue = (layer.extra.slashIds as string[]) ?? []
            const diff = queue.filter((id) => id !== source.id).length
            if (diff > 0) layer.restoreValue = diff
            // diff === 0（紧接重复）→ 保持 restoreValue，不归零
            queue.push(source.id)
            if (queue.length > 3) queue.shift()
            layer.extra.slashIds = queue
        },
        // 命中后按当前层数加成
        onDealDamage: ({ final, source, layer, attacker, engine }) => {
            if (!source || !source.tags.includes('slash')) return final
            const diff = layer.restoreValue ?? 0
            if (diff === 0) return final
            const mult = 1.1 ** diff
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
        description: '游身步法。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 3000 },
        stacking: { type: 'independent' },
        attrMods: { agility: 1 },
    },
    {
        id: 'sword_focus',
        name: '怒炁充盈',
        description: '每被闪避一次积攒怒气，下次命中附加 层数×3 点伤害，击中后重置。',
        tags: [],
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
        description: '4秒内伤害+10%，命中+10%。',
        tags: ['imperial', 'buff'],
        expiry: { type: 'duration', ms: 4000 },
        stacking: { type: 'none' },
        onDealDamage: ({ final }) => round1(final * 1.1),
        onHitChance: () => 0.1,
    },
    // ── 战术腰包 ──
    {
        id: 'adrenaline_rush',
        name: '肾上腺素',
        description: 'AP恢复速度翻倍，持续20秒。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 20000 },
        apRegenPerSec: ({ target }) => Math.max(1, Math.round(Math.max(2, target.attrs.get('wisdom') * 0.1))),
    },
    // ── 弗思剑 ──
    {
        id: 'fusi_crit_stack',
        name: '弗思·蓄势',
        description: '闪避后本能蓄势，每层暴击率+3%。',
        tags: ['buff'],
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
    // ── 血战到底 ──
    {
        id: 'blood_rage',
        name: '血战到底',
        description: '气血越低属性加成越高。力道、身法、灵巧随血量减少而提升。',
        tags: [],
        expiry: { type: 'permanent' },
        onHpChange: ({ target: char, state, layer }) => {
            const hpPct = char.hp / char.maxHp
            let str = 0,
                agi = 0,
                dex = 0
            if (hpPct < 0.9) {
                if (hpPct > 0.7) {
                    str = 2
                    agi = 2
                    dex = 2
                } else if (hpPct > 0.3) {
                    str = 4
                    agi = 4
                    dex = 4
                } else {
                    str = 8
                    agi = 8
                    dex = 8
                }
            }
            const prev = layer.extra as Record<string, number> | undefined
            if (prev?.str === str && prev?.agi === agi && prev?.dex === dex) return
            revertBuffMods(layer, char, state)
            const newMods = applyAttrMods(char, state, { strength: str, agility: agi, dexterity: dex }, '血战到底')
            layer.mods = newMods
            layer.extra = { str, agi, dex }
        },
    },
    // ── 观自在眼（姬然） ──
    {
        id: 'guan_zi_zai_yan',
        name: '观自在眼',
        description: '气血越低，洞察、推演越高。',
        tags: [],
        expiry: { type: 'permanent' },
        onHpChange: ({ target: char, state, layer }) => {
            const hpPct = char.hp / char.maxHp
            let ins = 0,
                wis = 0
            if (hpPct < 0.7) {
                if (hpPct > 0.3) {
                    ins = 4
                    wis = 4
                } else {
                    ins = 8
                    wis = 8
                }
            }
            const prev = layer.extra as Record<string, number> | undefined
            if (prev?.ins === ins && prev?.wis === wis) return
            revertBuffMods(layer, char, state)
            const newMods = applyAttrMods(char, state, { insight: ins, wisdom: wis }, '观自在眼')
            layer.mods = newMods
            layer.extra = { ins, wis }
        },
    },
    // ── 气血回溯 ──
    {
        id: 'blood_recovery',
        name: '气血回溯',
        description: '正在回复消耗的气血。',
        tags: ['heal'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'independent' },
        tickInterval: 1000,
        onTickHeal: ({ layer }) => Math.max(0.1, round1(layer.restoreValue / 5)),
    },
    // ── 经络初鉴 ──
    {
        id: 'jing_luo_chu_jian',
        name: '经络初鉴',
        description: '每点洞察增加1%暴击率。',
        tags: [],
        expiry: { type: 'permanent' },
        onCritChance: ({ attacker }) => Math.max(0, attacker.attrs.get('insight') * 0.01),
    },
    // ── 青囊三卷 ──
    {
        id: 'qing_nang_san_juan',
        name: '青囊三宝',
        description: '每7秒检查：有毒解毒，没毒止血。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 7000,
        onTickHeal: ({ target, engine, state }) => {
            if (!engine) return 0
            const poisonKey = `poison::${target.id}`
            const bleedKey = `bleed::${target.id}`
            const poisonLayer = state.pendingBuffs.get(poisonKey)
            if (poisonLayer && poisonLayer.restoreValue > 0) {
                poisonLayer.restoreValue -= 1
                if (poisonLayer.restoreValue <= 0) {
                    state.pendingBuffs.delete(poisonKey)
                }
                return 0
            }
            const bleedLayer = state.pendingBuffs.get(bleedKey)
            if (bleedLayer && bleedLayer.restoreValue > 0) {
                bleedLayer.restoreValue -= 1
                if (bleedLayer.restoreValue <= 0) {
                    state.pendingBuffs.delete(bleedKey)
                }
                return 0
            }
            return 7
        },
    },
    {
        id: 'ling_xu_zhen_jie',
        name: '灵枢真解',
        description: '拳脚及钝击招式50%概率造成4层麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, source, attacker, engine, state }) => {
            if (!source?.tags?.includes('unarmed') && !source?.tags?.includes('blunt')) return final
            if (engine && Math.random() < 0.5) {
                const enemy = engine.getOpponent(attacker.id)
                if (enemy) {
                    processActionEffect(
                        { type: 'add_debuff', buffId: 'paralyze', stacks: 4, chance: 1 },
                        { self: attacker, enemy, engine, tMs: state.turn.currentTime },
                    )
                }
            }
            return final
        },
    },
    // ── 七心海棠 ──
    {
        id: 'qi_xin_hai_tang',
        name: '七心海棠',
        description: '所有施加的中毒伤害翻倍。',
        tags: [],
        expiry: { type: 'permanent' },
        onDebuffApplied: ({ layer, buffId }) => {
            if (!layer || buffId !== 'poison') return
            if (layer.extra) layer.extra.poisonMult = 2
        },
    },
    // ── 内息澎湃（AP回复倍率） ──
    {
        id: 'nei_xi_peng_pai',
        name: '内息澎湃',
        description: '内息奔涌，每层AP恢复速度+10%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        apRegenPerSec: ({ target, layer }) =>
            Math.round(calcApRegenPerSec(target.attrs.get('wisdom')) * ((layer.restoreValue ?? 0) * 0.1) * 10) / 10,
    },
    // ── 挂挡（固定内息回复） ──
    {
        id: 'gear_shift_buff',
        name: '挡',
        description: '挂挡蓄劲，内息流转。每层内息回复+0.3/s。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        apRegenPerSec: ({ layer }) => round1((layer.restoreValue ?? 0) * 0.3),
    },
    // ── 淬毒工具 ──
    {
        id: 'poison_coating',
        name: '淬毒工具',
        description: '刃上淬毒，割裂或刺击时概率令其中毒。',
        tags: [],
        expiry: { type: 'permanent' },
        onAction: ({ source, attacker, target, engine, state }) => {
            if (!source) return
            if (!source.tags.includes('pierce') && !source.tags.includes('slash')) return
            if (engine && Math.random() < 0.3) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
        },
    },
    // ── 十香软筋散（毒→虚弱） ──
    {
        id: 'shixiang_ruanjin_san',
        name: '十香软筋散',
        description: '中者筋骨酥软，每次中毒时叠加一层虚弱。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDebuffApplied: ({ buffId, self, enemy, engine }) => {
            if (buffId !== 'poison' || !engine) return
            processActionEffect(
                { type: 'add_debuff', buffId: 'weakness', stacks: 1, chance: 1 },
                { self, enemy, engine, tMs: engine.state.turn.currentTime },
            )
        },
    },
    // ── 扫描分析 ──
    {
        id: 'scan_analysis',
        name: '扫描分析',
        description: '战斗数据分析，每层命中+5%、暴击+5%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 5 },
        onHitChance: ({ layer }) => layer.restoreValue * 0.05,
        onCritChance: ({ layer }) => layer.restoreValue * 0.05,
    },
    // ── 战斗芯片 ──
    {
        id: 'combat_chip',
        name: '战斗芯片',
        description: '战斗数据分析，回合开始概率叠加层数。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        onTurnEnd: ({ layer }) => {
            if (Math.random() < 0.4) layer.restoreValue = Math.min(3, (layer.restoreValue ?? 0) + 1)
        },
        onHitChance: ({ layer }) => layer.restoreValue * 0.03,
        onCritChance: ({ layer }) => layer.restoreValue * 0.03,
    },
    {
        id: 'qi_electric_buff',
        name: '炁电转换',
        description: '以炁驱动装备，身上的天工造物与义体越多、推演越高，力道、身法、灵巧提升越多。',
        tags: ['craft', 'electric'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        tickInterval: 1,
        onTickHeal: ({ attacker: char, engine, state, layer }) => {
            if (layer.extra?.applied) return 0
            const count = char.artifactDefs.filter((a) => a.tags.some((t) => t === 'craft' || t === 'implant')).length
            const wis = char.attrs.get('wisdom')
            const bonus = Math.floor((count * (wis + 18)) / 56)
            const mods = applyAttrMods(char, state, { strength: bonus, agility: bonus, dexterity: bonus }, '炁电转换')
            layer.mods = { ...mods }
            layer.extra = { applied: true, count, wis, bonus }
            if (bonus > 0) {
                engine?.emitLog({
                    type: 'system',
                    message: `[炁电转换] ${char.name} ${count}件装备·推演${wis}，力道/身法/灵巧+${bonus}`,
                    actorId: char.id,
                })
            }
            state.turn.removeEvents(`tick_buff_qi_electric_buff::${char.id}`)
            return 0
        },
    },
    // ── 无明之明 ──
    {
        id: 'no_light_buff',
        name: '无明之明',
        description: '以推演替代洞察，感知万物。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onHitChance: ({ attacker }) => attacker.attrs.get('wisdom') * 0.003,
        onDodgeChance: ({ target }) => target.attrs.get('wisdom') * 0.003,
        onParryChance: ({ target }) => target.attrs.get('wisdom') * 0.003,
        onCritChance: ({ attacker }) => attacker.attrs.get('wisdom') * 0.0005,
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'sand_blind') return 0
            return undefined
        },
    },
    // ── 西域奇毒 ──
    {
        id: 'western_poison_buff',
        name: '西域奇毒',
        description: '剧毒入体，麻痹神经。每次中毒时叠加一层麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDebuffApplied: ({ buffId, self, enemy, engine }) => {
            if (buffId !== 'poison' || !engine) return
            processActionEffect(
                { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 1 },
                { self, enemy, engine, tMs: engine.state.turn.currentTime },
            )
        },
    },
    {
        id: 'hearing_insight',
        name: '听劲',
        description: '感知流转，洞察提升。',
        tags: [],
        expiry: { type: 'duration', ms: 1500 },
        stacking: { type: 'additive' },
        attrMods: { insight: 2 },
    },
    // ── 独臂 ──
    {
        id: 'one_arm_buff',
        name: '独臂',
        description: '运劲更凝练，招式消耗降低但身法受限。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { agility: -4 },
        onActionCost: () => -0.5,
    },
    // ── 明镜止水 ──
    {
        id: 'mingjing_zhishui_buff',
        name: '明镜止水',
        description: '心如明镜，神清目明。招式AP消耗-15%，但推演降低。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { wisdom: -2 },
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'confuse') return 0
            if (ctx.buffId === 'fumble_chance_temp') {
                const { success } = calcRoll(0.6)
                if (success) return 0
            }
            return undefined
        },
        onActionCost: ({ source }) => {
            const act = source as ActionDefinition
            if (!act) return 0
            return -act.apCost * 0.15
        },
    },
    // ── 残影步·虚影 ──
    {
        id: 'xu_ying',
        name: '虚影',
        description: '残影步带出的虚影，身法飘忽。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'additive' },
        onDodgeChance: ({ layer }) => layer.restoreValue * 0.05,
    },
    {
        id: 'yun_bu_foresight',
        name: '云步·先机',
        description: '云步后身形缥缈，下次攻击命中+15%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_hit' },
        stacking: { type: 'none' },
        onHitChance: () => 0.15,
    },
    {
        id: 'dao_ma_dan',
        name: '刀马旦',
        description: '入戏状态，力道身法灵巧各+1，招式带炁，AP恢复+10%，并持续回复气血。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'none' },
        attrMods: { strength: 1, agility: 1, dexterity: 1 },
        apRegenPerSec: ({ target }) => Math.round(calcApRegenPerSec(target.attrs.get('wisdom')) * 0.1 * 10) / 10,
        tickInterval: 2000,
        onTickHeal: () => 2,
        onRuntimeAction: (_ctx, action) => {
            const tags: Tag[] = action.tags.includes('qi') ? action.tags : [...action.tags, 'qi']
            return { ...action, tags }
        },
    },
    {
        id: 'sword_dominion',
        name: '御剑诀',
        description: '以炁御剑，剑随意动。延长攻击距离，招式附加内息伤害。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onRuntimeAction: (_ctx, action) => buffEnhanceActionRange(action, 2),
        onDealDamage: ({ final, source }) => {
            // 固定附加：招式 AP 均摊到每段（5段AP5 → 每段+1），整招合计恰好 +AP；0AP 召唤物招按 1AP 计
            const ap = Math.max(1, (source as ActionDefinition | undefined)?.apCost ?? 0)
            return final + ap / actionHits(source as ActionDefinition)
        },
    },
    // ── 刃炁大师（攻击侧：持刃攻击令对手叠刃炁） ──
    {
        id: 'momentum_mastery_buff',
        name: '刃炁大师',
        description: '斩刺伤害令对手叠刃炁。',
        tags: ['slash'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, source, attacker, target, engine, state }) => {
            if (!engine || !source) return final
            // 炁招（炁弹/炁刃）：按招式自身 tag 判断是否带刃——炁刃带 slash 可叠，炁弹不带不叠
            const qiMove = source.tags.includes('qi_action')
            const ok = qiMove
                ? source.tags.includes('slash') || source.tags.includes('pierce')
                : (attacker.weaponDef?.tags.includes('slash') ?? false)
            if (ok) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'blade_qi', stacks: 1, chance: 1 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
            return final
        },
    },
    // ── 炁体源流·觉醒（六维激涌，但不再触发招式） ──
    {
        id: 'qiti_awaken_buff',
        name: '炁体源流·觉醒',
        description: '六维激涌，觉醒后不再触发招式。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        canTriggerAction: () => false,
    },
    {
        id: 'cang_niao_buff',
        name: '苍鸟',
        description: '苍鸟掠空，内息流转。AP回复+0.5/s。',
        tags: ['buff', 'qi'],
        expiry: { type: 'duration', ms: 9000 },
        stacking: { type: 'none' },
        apRegenPerSec: () => 0.5,
    },
    {
        id: 'chanzi_chan_regen',
        name: '玄武定',
        description: '玄武定息，缠劲生生不息，每秒恢复1点缠劲。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        chanRegenPerSec: () => 2,
    },
]
