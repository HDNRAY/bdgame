import { processActionEffect } from '../../engine/combat/effects'
import { forEachBuffOf, dropBuffLayer } from '../../engine/combat/utils'
import { setLayerMods, addLayerMods } from '../../engine/combat/utils/buff-layer'
import { rng } from '../../engine/util/rng'
import { convertAttrAmount } from '../../engine/util/math'
import { genAppId } from '../../engine/util/buff-utils'
import {
    calcParryChance,
    calcApRegenPerSec,
    calcRoll,
    calcCritChance,
    calcPoisonTicksPerStack,
} from '../../engine/calc/damage'
import { round1 } from '../../engine/util/math'
import type { BuffDef } from './types'
import { DEFENSE_BUFFS } from './defense'
import { DAMAGE_BUFFS } from './damage'
import { ActionDefinition } from '../../engine/entities/action'
import { Tag } from '../../engine/entities/tag'
import { buffEnhanceActionRange } from './util'
import { WEAPON_BUFFS } from './weapon'
import { ATTACHED_BUFFS } from './attached'
import type { Character } from '../../engine/entities/character'
import { getPassive } from '../passives'
import { getArtifact } from '../artifacts'
import { getAction as getActionDef } from '../actions'
import { getWeapon } from '../weapons/weapons'
import type { BuffLayer } from '../../engine/combat/types'

/** 统计角色所有奖励（功法/奇物/招式/武器）的标签总数（去重；只算 build.rewards，克隆安全） */
function countRewardTags(char: Character): number {
    const set = new Set<string>()
    for (const r of char.build.rewards ?? []) {
        if (r.type === 'passive') {
            const p = getPassive(r.id)
            for (const t of p?.tags ?? []) set.add(t)
        } else if (r.type === 'artifact') {
            const a = getArtifact(r.id)
            for (const t of a?.tags ?? []) set.add(t)
        } else if (r.type === 'action') {
            const act = getActionDef(r.id)
            for (const t of act?.tags ?? []) set.add(t)
        } else if (r.type === 'weapon') {
            const w = getWeapon(r.id)
            for (const t of w?.tags ?? []) set.add(t)
        }
    }
    // 初始武器也算（build.weapon）
    for (const t of getWeapon(char.build.weapon)?.tags ?? []) set.add(t)
    return set.size
}

/** 洞幽烛微看破率：min(7%, 2% × log2(1 + 该招式各 tag 看破次数之和))。多 tag 招式取各 tag 次数之和，各自封顶 7%。 */
function kanpoRate(source: { tags?: readonly string[] } | undefined, layer: BuffLayer): number {
    if (!source?.tags?.length) return 0
    let total = 0
    for (const t of source.tags) {
        total += (layer.extra?.[`kanpo_${t}`] as number | undefined) ?? 0
    }
    if (total <= 0) return 0
    return Math.min(0.07, 0.02 * Math.log2(1 + total))
}

/** 是否为「非辅助主招」：天机只对这类招式生效并消耗（召唤物/辅招不吃必中必暴） */
/**
 * 是否「玩家主动出手的主招」：**触发招不算**（`triggered`），辅助招 / 召唤物也不算。
 *
 * 触发招为什么必须排除：像天机这类「攒满给下一招」的一次性增益，是靠**触发**攒起来的
 * （袖里玄机每触发一次 +1 层），若触发招也吃，就会「攒满 → 下一发自动反击吃掉」，
 * 玩家自己选的那一招永远吃不到。传 `triggered` 才会把它算进去（不传 = 旧行为）。
 */
function isMainMove(source: { tags: readonly string[] } | undefined, triggered?: boolean): boolean {
    return (
        !!source &&
        !triggered &&
        !source.tags.includes('pre_action') &&
        !source.tags.includes('post_action') &&
        !source.tags.includes('summon')
    )
}

/** 招式段数：取 damage 效果的 independentHits（默认 1）。御剑诀/灵器共鸣按段均摊 AP——多段招每段只吃到「AP÷段数」的平加 */
function actionHits(source: ActionDefinition | undefined): number {
    let hits = 1
    for (const e of source?.effects ?? []) {
        if (e.type === 'damage') hits = Math.max(hits, e.independentHits ?? 1)
    }
    return hits
}

