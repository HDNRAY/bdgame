import type { EventDef } from '../../entities/event'

export const BRANCH_PASSIVE: EventDef = {
    id: 'branch_passive',
    name: '深山发现炼炁秘籍',
    description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
    rewardType: 'passive',
    rounds: [
        {
            id: 'discover',
            type: 'narrative',
            title: '奇遇',
            description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
            choices: [{ id: 'reward', type: 'continue', label: '参悟秘籍' }],
        },
        {
            id: 'reward',
            type: 'reward',
            title: '参悟',
            choices: [],
        },
    ],
}

export const BRANCH_ACTION: EventDef = {
    id: 'branch_action',
    name: '在家打磨套路',
    description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
    rewardType: 'action',
    rounds: [
        {
            id: 'practice',
            type: 'narrative',
            title: '打磨',
            description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打磨' }],
        },
        {
            id: 'reward',
            type: 'reward',
            title: '新招',
            choices: [],
        },
    ],
}

export const BRANCH_ARTIFACT: EventDef = {
    id: 'branch_artifact',
    name: '做任务获得奖励',
    description: '你完成了一项委托，雇主给予了丰厚的报酬。',
    rewardType: 'artifact',
    rounds: [
        {
            id: 'quest',
            type: 'narrative',
            title: '任务完成',
            description: '你完成了一项委托，雇主给予了丰厚的报酬。',
            choices: [{ id: 'reward', type: 'continue', label: '领取报酬' }],
        },
        {
            id: 'reward',
            type: 'reward',
            title: '报酬',
            choices: [],
        },
    ],
}

export const BRANCH_POINTS: EventDef = {
    id: 'branch_points',
    name: '瀑布打坐',
    description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
    rewardType: 'points',
    rounds: [
        {
            id: 'meditate',
            type: 'narrative',
            title: '打坐',
            description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打坐' }],
        },
        {
            id: 'reward',
            type: 'reward',
            title: '感悟',
            choices: [],
        },
    ],
}

export const BRANCH_HEAL: EventDef = {
    id: 'branch_heal',
    name: '去医馆治疗',
    description: '你前往镇上医馆，请老医师为你调理伤势。',
    rewardType: 'heal',
    rounds: [
        {
            id: 'clinic',
            type: 'narrative',
            title: '医馆',
            description: '你前往镇上医馆，请老医师为你调理伤势。',
            choices: [{ id: 'reward', type: 'continue', label: '接受治疗' }],
        },
        {
            id: 'reward',
            type: 'reward',
            title: '疗伤',
            choices: [],
        },
    ],
}

export const BRANCH_EVENTS: EventDef[] = [BRANCH_PASSIVE, BRANCH_ACTION, BRANCH_ARTIFACT, BRANCH_POINTS, BRANCH_HEAL]
