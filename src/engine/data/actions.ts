import type { ActionDefinition } from '../entities/action'
import type { Tag } from '../entities/tag'
import { QI_SKILLS } from './forging'

/**
 * MVP 招式清单
 * 每招机制唯一，不重复。
 */
export const MVP_ACTIONS: ActionDefinition[] = [
    // ── 拳掌系 ──
    {
        id: 'straight_punch',
        name: '正拳',
        description: '一记标准正拳，直取中门。',
        requiredTags: ['blunt'],
        apCost: 2,
        tags: [],
        effects: [{ type: 'damage', scaling: { strength: 0.4 } }],
    },
    {
        id: 'crushing_blow',
        name: '崩拳',
        description: '蓄力一击，造成崩劲伤害。',
        requiredTags: ['blunt'],
        apCost: 3,
        tags: ['cripple'],
        effects: [
            { type: 'damage', scaling: { strength: 0.5 } },
            { type: 'cripple', ratio: 0.1 },
        ],
    },
    {
        id: 'iron_charge',
        name: '铁山靠',
        description: '近距离冲撞，附带麻痹效果。',
        requiredTags: ['blunt'],
        apCost: 4,
        tags: ['paralyze', 'self_damage'],
        effects: [
            { type: 'damage', scaling: { strength: 0.4 } },
            { type: 'status', status: 'paralyze', stacks: 2, chance: 0.6 },
            { type: 'self_damage', ratio: 0.05 },
        ],
    },
    {
        id: 'flick',
        name: '弹指',
        description: '弹指间弹出气劲，带麻痹效果。',
        requiredTags: [],
        apCost: 1,
        tags: ['paralyze'],
        effects: [
            { type: 'fixed_damage', value: 1 },
            { type: 'status', status: 'paralyze', stacks: 1, chance: 0.3 },
        ],
    },

    // ── 暗器系 ──

    // ── 长枪系 ──
    {
        id: 'thrust',
        name: '刺击',
        description: '一往无前的直刺。',
        requiredTags: ['pierce'],
        apCost: 3,
        tags: ['bleed'],
        effects: [
            { type: 'damage', scaling: { strength: 0.6 } },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.5 },
        ],
    },
    {
        id: 'fissure',
        name: '裂地击',
        description: '猛砸地面，造成冲击波。',
        requiredTags: ['blunt'],
        apCost: 5,
        tags: ['paralyze', 'ignore_parry'],
        effects: [
            { type: 'damage', scaling: { strength: 0.8 } },
            { type: 'status', status: 'paralyze', stacks: 2, chance: 0.6 },
            { type: 'ignore_parry' },
        ],
    },

    // ── 暗器系 ──
    {
        id: 'needle',
        name: '飞针',
        description: '三枚飞针破空而去。',
        requiredTags: ['pierce'],
        apCost: 2,
        tags: ['paralyze'],
        effects: [
            { type: 'damage', scaling: { dexterity: 0.25 } },
            { type: 'status', status: 'paralyze', stacks: 1, chance: 0.3 },
        ],
    },
    {
        id: 'poison_dart',
        name: '毒镖',
        description: '淬毒飞镖，见血封喉。',
        requiredTags: ['pierce'],
        apCost: 3,
        tags: ['poison'],
        effects: [
            { type: 'damage', scaling: { dexterity: 0.3 } },
            { type: 'status', status: 'poison', stacks: 1, chance: 0.4 },
        ],
    },
    {
        id: 'tempest',
        name: '暴雨梨花',
        description: '一瞬间射出数十枚暗器。',
        requiredTags: ['pierce'],
        apCost: 5,
        tags: ['fixed_damage', 'poison', 'paralyze', 'bleed'],
        effects: [
            { type: 'fixed_damage', value: 8 },
            { type: 'status', status: 'poison', stacks: 1, chance: 0.3 },
            { type: 'status', status: 'paralyze', stacks: 1, chance: 0.3 },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.3 },
        ],
        maxUses: 2,
    },

    // ── 新增招式 ──
    {
        id: 'tremor_stomp',
        name: '震脚',
        description: '猛踏地面，震晕对手。',
        requiredTags: [],
        apCost: 3,
        tags: ['stun'],
        effects: [
            { type: 'damage', scaling: { strength: 0.4 } },
            { type: 'status', status: 'stun', stacks: 1, chance: 1.0 },
        ],
    },
    {
        id: 'break_formation',
        name: '破军',
        description: '一往无前，破除一切负面效果。',
        requiredTags: [],
        apCost: 2,
        tags: ['cleanse'],
        effects: [{ type: 'cleanse' }],
        maxUses: 1,
    },
    {
        id: 'pursuit_thrust',
        name: '追刺',
        description: '趁虚而入，追击刺击。',
        requiredTags: ['pierce'],
        apCost: 1,
        tags: ['bleed'],
        effects: [
            { type: 'damage', scaling: { strength: 0.3 } },
            { type: 'status', status: 'bleed', stacks: 1, chance: 0.6 },
        ],
    },

    {
        id: 'jab',
        name: '刺拳',
        description: '一记快速刺拳，消耗极低。',
        requiredTags: ['blunt'],
        apCost: 1,
        tags: [],
        effects: [{ type: 'damage', scaling: { strength: 0.2 } }],
    },

    {
        id: 'cun_mang',
        name: '寸芒',
        description: '一寸剑芒，顺势反击。',
        requiredTags: ['pierce'],
        apCost: 1,
        tags: ['counter'],
        effects: [{ type: 'damage', scaling: { agility: 0.15 } }],
    },

    {
        id: 'nine_deaths_strike',
        name: '九死不悔',
        description: '虽九死而不悔，以身为剑，不避锋芒。',
        requiredTags: ['pierce', 'imperial'],
        apCost: 4,
        tags: ['counter'],
        effects: [{ type: 'damage', scaling: { strength: 0.4, agility: 0.4 } }],
    },

    {
        id: 'orb_shot',
        name: '法珠',
        description: '',
        requiredTags: [],
        apCost: 1,
        tags: [],
        effects: [{ type: 'fixed_damage', value: 3 }],
        extraPreDelay: 300,
        extraStunTime: 800,
    },
    {
        id: 'summon_haste',
        name: '御物加速',
        description: '召唤物加速 100ms。',
        requiredTags: ['imperial'],
        apCost: 0,
        tags: ['trigger'],
        target: 'self',
        effects: [{ type: 'summon_speed', value: 100 }],
        maxUses: 999,
    },
    {
        id: '_lingbo_insight_step',
        name: '凌波微步',
        description: '',
        requiredTags: [],
        apCost: 0,
        tags: ['trigger', 'buff'],
        target: 'self',
        maxUses: 999,
        effects: [{ type: 'stat_buff', attrs: { insight: 1 }, durationMs: 3000 }],
    },
    {
        id: 'agility_steal',
        name: '汲灵',
        description: '命中时 30% 吸取身法 1 点，持续 2 秒。',
        requiredTags: [],
        apCost: 0,
        tags: [],
        chance: 0.3,
        effects: [{ type: 'stat_transfer', stat: 'agility', value: 1, duration: 2000 }],
        maxUses: 999,
    },
]