/** 增益状态 */
export const BUFF_DB: BuffDef[] = [
    ...DAMAGE_BUFFS,
    ...DEFENSE_BUFFS,
    ...WEAPON_BUFFS,
    ...ATTACHED_BUFFS,
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
        // 因势利导：进架势后借势，下一次出招暴击，用后消散
        id: 'yin_shi_li_dao',
        name: '因势利导',
        description: '借架势之势，下一次出招暴击率+30%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_crit' },
        stacking: { type: 'additive', max: 1 },
        onCritChance: () => 0.3,
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
        description: '闪避后蓄势，下一击暴击率+25%。',
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
        description: '锁定目标，洞察+2，对4AP及以上招式命中+10%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { insight: 2 },
        onHitChance: ({ source }) => (((source as ActionDefinition | undefined)?.apCost ?? 0) >= 4 ? 0.1 : 0),
    },
    {
        id: 'overlord_art_buff',
        name: '轮舞月斩',
        description: '长兵轮转如月，重器加持命中+5%；否则暴击+10%。',
        tags: [],
        expiry: { type: 'permanent' },
        onHitChance: ({ attacker }) => (attacker.weaponDef?.tags.includes('heavy') ? 0.05 : 0),
        onCritChance: ({ attacker }) => (attacker.weaponDef?.tags.includes('heavy') ? 0 : 0.1),
    },
    {
        id: 'li_wu_xu_fa',
        name: '例无虚发',
        description: '暗器命中率+40%。',
        tags: [],
        expiry: { type: 'permanent' },
        onHitChance: ({ source }) => (source?.tags?.includes('thrown') ? 0.4 : 0),
    },
    {
        id: 'hui_lei_qian',
        name: '虺雷牵',
        description: '虺雷如活物，牵丝追踪，不死不休。雷系招式命中+8%。',
        tags: ['electric'],
        expiry: { type: 'permanent' },
        onHitChance: ({ source }) => (source?.tags?.includes('electric') ? 0.08 : 0),
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '凝炁为刃，削弱招架减伤效果。招架减免减少30%。',
        tags: ['qi', 'weapon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onParryPenetration: ({ final, raw }) => {
            // 返回穿掉的伤害值: 招架减免减少30%
            const blocked = raw - final
            return round1(blocked * 0.3)
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
    // ── 漫天花雨 ──
    {
        id: 'fei_hua_shou',
        name: '漫天花雨',
        description: '暗器出手如漫天花雨，可连续追加投掷攻击。暗器招式AP消耗-25%。',
        tags: [],
        expiry: { type: 'permanent' },
        getExtraAttack: ({ source }) => {
            if (!source?.tags.includes('thrown')) return 0
            return 2
        },
        onActionCost: ({ source }) => {
            const act = source as ActionDefinition
            if (!act || !act.tags.includes('thrown')) return 0
            return -act.apCost * 0.25
        },
    },
    // ── 空手道（桑原·拳到脚到） ──
    {
        id: 'karate',
        name: '空手道',
        description: '空手道不打蛮力，把劲凝在最刁钻的打击点上。空手拳脚伤害12%，消耗-20%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, source }) => {
            if (!source?.tags.includes('unarmed')) return final
            return round1(final * 1.12)
        },
        onActionCost: ({ source }) => {
            const act = source as ActionDefinition
            if (!act || !act.tags.includes('unarmed')) return 0
            // 文案是「消耗-20%」→ 按招式 AP 取比例（与漫天花雨 -25%、明镜止水 -15% 同口径）。
            // 原先是写死的 -0.2：2AP 招只省 10%、5AP 招只省 4%，与文案对不上。
            return -act.apCost * 0.2
        },
    },
    // ── 练打秘诀 ──
    {
        id: 'lian_da_mi_jue',
        name: '练打秘诀',
        description: '暗器出手附灵巧加成：灵巧×0.04；消耗1缠劲则提升至灵巧×0.08。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, source }) => {
            if (!source?.tags?.includes('thrown')) return final
            const ratio = attacker.spendChan(1) ? 0.08 : 0.04
            return round1(final + attacker.attrs.get('dexterity') * ratio)
        },
    },
    // ── 归元劲代价 ──
    {
        id: 'inner_power_cost',
        name: '归元劲·内耗',
        description: '内力浑厚亦需运转维持，每秒消耗与归元劲全属性加成挂钩：每实际加成 1 点全属性扣 0.1 点AP。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 内耗与归元劲收益挂钩：归元劲 attrConvert(推演×0.1 → 四维全属性) 实际加 N 点全属性，
        // 每秒扣 N×0.15 AP —— 推演越高转化收益越大，维持代价也越高。
        // N 必须走 convertAttrAmount（与转化同一口径），否则会出现「按 round 收钱、按 floor 给属性」。
        apRegenPerSec: ({ target }) => {
            const gained = convertAttrAmount(target.attrs.get('wisdom'), 0.1)
            return -round1(gained * 0.15)
        },
    },
    // ── 内部追踪 ──
    { id: 'stun_track', name: '眩晕连续', description: '连续眩晕计数（5秒窗口）。', tags: [] },
    { id: 'fumble_track', name: '失心连续', description: '连续失心计数（15秒窗口）。', tags: [] },
    { id: 'steal_artifact_track', name: '盗亦有道', description: '探云手的成功率追踪。', tags: [] },
    { id: 'venom_gland_insight', name: '毒腺催化', description: '毒腺催化潜能，洞察提升。', tags: [] },
    {
        id: 'summon_haste',
        name: '御物加速',
        description: '御物加速，召唤物开火更快，每层开火间隔缩短（上限4层）。',
        tags: ['imperial', 'buff', 'summon'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 4 },
        onSummonInterval: ({ layer }) => Math.max(0.6, 1 - (layer.restoreValue ?? 0) * 0.08),
    },
    {
        // 秋水论·盈虚（灵巧/洞察潮汐） ──
        id: 'autumn_water_tide',
        name: '秋水·盈虚',
        description: '秋水时至，盈虚消长。灵巧与洞察之间每2秒挪移1点（最多4点），移动效率+10%。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        // 动态属性 buff：**不声明 attrMods**（那会被当静态加成展示，与实际每 tick 写进去的 mods 冲突），
        // 贡献只写在 description 里 —— 见 docs/design-principles.md 第 2 条
        onMoveEfficiency: () => 0.1,
        tickInterval: 2000,
        onTickHeal: ({ attacker: char, engine, state, layer }) => {
            const current = layer.restoreValue ?? 0
            const next = current >= 4 ? 0 : current + 1
            const dex = 4 - next
            const ins = next
            layer.restoreValue = next
            setLayerMods(layer, char, state, { dexterity: dex, insight: ins })
            engine?.emitLog({
                type: 'system',
                message: `[秋水·盈虚] ${char.name} 灵巧${dex} 洞察${ins}`,
                actorId: char.id,
            })
            return 0
        },
    },

    // ── 战斗状态 ──
    {
        id: 'chan_orb_regen',
        name: '凝缠珠·流转',
        description: '凝缠珠之力流转不息，每秒恢复1点缠劲。',
        tags: [],
        expiry: { type: 'permanent' },
        chanRegenPerSec: () => 1,
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
            const chanPerStack = 12
            const chan = target.chan
            if (chan <= 0) return 0
            // 只吸收整 chanPerStack 缠，余数保留到下一周期（如 26.2 缠只吸 24，留 2.2）
            const absorb = Math.floor(chan / chanPerStack) * chanPerStack
            if (absorb <= 0) return 0
            target.spendChan(absorb)
            const bonus = (absorb / chanPerStack) * 2
            if (bonus > 0 && engine) {
                processActionEffect(
                    // 每 12 缠 1 层：buff 的 attrMods 每层力/身/巧/推演 +2（bonus 恒为偶数，stacks 为整数）
                    { type: 'add_buff', buffId: 'ju_chan_fa_yi_bonus', stacks: bonus / 2 },
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
        description: '液压驱动，爆发力惊人。移动效率+10%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.1,
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
        description: '踏雪如履平地，移动效率+25%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.25,
    },
    {
        id: 'wheelchair_speed',
        name: '悬浮风火轮',
        description: '悬浮风火轮，以炁驱动。移动效率+20%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { agility: 2 },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.2,
    },
    {
        id: 'can_ying_bu_speed',
        name: '残影步',
        description: '步法如残影，移动效率+15%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 1) * 0.15,
    },
    // ── 干将/莫邪（千星融古剑，双剑合璧） ──
    {
        id: 'zhuixing',
        name: '追星',
        description: '千星雄剑，以炁驱动。命中叠1层，每层急速+3，移动效率+10%，最多2层。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        onMoveEfficiency: ({ layer }) => (layer.restoreValue ?? 0) * 0.1,
        onHaste: ({ layer }) => (layer.restoreValue ?? 0) * 3,
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
        chanRegenPerSec: ({ target }) => round1(target.attrs.get('insight') * 0.2),
    },
    {
        id: 'phantom_step',
        name: '魅影',
        description: '身法+1，持续3秒。可独立叠加。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'independent' },
        attrMods: { agility: 1 },
    },
    {
        id: 'min_move_cost',
        name: '健步如飞',
        description: '步法精妙，移动消耗最低。',
        tags: [],
        expiry: { type: 'permanent' },
        // 无钩子但被 AI/引擎按 `pendingBuffs.has('min_move_cost::…')` 探测 → 必须建层
        needsLayer: true,
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
        expiry: { type: 'duration', ms: 30000 },
        stacking: { type: 'additive', max: 2 },
        attrMods: { dexterity: 1, insight: 1 },
    },
    {
        id: 'chill_blade',
        name: '寒锋',
        description: '剑意凛冽，剑气浸骨。每层伤害+8%。最多2层。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 30000 },
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
        tickInterval: 2000,
        onTickHeal: ({ layer }) => layer.restoreValue,
    },
    {
        id: 'yun_yin',
        name: '云隐',
        description: '剑气化云，身形隐没。每层闪避+4%。最多2层。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'additive', max: 2 },
        onDodgeChance: ({ layer }) => (layer.restoreValue ?? 0) * 0.04,
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '每 4 秒自动化解一层毒素，且恢复2点气血。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 4000,
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
        description: '聚炁化火，火中淬炼不伤。自身受到的灼烧伤害减半；施加的灼烧层数提升1层。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 自身受灼烧 tick 减半（过热/永久灼烧走 tick_buff 另一条路径，不受影响）
        onDebuffTick: ({ buffId, damage }) => {
            if (buffId !== 'burn') return undefined
            return Math.max(0, round1(damage * 0.5))
        },
        onDebuffApplied: ({ layer, buffId }) => {
            if (buffId !== 'burn' || !layer) return
            layer.restoreValue += 1
        },
    },
    // ── 千锤百炼（天工·千星·特性：灼烧-30%；根骨化力道已移至被动 attr_convert 构造期结算） ──
    {
        id: 'qian_chui_bai_lian_buff',
        name: '千锤百炼',
        description: '千锤百炼，水火不侵。灼烧伤害-30%。',
        tags: ['buff', 'defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 自身受灼烧 tick -30%（铸火诀为减半，特性更克制）
        onDebuffTick: ({ buffId, damage }) => {
            if (buffId !== 'burn') return undefined
            return Math.max(0, round1(damage * 0.7))
        },
    },
    // ── 万象剑意（浩然·剑意拟万象） ──
    {
        id: 'wan_xiang_jian_yi_buff',
        name: '万象剑意',
        description: '以剑意模拟天地万象。自身每有1层增益buff（不含debuff与永久buff），暴击伤害+5%。',
        tags: ['buff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onCritDamage: ({ attacker, state }) => {
            let layers = 0
            forEachBuffOf(state.pendingBuffs, attacker.id, (def, layer) => {
                if (!def) return
                if (def.tags?.includes('debuff')) return
                // 无 expiry 的是内部追踪 buff（stun_track 等计数器），非正式增益，不计入
                if (!def.expiry || def.expiry.type === 'permanent') return
                layers += layer.restoreValue ?? 1
            })
            return round1(layers * 0.05)
        },
    },
    {
        id: 'tide_power',
        name: '潮汐内力',
        description: '内力如潮汐涨落，力道和身法之间每2秒挪移1点（最多4点）。',
        tags: ['heavy_reduce'],
        expiry: { type: 'permanent' },
        // 同秋水·盈虚：动态属性只写 description，不声明 attrMods
        tickInterval: 2000,
        onTickHeal: ({ attacker: char, engine, state, layer }) => {
            const current = layer.restoreValue ?? 0
            const next = current >= 4 ? 0 : current + 1
            const str = 4 - next
            const agi = next
            layer.restoreValue = next
            setLayerMods(layer, char, state, { strength: str, agility: agi })
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
        description: '以力驭剑，化繁为简。重器身法负担-2，招式AP消耗-0.1。',
        tags: ['heavy_reduce'],
        expiry: { type: 'permanent' },
        onActionCost: () => -0.1,
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
        description: '地煞七十二变，夺天地之造化。每6秒轮流使力道、体质、身法、灵巧、洞察、推演增加6点。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        tickInterval: 6000,
        onTickHeal: ({ attacker: char, state, layer }) => {
            const cycle = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']
            const nextIdx = ((layer.restoreValue ?? 0) + 1) % cycle.length
            const stat = cycle[nextIdx]
            layer.restoreValue = nextIdx
            setLayerMods(layer, char, state, { [stat]: 6 })
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
            if (!char.spendChan(cost)) return 0
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
        onHitChance: ({ source, triggered }) => (isMainMove(source, triggered) ? 1 : 0),
        onCanBeParried: ({ source, triggered }) => (isMainMove(source, triggered) ? false : true),
        onCritChance: ({ source, triggered }) => (isMainMove(source, triggered) ? 1 : 0),
        // 自包含消耗：主招必中必暴 → 必然暴击，暴击结算后删除自身并重置玄机（不再由引擎硬编码）
        onCritical: ({ attacker, engine, state, source, triggered }) => {
            if (!isMainMove(source, triggered)) return
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
        id: 'zhou_liu_bu_xi',
        name: '周流不息',
        description: '周流不息，盈虚消长。下个炁招命中+10%/层、伤害+10%/层（出招即消耗）。',
        tags: ['buff', 'qi', 'chan'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        // 建层时归零（additive 需 stacks≥1 才能建层，但层数应由溢出累积驱动，开局 0 层）
        onBuffApplied: ({ layer }) => {
            layer.restoreValue = 0
            layer.extra = { ...(layer.extra ?? {}), overflowAcc: 0 }
        },
        // 缠满后的溢出量累积：每满10点叠1层（累积值存 layer.extra.overflowAcc）
        onChanOverflow: ({ layer, engine, target, overflow }) => {
            if (overflow <= 0 || !engine) return
            const acc = ((layer.extra?.overflowAcc as number | undefined) ?? 0) + overflow
            layer.extra = { ...(layer.extra ?? {}), overflowAcc: acc }
            const toLayers = Math.floor(acc / 10)
            if (toLayers <= 0) return
            layer.extra = { ...layer.extra, overflowAcc: acc - toLayers * 10 }
            // 叠层（走 add_buff 统一上限逻辑）
            processActionEffect(
                { type: 'add_buff', buffId: 'zhou_liu_bu_xi', stacks: toLayers },
                { self: target, enemy: engine.getOpponent(target.id)!, engine, tMs: engine.state.turn.currentTime },
            )
        },
        onHitChance: ({ source, layer }) => (isMainMove(source) ? layer.restoreValue * 0.1 : 0),
        onDealDamage: ({ final, source, layer }) =>
            isMainMove(source) ? round1(final * (1 + layer.restoreValue * 0.1)) : final,
        // 出招即消耗全部层（用掉这招的加持）；仅炁主招触发
        onAction: ({ source, attacker, engine, state, layer }) => {
            if (!isMainMove(source)) return
            const stacks = layer.restoreValue
            if (stacks <= 0) return
            state.pendingBuffs.delete(`zhou_liu_bu_xi::${attacker.id}`)
            engine?.emitLog({
                type: 'system',
                message: `[周流不息] 「${attacker.name}」 风罡迸发，${(source as ActionDefinition).name} 消耗${stacks}层（命中+${stacks * 10}%、伤害+${stacks * 10}%）`,
                actorId: attacker.id,
            })
        },
    },
    {
        // 无想（无想剑强化下一招）：主招命中+10%、爆伤+50%，暴击后消散
        id: 'wu_xiang',
        name: '无想',
        description: '一刀既出，迅如雷，凛如冰。下一招暴击+10%、暴击伤害+70%，暴击后消散。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        // 仅对主招生效（召唤物/辅招不吃，与 onCritical 自删判断一致）
        onCritChance: ({ source }) => (isMainMove(source) ? 0.1 : 0),
        onCritDamage: ({ source }) => (isMainMove(source) ? 0.7 : 0),
        onCritical: ({ attacker, engine, state, source }) => {
            if (!isMainMove(source)) return
            state.pendingBuffs.delete(`wu_xiang::${attacker.id}`)
            engine?.emitLog({
                type: 'system',
                message: `[无想] 「${attacker.name}」 一刀已出，无想消散`,
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
        attrMods: { strength: -2 },
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
        description: '剧毒吐纳，每3秒释放毒素。血量越少，毒雾越烈。',
        tags: ['low_hp'],
        expiry: { type: 'permanent' },
        tickInterval: 3000,
        onTickDamage: ({ attacker: self, engine }) => {
            if (!engine) return 0
            const target = engine.getOpponent(self.id)
            if (!target) return 0
            const tMs = engine.state.turn.currentTime
            const hpRatio = self.hp / self.maxHp
            const debuffChance = Math.min(1, Math.max(0, (0.95 - hpRatio) * 0.3))

            processActionEffect(
                { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: debuffChance * 0.5 },
                { self, enemy: target, engine, tMs },
            )
            const poisonStacks = hpRatio < 0.5 ? 2 : 1
            processActionEffect(
                { type: 'add_debuff', buffId: 'poison', stacks: poisonStacks, chance: debuffChance },
                { self, enemy: target, engine, tMs },
            )

            return 0
        },
    },
    {
        id: 'gu_tong_body',
        name: '蛊童圣体',
        description: '从小被炼的毒体，拳脚互传毒；每次出招自身蓄毒，毒体不惧自身毒素。',
        tags: [],
        expiry: { type: 'permanent' },
        // 每次出招自身蓄毒（毒体蕴毒，供毒腺消耗）
        onAction: ({ attacker, engine, state }) => {
            if (!engine) return
            processActionEffect(
                { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 },
                { self: attacker, enemy: attacker, engine, tMs: state.turn.currentTime },
            )
        },
        // 毒体对自身毒素减免75%（承受25%）
        onDebuffTick: ({ buffId, damage }) => (buffId === 'poison' ? round1(damage * 0.25) : undefined),
        onDealDamage: ({ final, target, attacker, engine, source }) => {
            if (source?.tags?.includes('unarmed') && rng.chance(0.4)) {
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
        id: 'shi_gu_buff',
        name: '蚀蛊',
        description: '自幼炼蛊，毒入敌体自行繁衍。你施加的中毒每跳有20%概率加深1层。',
        tags: ['poison'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 施加毒时给目标挂「繁衍」标记（自毒不繁衍，避免自身毒层失控）
        onDebuffApplied: ({ self, enemy, engine, state, buffId }) => {
            if (buffId !== 'poison' || !engine || self.id === enemy.id) return
            const key = `shi_gu_deepen::${enemy.id}`
            const mark = state.pendingBuffs.get(key)
            if (mark) {
                mark.extra = { sourceId: self.id }
                return
            }
            state.pendingBuffs.set(key, { restoreValue: 1, extra: { sourceId: self.id } })
        },
    },
    // 目标身上的繁衍标记：毒 tick 时概率加深（蚀蛊）
    {
        id: 'shi_gu_deepen',
        name: '蚀蛊·繁衍',
        description: '蛊毒入体自行繁衍，中毒每跳有概率加深。',
        tags: ['poison'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDebuffTick: ({ buffId, target, engine, layer }) => {
            if (buffId !== 'poison' || !engine) return undefined
            const now = engine.state.eventTime
            // 同一 tick 事件只加深一次（防止叠加层→立即结算→再叠的连环爆炸）
            if (layer.extra?.lastTick === now) return undefined
            if (!rng.chance(0.15)) return undefined
            const sourceId = (layer.extra?.sourceId as string) ?? target.id
            const atk = engine.getCharacter(sourceId)
            if (!atk || !atk.isAlive()) return undefined
            layer.extra = { ...(layer.extra ?? {}), lastTick: now }
            processActionEffect(
                { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 },
                { self: atk, enemy: target, engine, tMs: engine.state.turn.currentTime },
            )
            return undefined
        },
    },
    {
        id: 'yi_ma_xin_yuan',
        name: '意马心猿',
        description: '凝神聚气，命中+5%，命中时令对手迷惑。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onHitChance: () => 0.05,
        onDealDamage: ({ final, attacker, target, engine, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'confuse', stacks: 1, chance: 1 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }
            return final
        },
    },
    {
        id: 'venom_gland',
        name: '毒腺',
        description: '每10秒消耗3层自身毒素，获得1点洞察，持续30秒。不满3层时不触发。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 10000,
        onTickHeal: ({ attacker: self, engine, state }) => {
            const poisonKey = `poison::${self.id}`
            const poisonLayer = state.pendingBuffs.get(poisonKey)
            if (!poisonLayer || poisonLayer.restoreValue < 3) return 0
            poisonLayer.restoreValue -= 3
            if (poisonLayer.restoreValue <= 0) {
                state.pendingBuffs.delete(poisonKey)
                state.turn.removeEvents(`tick_poison_${self.id}`)
            }
            const now = state.turn.currentTime
            const appId = genAppId(now)
            const key = `venom_gland_insight::${self.id}::${appId}`
            state.pendingBuffs.set(key, { restoreValue: 1, mods: { insight: 1 }, modsPerStack: { insight: 1 } })
            self.rebuildDerived(state)
            state.turn.scheduleSystemEventAt(`buff_end_${key}`, now + 30000, 'buff_end')
            engine?.emitLog({
                type: 'system',
                message: `[毒腺] ${self.name} 消耗3层毒，洞察+1（30s）`,
                actorId: self.id,
            })
            return 0
        },
    },
    {
        id: 'wuxue_baodian_zonggang',
        name: '武学宝典总纲',
        description: '通晓天下武学，以推演预判。闪避/招架→武学·破+1层；暴击→武学·避+1层。',
        tags: [],
        expiry: { type: 'permanent' },
        onDodge: ({ engine, target, attacker, state }) => {
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'martial_arts_crit', stacks: 1 },
                    { self: target, enemy: attacker, engine, tMs: state.turn.currentTime },
                )
            }
        },
        onParry: ({ engine, target, attacker, state }) => {
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
        id: 'wuxue_baodian_shang',
        name: '武学宝典上',
        description: '通晓天下武学路数。自身每有1个奖励标签，伤害+1.5%，上限15%。',
        tags: [],
        expiry: { type: 'permanent' },
        // 每 tag +1.5% 伤害（上限 15%）
        onDealDamage: ({ final, attacker }) => {
            const pct = Math.min(0.15, countRewardTags(attacker) * 0.015)
            if (pct <= 0) return final
            return round1(final * (1 + pct))
        },
    },
    {
        id: 'wuxue_baodian_xia',
        name: '武学宝典下',
        description: '通晓天下武学路数。自身每有1个奖励标签，受到伤害-1.5%，上限15%。',
        tags: [],
        expiry: { type: 'permanent' },
        // 每 tag -1.5% 受到伤害（上限 15%）
        onTakeDamage: ({ final, target }) => {
            const pct = Math.min(0.15, countRewardTags(target) * 0.015)
            if (pct <= 0) return final
            return round1(final * (1 - pct))
        },
    },
    {
        id: 'dongyou_zhuwei',
        name: '洞幽烛微',
        description:
            '洞察幽微，看破对手武学路数。对手每使用带某标签的招式，看破该标签一层；看破越深，该标签招式对你的闪避与减伤越高（各收敛至7%）。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 对方出招 → 该招式每个 tag 看破次数 +1（存 layer.extra['kanpo_<tag>']）
        onOpponentAction: ({ layer, source }) => {
            if (!source?.tags?.length) return
            for (const t of source.tags) {
                const key = `kanpo_${t}`
                const prev = (layer.extra?.[key] as number | undefined) ?? 0
                layer.extra = { ...(layer.extra ?? {}), [key]: prev + 1 }
            }
        },
        // 看破率 = min(10%, 2% × log2(1 + 该招式各 tag 看破次数之和))——多 tag 招式取各 tag 之和，各自封顶
        onDodgeChance: ({ source, layer }) => kanpoRate(source, layer),
        onTakeDamage: ({ final, source, layer }) => {
            const rate = kanpoRate(source, layer)
            if (rate <= 0) return final
            return round1(final * (1 - rate))
        },
    },
    {
        id: 'no_parry_buff',
        name: '流风回雪',
        description: '招架率的22%转化为闪避率。',
        tags: [],
        stacking: { type: 'none' },
        onCanParry: () => false,
        onDodgeChance: ({ target }) => {
            const dex = target.attrs.get('dexterity')
            const ins = target.attrs.get('insight')
            return calcParryChance(dex, ins) * 0.22
        },
    },
    {
        id: 'draw_sword_combo_buff',
        name: '云龙三现',
        tags: ['slash'],
        description:
            '龙游云中，见首不见尾。交替使用斩击可叠加增伤（至多3层）；紧接重复上一招不归零、只是不再叠加，连打同一招会逐渐回落。每层附加身法+灵巧伤害。',
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
        // 命中后按当前层数附加身法+灵巧伤害
        onDealDamage: ({ final, source, layer, attacker, engine }) => {
            if (!source || !source.tags.includes('slash')) return final
            const diff = layer.restoreValue ?? 0
            if (diff === 0) return final
            // 每层附加 (身法+灵巧)×0.1 伤害
            const bonus = round1((attacker.attrs.get('agility') + attacker.attrs.get('dexterity')) * 0.03 * diff)
            if (engine) {
                engine.emitLog({ type: 'system', message: `[云龙三现] ${diff}层·+${bonus}伤害`, actorId: attacker.id })
            }
            return round1(final + bonus)
        },
    },
    {
        id: 'bean_buff',
        name: '茴香气',
        description: '茴香豆的余香，全属性+1。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 10000 },
        attrMods: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1, wisdom: 1 },
    },
    // ── 酒鬼·无志 ──
    {
        id: 'you_shen',
        name: '游身',
        description: '游身步法。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 2500 },
        stacking: { type: 'independent' },
        attrMods: { agility: 1, dexterity: 1 },
    },
    {
        id: 'sword_focus',
        name: '怒炁充盈',
        description: '攻击落空时积攒怒气，暴击时倾泻而出：每层爆伤+50%，暴击后怒气清空。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        // 攻击被对方闪避（未命中）→ 怒气+1
        onDodged: ({ layer }) => {
            layer.restoreValue = (layer.restoreValue ?? 0) + 1
        },
        // 暴击时每层 +30% 爆伤（onCritDamage 加算到爆伤倍率，仅在暴击时生效）
        onCritDamage: ({ layer }) => (layer.restoreValue ?? 0) * 0.5,
        // 暴击结算后消费全部怒气（清空重新积累）
        onCritical: ({ layer }) => {
            layer.restoreValue = 0
        },
    },
    // ── 小树 ──
    {
        id: 'sword_enhance_buff',
        name: '灵炁灌注',
        description: '4秒内伤害+10%，命中+5%。',
        tags: ['imperial', 'buff'],
        expiry: { type: 'duration', ms: 4000 },
        stacking: { type: 'none' },
        onDealDamage: ({ final }) => round1(final * 1.1),
        onHitChance: () => 0.05,
    },
    // ── 战术腰包 ──
    {
        id: 'adrenaline_rush',
        name: '肾上腺素',
        description: 'AP恢复速度翻倍，持续12秒。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 12000 },
        apRegenPerSec: ({ target }) => Math.max(1, Math.round(Math.max(2, target.attrs.get('wisdom') * 0.1))),
    },
    // ── 浮游眼 ──
    {
        id: 'floating_eye_buff',
        name: '浮游眼',
        description: '洞察流转，预判对手。洞察+4，被迷眼时最多 1 层。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { insight: 4 },
        onReceiveDebuff: (ctx) => (ctx.buffId === 'sand_blind' && ctx.stacks > 1 ? 1 : undefined),
    },
    // ── 血战到底 ──
    {
        id: 'blood_rage',
        name: '血战到底',
        description: '气血越低属性加成越高。力道、身法、灵巧随血量减少而提升。',
        tags: ['low_hp'],
        expiry: { type: 'permanent' },
        onHpChange: ({ target: char, state, layer }) => {
            const hpPct = char.hp / char.maxHp
            let str = 0,
                agi = 0,
                dex = 0
            if (hpPct < 0.25) {
                str = 3
                agi = 3
                dex = 3
            } else if (hpPct < 0.6) {
                str = 2
                agi = 2
                dex = 2
            }

            const prev = layer.extra as Record<string, number> | undefined
            if (prev?.str === str && prev?.agi === agi && prev?.dex === dex) return
            setLayerMods(layer, char, state, { strength: str, agility: agi, dexterity: dex })
            layer.extra = { str, agi, dex }
        },
    },
    {
        // 神照经：血越少 AP 回复越快（额外回复，封顶 0.4/秒）。onHpChange 触发重算行动时间
        id: 'shen_zhao_jing',
        name: '神照经',
        description: '神照通明，气血愈衰，气机愈盛。气血越低，AP回复越快，最多+0.4/秒。',
        tags: ['low_hp'],
        expiry: { type: 'permanent' },
        apRegenPerSec: ({ target }) => 0.4 * (1 - target.hp / target.maxHp),
    },
    // ── 观自在眼（姬然） ──
    {
        id: 'guan_zi_zai_yan',
        name: '观自在眼',
        description: '气血越低，洞察、推演越高。',
        tags: ['low_hp'],
        expiry: { type: 'permanent' },
        onHpChange: ({ target: char, state, layer }) => {
            const hpPct = char.hp / char.maxHp
            let ins = 0,
                wis = 0
            if (hpPct < 0.3) {
                ins = 5
                wis = 5
            } else if (hpPct < 0.7) {
                ins = 3
                wis = 2
            }
            const prev = layer.extra as Record<string, number> | undefined
            if (prev?.ins === ins && prev?.wis === wis) return
            setLayerMods(layer, char, state, { insight: ins, wisdom: wis })
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
    // ── 三分归元·元气（来风·三分归元气被动） ──
    {
        id: 'sangui_yuanqi',
        name: '元气',
        description: '元气充盈，力道、身法、灵巧、洞察+1。',
        tags: ['buff', 'low_hp'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { strength: 1, agility: 1, dexterity: 1, insight: 1 },
        // 属性在账上，但「三分归元」要 `remove_buff` 消耗它（连账上属性一起停掉）→ 必须建层
        needsLayer: true,
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
    // ── 自动净化背心 ──
    {
        id: 'auto_purify',
        name: '自动净化',
        description: '每5秒：若身中可净化的负面状态，消耗1点缠劲，净化1层；无负面则不消耗。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        tickInterval: 5000,
        onTickHeal: ({ target, engine, state }) => {
            if (!engine) return 0
            // 可净化白名单（按净化优先级排列）：流血/毒/烧 → 麻痹/霜冻 → 其余削弱控制。
            // 义体常驻（implant）与永久失心不进白名单——自动净化不免费抵消义体惩罚。
            const PURIFIABLE = [
                'bleed',
                'poison',
                'burn',
                'paralyze',
                'frost',
                'confuse',
                'weakness',
                'fumble_chance_temp',
                'duan_qi',
            ]
            // 遍历目标身上所有层，取白名单中优先级最高的那一个（每 5 秒只净化 1 层）
            let hit: { key: string; layer: BuffLayer; additive: boolean; name: string } | undefined
            let bestIdx = Infinity
            forEachBuffOf(state.pendingBuffs, target.id, (def, layer, buffId, key) => {
                const idx = PURIFIABLE.indexOf(buffId)
                if (idx < 0 || idx >= bestIdx) return
                const st = def?.stacking?.type
                const additive = st === 'additive'
                if (additive && (layer.restoreValue ?? 0) <= 0) return
                bestIdx = idx
                hit = { key, layer, additive: st === 'additive', name: def?.name ?? buffId }
            })
            // 无任何可净化负面 → 不消耗缠劲
            if (!hit) return 0
            // 有则消耗 1 点缠劲，净化 1 层（additive 减 1；independent/none 移除本条）
            // if (!target.spendChan(1)) return 0
            if (hit.additive) {
                hit.layer.restoreValue = (hit.layer.restoreValue ?? 0) - 1
                if ((hit.layer.restoreValue ?? 0) <= 0) {
                    // 层清空 → 删层 + 重算（属性自动精确回退）
                    dropBuffLayer(state, hit.key)
                }
            } else {
                // independent 每层独立带属性修正（麻痹/眩晕/虚弱等 attrMods）——
                // 直接 delete 会永久吞掉身法/灵巧，必须走 dropBuffLayer（删层 + 重算）
                dropBuffLayer(state, hit.key)
            }
            engine.emitLog({
                type: 'system',
                message: `[自动净化] ${target.name} 消耗1点缠劲，净化1层${hit.name}`,
                actorId: target.id,
            })
            return 0
        },
    },
    {
        id: 'ling_xu_zhen_jie',
        name: '灵枢真解',
        description: '招式30%概率造成2层麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, engine, state }) => {
            if (engine) {
                const enemy = engine.getOpponent(attacker.id)
                if (enemy) {
                    processActionEffect(
                        { type: 'add_debuff', buffId: 'paralyze', stacks: 2, chance: 0.3 },
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
    // ── 毒药大师（唐柔·唐门制毒） ──
    {
        id: 'du_yao_da_shi',
        name: '毒药大师',
        description: '唐门制毒世家，施毒精微。施毒暴击时，每6点灵巧多叠1层毒。',
        tags: ['poison'],
        expiry: { type: 'permanent' },
        onDebuffApplied: ({ self, enemy, engine, state, layer, buffId }) => {
            if (!layer || buffId !== 'poison' || !engine) return
            // 自身当前暴击率（基础 + 经络初鉴等 onCritChance 修正）
            let bonus = 0
            forEachBuffOf(state.pendingBuffs, self.id, (def, l) => {
                if (def?.onCritChance)
                    bonus += def.onCritChance({
                        final: 0,
                        raw: 0,
                        target: enemy,
                        attacker: self,
                        engine,
                        state,
                        layer: l,
                    })
            })
            const crit = calcCritChance(self.attrs.get('dexterity'), self.attrs.get('insight'), bonus)
            if (calcRoll(crit).success) {
                // 层数随灵巧成长：每 6 点灵巧多叠 1 层，至少 1 层
                const layers = Math.max(1, Math.floor(self.attrs.get('dexterity') / 6))
                // 直接往 poison 层数据里追加（每层 = 1 个 tick 桶 + restoreValue+1），不走施加流程，无递归
                const ticksPerStack = calcPoisonTicksPerStack(enemy.attrs.get('wisdom'))
                const existing: number[] = (layer.extra?.remainingTicks as number[]) ?? []
                for (let i = 0; i < layers; i++) existing.push(ticksPerStack)
                layer.restoreValue = (layer.restoreValue ?? 0) + layers
                layer.extra = { ...layer.extra, remainingTicks: existing }
            }
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
            round1(calcApRegenPerSec(target.attrs.get('wisdom')) * ((layer.restoreValue ?? 0) * 0.1)),
    },
    // ── 挂挡（固定内息回复） ──
    {
        id: 'gear_shift_buff',
        name: '挡',
        description: '挂挡蓄劲，内息流转。每层内息回复+0.1/s。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 5 },
        apRegenPerSec: ({ layer }) => round1((layer.restoreValue ?? 0) * 0.1),
    },
    // ── 淬毒工具 ──
    {
        id: 'poison_coating',
        name: '淬毒工具',
        description: '刃上淬毒，割裂或刺击时有30%概率令其中毒。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, source, attacker, target, engine, state }) => {
            if (!source) return final
            if (!source.tags.includes('pierce') && !source.tags.includes('slash')) return final
            if (engine) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 0.3 },
                    { self: attacker, enemy: target, engine, tMs: state.turn.currentTime },
                )
            }

            return final
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
                { type: 'add_debuff', buffId: 'weakness', stacks: 2, chance: 1 },
                { self, enemy, engine, tMs: engine.state.turn.currentTime },
            )
        },
    },
    // ── 战斗芯片 ──
    {
        id: 'combat_chip',
        name: '战斗分析',
        description: '战斗数据分析，回合开始概率叠加层数。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 5 },
        onTurnEnd: ({ layer }) => {
            if (rng.chance(0.6)) layer.restoreValue = Math.min(5, (layer.restoreValue ?? 0) + 1)
        },
        onHitChance: ({ layer }) => layer.restoreValue * 0.01,
        onCritChance: ({ layer }) => layer.restoreValue * 0.02,
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
            setLayerMods(layer, char, state, { strength: bonus, agility: bonus, dexterity: bonus })
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
    {
        id: 'special_forces_dagger',
        name: '特种兵匕首',
        description: '耗1缠劲，追加1点电伤、1点穿透电伤，并有40%概率使目标麻痹1层。',
        tags: ['electric'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onAfterDealDamage: ({ attacker, target, engine, state }) => {
            if (!attacker.spendChan(1)) return 0
            processActionEffect(
                { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 0.4 },
                { self: attacker, enemy: target, engine: engine!, tMs: state.turn.currentTime },
            )
            // 共 2 点，其中 1 点穿透
            return { normal: 2, piercing: 1 }
        },
    },
    // ── 磁暴线圈（天工·千星·电系增幅） ──
    {
        id: 'ci_magnetic_coil_buff',
        name: '磁暴线圈',
        description: '电磁增幅线圈缠绕兵刃。电系招式伤害+15%；施加的麻痹层数翻倍。',
        tags: ['craft', 'electric'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, source }) => {
            if (!source?.tags?.includes('electric')) return final
            return Math.round(final * 1.15 * 10) / 10
        },
        // 施加麻痹时层数翻倍（同铸火诀放大灼烧：independent 每层独立，×2 各层）
        onDebuffApplied: ({ buffId, layer }) => {
            if (buffId !== 'paralyze' || !layer) return
            layer.restoreValue = (layer.restoreValue ?? 0) * 2
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
        attrMods: { insight: -4 },
        onHitChance: ({ attacker }) => attacker.attrs.get('wisdom') * 0.003,
        onDodgeChance: ({ target }) => target.attrs.get('wisdom') * 0.005,
        onParryChance: ({ target }) => target.attrs.get('wisdom') * 0.005,
        onCritChance: ({ attacker }) => attacker.attrs.get('wisdom') * 0.005,
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'sand_blind') return 0
            return undefined
        },
    },
    {
        id: 'shen_zhao',
        name: '神照',
        description: '入神坐照。累计消耗15AP，提升2点洞察，最多3层；满3层后免疫所有洞察减益。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onBuffApplied: ({ layer }) => {
            layer.restoreValue = 0
            layer.extra = { stage: 0 }
        },
        onApSpent: ({ self, amount, engine, state, layer }) => {
            const total = (layer.restoreValue ?? 0) + amount
            const stage = Math.min(3, Math.floor(total / 15))
            const previous = (layer.extra?.stage as number | undefined) ?? 0
            layer.restoreValue = total
            if (stage <= previous) return
            const stageValues = [0, 2, 4, 6]
            const gained = stageValues[stage] - stageValues[previous]
            addLayerMods(layer, self, state, { insight: gained })
            layer.extra = { ...(layer.extra ?? {}), stage }
            engine.emitLog({
                type: 'system',
                message: `[神照] ${self.name} 洞察+${gained}（${stage}/3）`,
                actorId: self.id,
            })
        },
    },
    // ── 西域奇毒 ──
    {
        id: 'western_poison_buff',
        name: '西域奇毒',
        description: '剧毒入体，麻痹神经。每次中毒时叠加3层麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDebuffApplied: ({ buffId, self, enemy, engine }) => {
            if (buffId !== 'poison' || !engine) return
            processActionEffect(
                { type: 'add_debuff', buffId: 'paralyze', stacks: 3, chance: 1 },
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
        stacking: { type: 'additive', max: 2 },
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
        attrMods: { agility: -2 },
        onActionCost: () => -1,
    },
    // ── 明镜止水 ──
    {
        id: 'mingjing_zhishui_buff',
        name: '明镜止水',
        description: '心如明镜，神清目明。招式AP与缠劲消耗各-15%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId === 'fumble_chance_temp' || ctx.buffId === 'confuse') {
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
        // 心不散则炁不泄：缠劲消耗同幅 -15%（缠劲才是「三寸光」这类招式的真门槛）
        onActionChanCost: ({ source }) => {
            const chan = (source as ActionDefinition | undefined)?.chanCost ?? 0
            return chan > 0 ? -chan * 0.15 : 0
        },
    },
    {
        id: 'xu_ying',
        name: '虚影',
        description: '残影步带出的虚影，身法飘忽。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'additive', max: 3 },
        onDodgeChance: ({ layer }) => layer.restoreValue * 0.05,
    },
    {
        id: 'ba_gua_bu',
        name: '八卦',
        description: '走位踏出的八卦步，身法飘忽，伺机而动。',
        tags: ['buff'],
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'additive', max: 3 },
        onDodgeChance: ({ layer }) => layer.restoreValue * 0.03,
        onCritChance: ({ layer }) => layer.restoreValue * 0.05,
    },
    {
        id: 'yun_bu_foresight',
        name: '云步·先机',
        description: '云步后身形缥缈，下次攻击命中+8%。',
        tags: ['buff'],
        expiry: { type: 'consumed', trigger: 'on_hit' },
        stacking: { type: 'none' },
        onHitChance: () => 0.08,
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
        description: '以炁御剑，剑随意动。延长攻击距离；命中附加少量增伤，增伤不超过原伤害的 25%。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onRuntimeAction: (_ctx, action) => buffEnhanceActionRange(action, 1),
        onDealDamage: ({ final, source }) => {
            const ap = Math.max(1, (source as ActionDefinition | undefined)?.apCost ?? 0)
            // 增伤封顶：不超过原伤害的 25%（多段招按每段算，否则弱击/多段会被这一项抬得过多）
            const bonus = Math.min(Math.sqrt(ap) / actionHits(source as ActionDefinition), final * 0.25)
            return round1(final + bonus)
        },
    },
    // ── 刃炁精通（攻击侧：持刃攻击令对手叠刃炁） ──
    {
        id: 'momentum_mastery_buff',
        name: '刃炁精通',
        description: '斩刺伤害令对手叠刃炁。',
        tags: ['slash'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onDealDamage: ({ final, source, attacker, target, engine, state }) => {
            if (!engine || !source) return final
            // 炁招（炁弹/炁刃）：按招式自身 tag 判断是否带刃——炁刃带 slash 可叠，炁弹不带不叠
            const qiMove = source.tags.includes('qi_action') || source.tags.includes('summon')
            const ok = qiMove
                ? source.tags.includes('slash') || source.tags.includes('pierce')
                : !!attacker.weaponDef?.tags.includes('slash')
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
        tags: ['buff', 'low_hp'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        canTriggerAction: () => false,
    },
    {
        id: 'cang_niao_buff',
        name: '苍鸟',
        description: '苍鸟掠空，内息流转。10秒内，AP回复+0.4/s。',
        tags: ['buff', 'qi'],
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'none' },
        apRegenPerSec: () => 0.4,
    },
    {
        id: 'chanzi_chan_regen',
        name: '玄武定',
        description: '玄武定息，缠劲生生不息，每秒恢复1点缠劲。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        chanRegenPerSec: () => 0.5,
    },
    // ── 禅心慧眼（禅子·推演化命中暴击） ──
    {
        id: 'chan_xin_hui_yan_buff',
        name: '禅心慧眼',
        description: '禅心通明，慧眼洞悉破绽。以推演窥破对手招式轨迹，每点推演+0.5%命中、+0.2%暴击。',
        tags: ['buff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        onHitChance: ({ attacker }) => attacker.attrs.get('wisdom') * 0.004,
        onCritChance: ({ attacker }) => attacker.attrs.get('wisdom') * 0.005,
    },
    // ── 枯蝉（阿九·锁血：致死伤害无效1次，触发后蜕壳） ──
    {
        id: 'ku_chan',
        name: '枯蝉',
        description: '枯蝉锁血。受到致死伤害时无效那一次伤害，随后蜕壳。',
        tags: ['buff', 'defense', 'low_hp'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 锁血：onTakeDamage 阶段（扣血前）判断是否致死——是则返回 0 无效本次伤害，消耗次数、耗尽缠劲并蜕壳
        onTakeDamage: ({ final, target, layer, engine, state }) => {
            if (final <= 0 || (layer.restoreValue ?? 0) <= 0) return final
            // 本次伤害会致死（伤害 ≥ 当前气血）→ 锁血
            if (final < target.hp) return final
            layer.restoreValue = 0
            // 消耗自身所有缠劲（枯蝉蜕壳，缠劲尽散）
            if (target.chan > 0) target.spendChan(target.chan)
            // 蜕壳：移除枯蝉，挂「枯蝉蜕壳」（免疫DOT + 禁疗）
            state.pendingBuffs.delete(`ku_chan::${target.id}`)
            if (engine) {
                processActionEffect(
                    { type: 'add_buff', buffId: 'ku_chan_tuo_ke' },
                    { self: target, enemy: target, engine, tMs: state.turn.currentTime },
                )
                engine.emitLog({
                    type: 'system',
                    message: `[枯蝉] ${target.name} 锁血！缠劲尽散，无效本次伤害`,
                    actorId: target.id,
                })
            }
            return 0
        },
    },
    // ── 枯蝉蜕壳（锁血后：免疫一切DOT + 禁疗） ──
    {
        id: 'ku_chan_tuo_ke',
        name: '枯蝉蜕壳',
        description: '枯蝉蜕壳，只余空壳。免疫一切持续伤害，且无法被治疗。',
        tags: ['buff', 'defense'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 免疫一切 DOT（poison/burn/bleed）
        onDebuffTick: ({ buffId }) => (buffId === 'poison' || buffId === 'burn' || buffId === 'bleed' ? 0 : undefined),
        // 禁疗（onReceiveHeal 在回血后触发，反向扣回抵消治疗）
        onReceiveHeal: ({ target, final: amount }) => {
            if (amount <= 0) return
            target.hp = Math.max(0, target.hp - amount)
        },
    },
]
