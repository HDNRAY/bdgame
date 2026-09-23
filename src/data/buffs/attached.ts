import type { BuffDef } from './types'
import { rng } from '../../engine/util/rng'
import { insightReductionHalfCheck } from '../utils/insightGuard'

/**
 * 属性类 buff：`stat_buff` 效果类型删除后的唯一属性加成载体。
 *
 * 分四组：
 *  1. 来源附着 buff：由来源 `on_construct` 槽的 `apply:[add_buff]` 挂上，`attrMods × stacks` 在构造期就折进
 *     来源层账。纯属性携带者（无钩子/时长/叠层等）**不建战斗层**，但会由 `getBuffsForDisplay`
 *     从账上补进战斗界面 buff 列表（属性来源另见 `attrBreakdown`）。
 *  2. 战斗期具名属性 buff：`_qiti_awaken` 的六维强化与凌波微步的闪避。
 *  3. 聚缠法衣吸收缠劲换来的临时属性（independent 每层独立计时）。
 *  4. 构造期载体 buff：`attrMods` 之外的那几类构造期贡献（`maxHpMod` / `triggerSlotMod` /
 *     `attrConvert` / `weaponTags` / `buffDurationFn` / `statRestriction`）。它们只在
 *     `buildSourceLayer` 建来源层时被读一次，一般**不建战斗层**（`needsRuntimeLayer` 为假），
 *     但同时承载来源 tooltip 的说明文字（`describeEffect` 走 `add_buff` 分支）。
 *
 * 只有「玩家不该在 buff 栏看到」的纯内部标记才保留 `hidden: true`（见 `iaijutsu_ready_buff`）。
 */