/** 辅招 */
export const BONUS_ACTIONS: ActionDefinition[] = []

/** 触发器招式（被动/天赋专用，不直接装备） */
export const TRIGGER_ACTIONS: ActionDefinition[] = [
    {
        id: '_sangui_heal',
        name: '三分归元',
        description: '',
        requiredTags: [],
        apCost: 0,
        tags: ['trigger', 'heal'],
        target: 'self',
        maxUses: 1,
        effects: [
            { type: 'heal', value: 3, ratio: 0.33 },
            { type: 'stat_buff', attrs: { strength: -2, vitality: -2, agility: -2, dexterity: -2 } },
        ],
    },
    {
        id: '_buer_init',
        name: '不二',
        description: '青山双剑起手式，暴击率大增但身法略滞。',
        requiredTags: ['imperial'],
        apCost: 0,
        tags: ['buff', 'trigger'],
        target: 'self',
        maxUses: 1,
        effects: [
            { type: 'crit_chance', value: 0.5 },
            { type: 'dodge_mod', value: -0.2 },
        ],
    },
    {
        id: '_fusi_crit_stack',
        name: '弗思',
        description: '闪避后本能蓄势，提升暴击率。',
        requiredTags: ['imperial'],
        apCost: 0,
        tags: ['buff', 'trigger'],
        target: 'self',
        effects: [{ type: 'crit_chance', value: 0.08 }],
    },
    {
        id: '_fusi_reset',
        name: '弗思·破',
        description: '暴击后蓄势消散。',
        requiredTags: ['imperial'],
        apCost: 0,
        tags: ['trigger'],
        target: 'self',
        effects: [{ type: 'crit_chance', value: 0, reset: true }],
    },
    {
        id: '_blood_thorn_bleed',
        name: '血棘',
        description: '暴击引发流血。',
        requiredTags: [],
        apCost: 0,
        tags: ['trigger'],
        target: 'enemy',
        effects: [{ type: 'status', status: 'bleed', stacks: 1, chance: 1 }],
    },
    {
        id: '_innate_seed_start',
        name: '道种萌发',
        description: '',
        requiredTags: [],
        apCost: 0,
        tags: ['trigger'],
        target: 'self',
        maxUses: 1,
    },
]

/** 合并所有招式（含辅招、炁技） */
const ALL_ACTIONS = [...MVP_ACTIONS, ...BONUS_ACTIONS, ...QI_SKILLS, ...TRIGGER_ACTIONS]

/** 按 ID 查找 */
export function getAction(id: string): ActionDefinition | undefined {
    return ALL_ACTIONS.find((a) => a.id === id)
}

/** 按武器标签过滤（空数组招式 = 任意武器可用） */
export function getActionsByWeapon(weaponTags: Tag[]): ActionDefinition[] {
    return ALL_ACTIONS.filter((a) => {
        if (a.requiredTags.length === 0) return true
        return a.requiredTags.some((tag) => weaponTags.includes(tag))
    })
}
