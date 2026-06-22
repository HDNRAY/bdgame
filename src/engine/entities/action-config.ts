import type { BattleState } from '../combat/types'
import type { Character } from './character'

/**
 * 招式的必要条件 — AI 在选择该招式前必须满足的条件
 * 所有条件类型都返回 true/false
 */
export type RequiredCondition =
    | { type: 'always' }
    | { type: 'debuff_not_active'; buffId: string }
    | { type: 'buff_not_active'; buffId: string }
    | { type: 'buff_stacks_below'; buffId: string; maxStacks: number }
    | { type: 'buff_stacks_above'; buffId: string; minStacks: number }
    | { type: 'hp_below'; ratio: number }
    | { type: 'hp_above'; ratio: number }
    | { type: 'distance_less_than'; meters: number }
    | { type: 'distance_greater_than'; meters: number }
    | { type: 'enemy_hp_below'; ratio: number }
    | { type: 'enemy_hp_above'; ratio: number }

/** 招式配置条目 */
export interface ActionConfig {
    actionId: string
    /** 必要条件 ID（查 CONDITION_PRESETS），缺省 = always */
    conditionId?: string
    /** 触发条件 ID（查 TRIGGER_CONDITIONS） */
    triggerId?: string
}

/** 预定义必要条件预设 */
export const CONDITION_PRESETS = [
    { id: 'always', name: '始终可用', build: (): RequiredCondition => ({ type: 'always' }) },
    { id: 'hp_below_50', name: '自身HP<50%', build: (): RequiredCondition => ({ type: 'hp_below', ratio: 0.5 }) },
    { id: 'hp_above_50', name: '自身HP>50%', build: (): RequiredCondition => ({ type: 'hp_above', ratio: 0.5 }) },
    {
        id: 'enemy_hp_below_50',
        name: '目标HP<50%',
        build: (): RequiredCondition => ({ type: 'enemy_hp_below', ratio: 0.5 }),
    },
    {
        id: 'enemy_hp_above_50',
        name: '目标HP>50%',
        build: (): RequiredCondition => ({ type: 'enemy_hp_above', ratio: 0.5 }),
    },
    {
        id: 'distance_gt_3',
        name: '距离>3m',
        build: (): RequiredCondition => ({ type: 'distance_greater_than', meters: 3 }),
    },
    {
        id: 'distance_lt_3',
        name: '距离<3m',
        build: (): RequiredCondition => ({ type: 'distance_less_than', meters: 3 }),
    },
    {
        id: 'distance_gt_5',
        name: '距离>5m',
        build: (): RequiredCondition => ({ type: 'distance_greater_than', meters: 5 }),
    },
    {
        id: 'distance_lt_5',
        name: '距离<5m',
        build: (): RequiredCondition => ({ type: 'distance_less_than', meters: 5 }),
    },
] as const

/** 按 ID 查找条件预设 */
export function getConditionPreset(id: string): RequiredCondition | undefined {
    return CONDITION_PRESETS.find((p) => p.id === id)?.build()
}

/** 必要条件的中文名 */
export const CONDITION_CN: Record<string, string> = {
    always: '始终可用',
    debuff_not_active: '目标无减益',
    buff_not_active: '自身无增益',
    buff_stacks_below: '增益未叠满',
    buff_stacks_above: '增益达到层数',
    hp_below: '自身血量低于',
    hp_above: '自身血量高于',
    distance_less_than: '距离小于',
    distance_greater_than: '距离大于',
    enemy_hp_below: '目标血量低于',
    enemy_hp_above: '目标血量高于',
}

/** 必要条件显示描述（含参数） */
export function describeCondition(c: RequiredCondition): string {
    switch (c.type) {
        case 'always':
            return '始终可用'
        case 'debuff_not_active':
            return `目标无 [${c.buffId}]`
        case 'buff_not_active':
            return `自身无 [${c.buffId}]`
        case 'buff_stacks_below':
            return `[${c.buffId}] < ${c.maxStacks}层`
        case 'buff_stacks_above':
            return `[${c.buffId}] ≥ ${c.minStacks}层`
        case 'hp_below':
            return `HP < ${Math.round(c.ratio * 100)}%`
        case 'hp_above':
            return `HP > ${Math.round(c.ratio * 100)}%`
        case 'distance_less_than':
            return `距离 < ${c.meters}m`
        case 'distance_greater_than':
            return `距离 > ${c.meters}m`
        case 'enemy_hp_below':
            return `目标 HP < ${Math.round(c.ratio * 100)}%`
        case 'enemy_hp_above':
            return `目标 HP > ${Math.round(c.ratio * 100)}%`
    }
}

/** 检查必要条件是否满足 */
export function checkCondition(cond: RequiredCondition, self: Character, state: BattleState): boolean {
    const enemy = state.characters.find((c) => c.id !== self.id)
    switch (cond.type) {
        case 'always':
            return true
        case 'debuff_not_active':
            return !state.pendingBuffs.has(`${cond.buffId}::${enemy?.id}`)
        case 'buff_not_active':
            return !state.pendingBuffs.has(`${cond.buffId}::${self.id}`)
        case 'buff_stacks_below': {
            const layer = state.pendingBuffs.get(`${cond.buffId}::${self.id}`)
            return !layer || layer.restoreValue < cond.maxStacks
        }
        case 'buff_stacks_above': {
            const layer = state.pendingBuffs.get(`${cond.buffId}::${self.id}`)
            return !!layer && layer.restoreValue >= cond.minStacks
        }
        case 'hp_below':
            return self.hp / self.maxHp < cond.ratio
        case 'hp_above':
            return self.hp / self.maxHp > cond.ratio
        case 'distance_less_than': {
            const d = enemy ? state.position.distance(self.id, enemy.id) : 0
            return d < cond.meters
        }
        case 'distance_greater_than': {
            const d = enemy ? state.position.distance(self.id, enemy.id) : 0
            return d > cond.meters
        }
        case 'enemy_hp_below':
            return enemy ? enemy.hp / enemy.maxHp < cond.ratio : false
        case 'enemy_hp_above':
            return enemy ? enemy.hp / enemy.maxHp > cond.ratio : false
    }
}
