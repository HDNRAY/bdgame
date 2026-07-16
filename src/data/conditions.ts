import type { RequiredCondition } from '../game/entities/action-config'

/** 预定义必要条件预设 */
export const CONDITION_PRESETS = [
    { id: 'always', name: '始终可用', build: (): RequiredCondition => ({ type: 'always' }) },
    { id: 'hp_below_50', name: 'HP<50%', build: (): RequiredCondition => ({ type: 'hp_below', ratio: 0.5 }) },
    { id: 'hp_above_50', name: 'HP>50%', build: (): RequiredCondition => ({ type: 'hp_above', ratio: 0.5 }) },
    { id: 'hp_above_70', name: 'HP>70%', build: (): RequiredCondition => ({ type: 'hp_above', ratio: 0.7 }) },
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
        id: 'distance_gt_2',
        name: '距离>2m',
        build: (): RequiredCondition => ({ type: 'distance_greater_than', meters: 2 }),
    },
    {
        id: 'distance_lt_2',
        name: '距离<2m',
        build: (): RequiredCondition => ({ type: 'distance_less_than', meters: 2 }),
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
        id: 'distance_gt_4',
        name: '距离>4m',
        build: (): RequiredCondition => ({ type: 'distance_greater_than', meters: 4 }),
    },
    {
        id: 'distance_lt_4',
        name: '距离<4m',
        build: (): RequiredCondition => ({ type: 'distance_less_than', meters: 4 }),
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
    {
        id: 'enemy_no_stun_track',
        name: '目标无眩晕递减',
        build: (): RequiredCondition => ({ type: 'enemy_buff_not_active', buffId: 'stun_track' }),
    },
    {
        id: 'no_stance',
        name: '无架势',
        build: (): RequiredCondition => ({ type: 'no_buff_with_tag', tag: 'stance' }),
    },
    {
        id: 'enemy_no_shixin',
        name: '目标无失心',
        build: (): RequiredCondition => ({ type: 'debuff_not_active', buffId: 'fumble_chance_temp' }),
    },
] as const

/** 按 ID 查找条件预设 */
export function getConditionPreset(id: string): RequiredCondition | undefined {
    return CONDITION_PRESETS.find((p) => p.id === id)?.build()
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
        case 'enemy_buff_not_active':
            return `目标无 [${c.buffId}]`
        case 'no_buff_with_tag':
            return `无 [${c.tag}] buff`
    }
}