export const ATTACHED_BUFFS: BuffDef[] = [
    // ── 义体 ──
    {
        id: 'muscle_boost_attr',
        name: '肌肉强化针',
        description: '力道+5、身法+5。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 5, agility: 5 },
    },
    {
        id: 'titanium_arm_attr',
        name: '钛合金臂',
        description: '力道+2、灵巧+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 2, dexterity: 2 },
    },
    {
        id: 'mechanical_eye_attr',
        name: '机械眼球',
        description: '洞察+4。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { insight: 4 },
    },
    {
        id: 'nano_metal_heart_attr',
        name: '纳米金属心脏',
        description: '力道+2、身法+2、灵巧+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 2, agility: 2, dexterity: 1 },
    },
    {
        id: 'synthetic_lung_attr',
        name: '合成肺叶',
        description: '根骨+2、力道+1、身法+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { vitality: 2, strength: 1, agility: 1 },
    },
    {
        id: 'neural_net_attr',
        name: '人造神经网络',
        description: '身法+1、灵巧+4、洞察+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { agility: 1, dexterity: 4, insight: 1 },
    },
    {
        id: 'combat_chip_attr',
        name: '战斗芯片',
        description: '推演+5。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { wisdom: 5 },
    },
    {
        id: 'cochlear_implant_attr',
        name: '人造耳蜗',
        description: '洞察+4、推演+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { insight: 4, wisdom: 1 },
    },
    {
        id: 'doctor_chip_attr',
        name: '战斗芯片·改',
        description: '推演+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { wisdom: 2 },
    },
    {
        id: 'titanium_spine_attr',
        name: '钛合金脊椎',
        description: '根骨+5。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { vitality: 5 },
    },
    // ── 奇物 ──
    {
        id: 'pu_ti_tou_huan_attr',
        name: '菩提头环',
        description: '推演+4。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { wisdom: 4 },
    },
    {
        id: 'wisdom_talisman_attr',
        name: '通明符',
        description: '洞察+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { insight: 1 },
    },
    {
        id: 'other_mountain_attr',
        name: '他山之石',
        description: '灵巧+1、洞察+2、推演+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { dexterity: 1, insight: 2, wisdom: 2 },
    },
    {
        id: 'snake_gall_attr',
        name: '菩斯曲蛇胆',
        description: '力道+2、根骨+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 2, vitality: 2 },
    },
    {
        id: 'fiery_eyes_attr',
        name: '火眼金睛',
        description: '洞察+5。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { insight: 5 },
    },
    {
        id: 'iron_mask_attr',
        name: '机巧面具',
        description: '洞察+3、推演+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { insight: 3, wisdom: 2 },
    },
    {
        id: 'tactical_goggles_attr',
        name: '战术护目镜',
        description: '推演+2、洞察+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { wisdom: 2, insight: 2 },
    },
    {
        id: 'nano_exoskeleton_attr',
        name: '纳米外骨骼',
        description: '力道+3、身法+3。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 3, agility: 3 },
    },
    // ── 功法 ──
    {
        id: 'dark_room_catch_attr',
        name: '暗室抓雀功',
        description: '身法+2、灵巧+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { agility: 2, dexterity: 2 },
    },
    {
        id: 'ningqi_jue_attr',
        name: '凝炁诀',
        description: '力道+1、根骨+1、身法+1、灵巧+1、洞察+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1 },
    },
    {
        id: 'sekai_heroism_attr',
        name: '舍得心法',
        description: '根骨-2、力道+2、身法+2、灵巧+2、洞察+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { vitality: -2, strength: 2, agility: 2, dexterity: 2, insight: 2 },
    },
    {
        id: 'yi_jin_jing_attr',
        name: '易筋经',
        description: '根骨+2、推演+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { vitality: 2, wisdom: 2 },
    },
    // ── 武器 ──
    {
        id: 'yanling_blade_attr',
        name: '翩若惊鸿',
        description: '身法+1、灵巧+2、力道+1。急速+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { agility: 1, dexterity: 2, strength: 1 },
        onHaste: () => 2,
    },
    {
        id: 'bare_hands_attr',
        name: '拳即是武器',
        description: '',
        tags: [],
        attrMods: { agility: 2 },
    },
    {
        id: 'dagger_attr',
        name: '轻便灵巧',
        description: '',
        tags: [],
        attrMods: { agility: 1 },
    },
    // ── 战斗期具名属性 buff ──
    {
        id: 'qiti_awaken_attr',
        name: '炁体源流·觉醒',
        description: '力道+2、根骨+2、身法+2、灵巧+2、洞察+2、推演+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 2, vitality: 2, agility: 2, dexterity: 2, insight: 2, wisdom: 2 },
    },
    {
        id: 'lingbo_step_dodge',
        name: '凌波微步',
        description: '闪避率+2%，持续3秒。',
        tags: [],
        expiry: { type: 'duration', ms: 3000 },
        onDodgeChance: () => 0.02,
    },
    {
        id: 'ju_chan_fa_yi_bonus',
        name: '内劲',
        description: '属性临时变化。',
        tags: [],
        expiry: { type: 'duration', ms: 6000 },
        stacking: { type: 'independent' },
        attrMods: { strength: 2, agility: 2, dexterity: 2, wisdom: 2 },
    },
    // ── 附着 buff：承载生效时刻行为（onActivate） ──
    {
        id: 'iaijutsu_ready_buff',
        name: '居合准备',
        description: '开局摆出居合架势（由居合道附着，触发一次居合准备招式）。',
        tags: [],
        expiry: { type: 'permanent' },
        // 纯内部标记：不在 buff 栏显示（开局那一下由 `_iaijutsu_ready` 招式自己播报），故保留 hidden
        hidden: true,
        // 物化成战斗层时触发一次「居合准备」——等价于旧的 `battle_start → actionId: _iaijutsu_ready` 触发槽
        onActivate: (ctx) => ctx.engine?.fireTriggerAction(ctx.target, '_iaijutsu_ready'),
    },
    // ── 构造期载体 buff：最大气血 ──
    {
        id: 'marrow_pump_hp',
        name: '骨髓泵',
        description: '骨髓泵持续刺激造血，最大气血+60。',
        tags: [],
        expiry: { type: 'permanent' },
        maxHpMod: 60,
    },
    // ── 构造期载体 buff：AP 上限（顶层 effects 附着，物化时写进战斗层账） ──
    {
        id: 'power_furnace_ap',
        name: '核炉蓄炁',
        description: '核动力炉输出炁态能量，内息上限+1。',
        tags: [],
        expiry: { type: 'permanent' },
        // 内部标记：数值由战斗层账（applyMaxApMod）静默应用，不播报、不进 buff 列表
        hidden: true,
        maxApMod: 1,
    },
    {
        id: 'fen_shen_qiu_ap',
        name: '分身占炁',
        description: '分身分摊内息，内息上限-1。',
        tags: [],
        expiry: { type: 'permanent' },
        hidden: true,
        maxApMod: -1,
    },
    {
        id: 'golden_light_ap',
        name: '金光凝炁',
        description: '金光护体，内息上限-1。',
        tags: [],
        expiry: { type: 'permanent' },
        hidden: true,
        maxApMod: -1,
    },
    // ── 构造期载体 buff：触发槽 ──
    {
        id: 'wisdom_talisman_slot',
        name: '开悟通明',
        description: '开悟通明，额外承载一道触发。',
        tags: [],
        expiry: { type: 'permanent' },
        triggerSlotMod: 1,
    },
    {
        id: 'sword_capture_slot',
        name: '空手入白刃',
        description: '空手入白刃，额外承载一道触发。',
        tags: [],
        expiry: { type: 'permanent' },
        triggerSlotMod: 1,
    },
    {
        id: 'combat_instinct_slot',
        name: '本能特训',
        description: '每5点洞察额外承载一道触发。',
        tags: [],
        expiry: { type: 'permanent' },
        triggerSlotModFn: (char) => Math.floor(char.attrs.get('insight') / 5),
    },
    // ── 构造期载体 buff：属性转化 ──
    {
        id: 'yu_yang_shi_ba_shi_convert',
        name: '渔阳十八势',
        description: '身法×0.3 转化为感知。',
        tags: [],
        expiry: { type: 'permanent' },
        attrConvert: [{ from: 'agility', to: ['insight'], ratio: 0.3 }],
    },
    {
        id: 'inner_power_convert',
        name: '归元化劲',
        description: '推演×0.1 转化为力道、根骨、身法、灵巧。',
        tags: [],
        expiry: { type: 'permanent' },
        attrConvert: [{ from: 'wisdom', to: ['strength', 'vitality', 'agility', 'dexterity'], ratio: 0.1 }],
    },
    {
        id: 'xuannv_sword_convert',
        name: '玄女剑法',
        description: '灵巧×0.3 转化为力道。',
        tags: [],
        expiry: { type: 'permanent' },
        attrConvert: [{ from: 'dexterity', to: ['strength'], ratio: 0.3 }],
    },
    {
        id: 'qian_chui_bai_lian_convert',
        name: '百炼化力',
        description: '根骨×0.25 转化为力道。',
        tags: [],
        expiry: { type: 'permanent' },
        attrConvert: [{ from: 'vitality', to: ['strength'], ratio: 0.25 }],
    },
    // ── 构造期载体 buff：武器标签 ──
    {
        id: 'dark_iron_sword_art_tag',
        name: '玄剑秘册',
        description: '以剑意施展手上功夫（武器视为空手）。',
        tags: [],
        expiry: { type: 'permanent' },
        weaponTags: ['unarmed'],
    },
    // ── 构造期载体 buff：增益时长倍率 ──
    {
        id: 'nei_xi_mian_chang_duration',
        name: '炁蕴绵长',
        description: '每点推演使自身增益时长+5%。',
        tags: [],
        expiry: { type: 'permanent' },
        buffDurationFn: (char) => 1 + char.attrs.get('wisdom') * 0.05,
    },
    // ── 构造期载体 buff：属性限制（注册后只拦后面的修正） ──
    {
        id: 'insight_guard',
        name: '洞察护持',
        description: '洞察被降低时效果减半。',
        tags: [],
        expiry: { type: 'permanent' },
        statRestriction: insightReductionHalfCheck(),
    },
    {
        id: 'pu_ti_tou_huan_guard',
        name: '菩提澄心',
        description: '50%抵抗推演降低。',
        tags: [],
        expiry: { type: 'permanent' },
        statRestriction: (_char, attr, _cur, delta) =>
            attr === 'wisdom' && delta < 0 && rng.chance(0.5) ? { skip: true } : null,
    },
    {
        id: 'ru_shen_zuo_zhao_guard',
        name: '神照圆满',
        description: '神照圆满后，洞察减益不能动摇心神。',
        tags: [],
        expiry: { type: 'permanent' },
        statRestriction: (char, attr, _cur, delta, _src, state) => {
            if (attr !== 'insight' || delta >= 0) return null
            const layer = state?.pendingBuffs.get(`shen_zhao::${char.id}`)
            if ((layer?.extra?.stage as number | undefined) === 3) return { skip: true }
            return null
        },
    },
    {
        id: 'ling_bo_wei_bu_guard',
        name: '身法护持',
        description: '身法不低于15。',
        tags: [],
        expiry: { type: 'permanent' },
        statRestriction: (_char, attr, current, delta) =>
            attr === 'agility' && delta < 0 && current + delta < 15 ? { delta: 15 - current } : null,
    },
    {
        id: 'yuanting_yuezhi_guard',
        name: '罡体护持',
        description: '力道、身法、灵巧无法被降低。',
        tags: [],
        expiry: { type: 'permanent' },
        statRestriction: (_char, attr, _cur, delta) => {
            if ((attr === 'strength' || attr === 'agility' || attr === 'dexterity') && delta < 0) return { skip: true }
            return null
        },
    },
]
