import type { ActionDefinition } from '../../entities/action'
import { MAX_CHAN } from '../../constants'

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
        tags: ['buff', 'defense', 'support'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'guard_up' }],
    },
    {
        id: 'break_formation',
        name: '破军',
        description: '一往无前，破除一切负面效果。',
        requiredTags: [],
        apCost: 2,
        tags: ['cleanse', 'support'],
        effects: [{ type: 'cleanse' }],
        maxUses: 1,
    },
    {
        id: 'big_leap',
        name: '虎跃',
        description: '猛虎跃涧，瞬间近身。范围3~8m。需力道≥10。',
        requiredTags: [],
        apCost: 3,
        tags: ['move', 'support'],
        getRange: () => [3, 10] as [number, number],
        canUse: (attacker) => attacker.attrs.get('strength') >= 10,
        effects: [{ type: 'dash', minRange: 3, maxRange: 8, targetDist: 1 }],
    },
    {
        id: 'retrieve_blade',
        name: '拾刀',
        description: '重握霸刀，恢复刀态。',
        requiredTags: [],
        apCost: 0,
        tags: ['support', 'retrieve_weapon'],
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
        tags: ['support', 'retrieve_weapon'],
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
        id: 'foresight',
        name: '看破',
        description: '凝神静气，洞察先机。',
        requiredTags: [],
        apCost: 3,
        tags: ['buff', 'support'],
        target: 'self',
        effects: [{ type: 'add_buff', buffId: 'foresight' }],
    },
    {
        id: 'resheath',
        name: '纳刀',
        description: '收刀入鞘，重归居合。',
        requiredTags: ['slash'],
        apCost: 1,
        tags: ['buff', 'support'],
        target: 'self',
        canUse: (attacker, state) => !state.pendingBuffs.has('iaijutsu::' + attacker.id),
        effects: [{ type: 'add_buff', buffId: 'iaijutsu' }],
    },
    {
        id: '_lingbo_insight_step',
        name: '凌波微步',
        description: '',
        requiredTags: [],
        apCost: 0,
        tags: ['trigger', 'buff', 'support'],
        target: 'self',
        maxUses: 999,
        effects: [{ type: 'stat_buff', attrs: { dodgeChance: 0.02 }, durationMs: 3000 }],
    },
    {
        id: 'lightning_speed',
        name: '电光石火',
        description: '电光石火，瞬息即至。',
        requiredTags: [],
        apCost: 1,
        tags: ['move', 'support'],
        effects: [{ type: 'short_dash', maxDistance: 4 }],
    },
    {
        id: 'jindou',
        name: '筋斗',
        description: '一个筋斗翻腾而出，瞬间近身。范围1~8m。需身法≥10。',
        requiredTags: [],
        apCost: 2,
        tags: ['move', 'support'],
        getRange: () => [1, 8] as [number, number],
        canUse: (attacker) => attacker.attrs.get('agility') >= 10,
        effects: [{ type: 'dash', minRange: 1, maxRange: 8, targetDist: 1 }],
    },
    {
        id: 'santou_liubi',
        name: '三头六臂',
        description: `消耗${MAX_CHAN}层缠劲，进入三头六臂状态：后续3个回合结束时AP回满。`,
        requiredTags: [],
        apCost: 3,
        tags: ['buff', 'support'],
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
        tags: ['buff', 'support'],
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
        tags: ['support'],
        target: 'enemy',
        getRange: () => [0, 6] as [number, number],
        effects: [{ type: 'steal_artifact' }],
    },
    {
        id: 'yan_hui',
        name: '雁迴',
        description: '如雁迴旋，瞬移至对手身后。',
        requiredTags: [],
        apCost: 0,
        tags: ['move', 'support'],
        getRange: () => [0, 12] as [number, number],
        effects: [{ type: 'dash', maxRange: 12, targetDist: 0, useAp: true }],
    },
    {
        id: 'yan_fan',
        name: '雁反',
        description: '如雁反转，瞬移拉开距离。',
        requiredTags: [],
        apCost: 0,
        tags: ['move', 'support'],
        getRange: () => [0, 12] as [number, number],
        effects: [{ type: 'dash', maxRange: 12, targetDist: -1, useAp: true }],
    },
]
