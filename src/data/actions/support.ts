import type { ActionDefinition } from '../../engine/entities/action'
import { MAX_CHAN } from '../../engine/constants'

/**
 * 辅助招式（非战斗直接伤害，含 buff / 位移 / 缴械回复 / 净化等）。
 * 与 PLAYER_ACTIONS 分开维护，奖励池中同样可出。
 */
export const SUPPORT_ACTIONS: ActionDefinition[] = [
    // ── 防御/增益 ──
    {
        id: 'guard',
        name: '听潮',
        description: '凝神防守，提升招架率。',
        requiredTags: ['parry'],
        apCost: 2,
        tags: ['buff', 'defense', 'pre_action'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'guard_up' }],
    },
    {
        id: 'break_formation',
        name: '净化',
        description: '破除一切负面效果，恢复自身状态。',
        requiredTags: [],
        apCost: 2,
        tags: ['cleanse', 'pre_action'],
        effects: [{ type: 'cleanse' }],
        maxUses: 1,
    },
    // ── 位移 ──
    {
        id: 'swift_step',
        name: '魅影步',
        description: '魅影乱步，身随心动。',
        requiredTags: [],
        apCost: 0,
        tags: ['move', 'pre_action'],
        effects: [
            { type: 'dash', maxRange: 3, targetDist: 0, useAp: true },
            // { type: 'short_dash', maxDistance: 2 },
            { type: 'add_buff', buffId: 'phantom_step' },
        ],
    },
    {
        id: 'big_leap',
        name: '虎跃',
        description: '猛虎跃涧，瞬间近身。范围2~8m。需力道≥10。',
        requiredTags: [],
        apCost: 3,
        tags: ['move', 'pre_action'],
        getRange: () => [2, 8] as [number, number],
        canUse: (attacker) => attacker.attrs.get('strength') >= 10,
        effects: [{ type: 'dash', minRange: 2, maxRange: 8, targetDist: 1 }],
    },
    {
        id: 'lightning_speed',
        name: '电光石火',
        description: '电光石火，瞬息即至。',
        requiredTags: [],
        apCost: 1,
        tags: ['move', 'pre_action'],
        effects: [{ type: 'dash', maxRange: 4, targetDist: 0 }],
    },
    {
        id: 'jindou',
        name: '筋斗',
        description: '一个筋斗翻腾而出，瞬间近身。范围1~8m。需身法≥10。',
        requiredTags: [],
        apCost: 2,
        tags: ['move', 'pre_action'],
        getRange: () => [1, 8] as [number, number],
        canUse: (attacker) => attacker.attrs.get('agility') >= 10,
        effects: [{ type: 'dash', minRange: 1, maxRange: 8, targetDist: 1 }],
    },
    {
        id: 'yan_hui',
        name: '雁迴',
        description: '如雁迴旋，瞬移至对手身后。',
        requiredTags: [],
        apCost: 0,
        tags: ['move', 'pre_action'],
        getRange: () => [0, 12] as [number, number],
        effects: [{ type: 'dash', maxRange: 12, targetDist: 0, useAp: true }],
    },
    {
        id: 'yan_fan',
        name: '雁反',
        description: '如雁反转，瞬移拉开距离。',
        requiredTags: [],
        apCost: 0,
        tags: ['move', 'pre_action'],
        getRange: () => [0, 12] as [number, number],
        effects: [{ type: 'dash', maxRange: 12, targetDist: -1, useAp: true }],
    },
    // ── 缴械/收回武器 ──
    {
        id: 'retrieve_blade',
        name: '拾刀',
        description: '重握霸刀，恢复刀态。',
        requiredTags: [],
        apCost: 0,
        tags: ['pre_action', 'retrieve_weapon'],
        target: 'self',
        canUse: (attacker, state) => !state.pendingBuffs.has('overlord_blade::' + attacker.id),
        effects: [{ type: 'short_dash', maxDistance: 2 }, { type: 'retrieve_weapon' }],
    },
    {
        id: 'pickup_weapon',
        name: '拾起兵器',
        description: '捡回脱手的武器。',
        requiredTags: [],
        apCost: 0,
        tags: ['pre_action', 'retrieve_weapon'],
        target: 'self',
        canUse: (attacker, state) => {
            const key = `disarmed::${attacker.id}`
            const layer = state.pendingBuffs.get(key)
            if (!layer) return false
            const dropPos = layer.extra?.dropPosition as number | undefined
            if (dropPos === undefined) return true
            return Math.abs(state.position.get(attacker.id) - dropPos) <= 1
        },
        effects: [{ type: 'retrieve_weapon' }],
    },
    {
        id: 'santou_liubi',
        name: '三头六臂',
        description: `消耗${MAX_CHAN}层缠劲，进入三头六臂状态：后续3个回合结束时AP回满。`,
        requiredTags: [],
        apCost: 3,
        tags: ['buff', 'pre_action'],
        target: 'self',
        chanCost: MAX_CHAN,
        canUse: (attacker) => attacker.chan >= MAX_CHAN,
        effects: [{ type: 'add_buff', buffId: 'santou_liubi', stacks: 2 }],
    },
    {
        id: 'nineteen_stops',
        name: '十九停',
        description: '停一息，蓄势一分。每层命中+3%、暴击+2%、暴伤+1%，但层数越高越易失手。',
        requiredTags: [],
        apCost: 1,
        tags: ['buff', 'pre_action'],
        effects: [{ type: 'add_buff', buffId: 'nineteen_stops', stacks: 1 }],
        maxUses: 19,
        canUse: (attacker, state) => {
            const key = `nineteen_stops::${attacker.id}`
            const layer = state.pendingBuffs.get(key)
            const stacks = layer?.restoreValue ?? 0
            return Math.random() >= (stacks / 19) ** 2 * 0.95
        },
    },
    {
        id: 'steal_artifact',
        name: '飞龙探云手',
        description: '神偷绝技，偷取对手一件奇物。初始80%成功，成功后概率减半。',
        requiredTags: [],
        apCost: 2,
        tags: ['pre_action'],
        target: 'enemy',
        getRange: () => [0, 6] as [number, number],
        effects: [{ type: 'steal_artifact' }],
    },
    {
        id: 'sand_throw',
        name: '抛沙',
        description: '扬沙迷眼，中距离干扰。',
        requiredTags: [],
        apCost: 1,
        tags: ['debuff', 'pre_action'],
        getRange: () => [1, 3] as [number, number],
        canUse: (attacker, state) => {
            const enemy = state.characters.find((c) => c.id !== attacker.id)
            return !enemy || !state.pendingBuffs.has(`sand_blind::${enemy.id}`)
        },
        effects: [{ type: 'add_debuff', buffId: 'sand_blind', stacks: 2, chance: 1 }],
    },
    {
        id: 'spirit_sword',
        name: '灵剑',
        description: '凝炁为刃，剑气可化鞭化枪。',
        requiredTags: [],
        apCost: 0,
        tags: ['buff', 'pre_action', 'qi'],
        target: 'self',
        canUse: (_attacker, state) => !state.pendingBuffs.has('ciyuan_blade::' + _attacker.id),
        effects: [{ type: 'ciyuan_init' }, { type: 'add_buff', buffId: 'ciyuan_blade' }],
    },
    // ── 御物系 ──
    {
        id: 'summon_haste',
        name: '御物加速',
        description: '召唤物加速 100ms。',
        requiredTags: ['summon'],
        apCost: 0,
        tags: ['imperial', 'summon', 'pre_action'],
        target: 'self',
        effects: [{ type: 'summon_speed', value: 100 }],
    },
    {
        id: 'condense_shield',
        name: '凝炁成盾',
        description: '凝聚炁息化为护盾，2层炁盾护体。',
        requiredTags: [],
        apCost: 2,
        tags: ['imperial', 'qi', 'post_action', 'defense'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'qi_shield', stacks: 2 }],
    },
    {
        id: 'agility_steal',
        name: '汲灵',
        description: '命中时 30% 吸取身法 1 点，持续 3 秒。',
        requiredTags: ['summon'],
        apCost: 0,
        tags: ['imperial', 'summon', 'pre_action'],
        onActionHitChance: () => 0.3,
        effects: [{ type: 'stat_transfer', stat: 'agility', value: 1, duration: 3000 }],
    },
    {
        id: 'ling_qi_guan_zhu',
        name: '灵炁灌注',
        description: '将大量炁劲注入御物，下个招式伤害+30%。不可叠加。',
        requiredTags: ['imperial'],
        apCost: 4,
        tags: ['buff', 'pre_action', 'imperial'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'sword_enhance_buff' }],
    },
]
