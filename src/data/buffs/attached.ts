import type { BuffDef } from './types'

/**
 * 属性类 buff：`stat_buff` 效果类型删除后的唯一属性加成载体。
 *
 * 分三组：
 *  1. 来源附着 buff：由来源顶层 `effects:[add_buff]` 挂上，`attrMods × stacks` 在构造期就折进
 *     来源层账。纯属性携带者（无钩子/时长/叠层等）**不建战斗层**，但会由 `getBuffsForDisplay`
 *     从账上补进战斗界面 buff 列表（属性来源另见 `attrBreakdown`）。
 *  2. 战斗期具名属性 buff：`_qiti_awaken` 的六维强化与凌波微步的闪避。
 *  3. 聚缠法衣吸收缠劲换来的临时属性（independent 每层独立计时）。
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
        description: '体质+2、力道+1、身法+1。',
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
        description: '体质+5。',
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
        description: '力道+2、体质+2。',
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
        description: '力道+1、体质+1、身法+1、灵巧+1、洞察+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1 },
    },
    {
        id: 'sekai_heroism_attr',
        name: '舍得心法',
        description: '体质-2、力道+2、身法+2、灵巧+2、洞察+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { vitality: -2, strength: 2, agility: 2, dexterity: 2, insight: 2 },
    },
    {
        id: 'yi_jin_jing_attr',
        name: '易筋经',
        description: '体质+2、推演+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { vitality: 2, wisdom: 2 },
    },
    // ── 武器 ──
    {
        id: 'yanling_blade_attr',
        name: '惊鸿',
        description: '身法+1、灵巧+2、力道+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { agility: 1, dexterity: 2, strength: 1 },
    },
    {
        id: 'bare_hands_attr',
        name: '赤手空拳',
        description: '身法+2。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { agility: 2 },
    },
    {
        id: 'dagger_attr',
        name: '匕首',
        description: '身法+1。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { agility: 1 },
    },
    // ── 战斗期具名属性 buff ──
    {
        id: 'qiti_awaken_attr',
        name: '炁体源流·觉醒',
        description: '力道+2、体质+2、身法+2、灵巧+2、洞察+2、推演+2。',
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
]
