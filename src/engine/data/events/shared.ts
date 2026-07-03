import type { EventDef } from '../../entities/event'

// ════════════════════════════════════════
//  选背景故事
// ════════════════════════════════════════

export const PICK_STORY: EventDef = {
    id: 'pick_story',
    name: '选择出身',
    description: '选择一个你的出身背景。',
    rewardType: 'points',
    rounds: [
        {
            id: 'pick',
            title: '选择出身',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  默认 Boss 战（故事未覆盖时使用）
// ════════════════════════════════════════

export const BOSS_PHASE1: EventDef = {
    id: 'boss_phase1',
    name: '首领战·一',
    description: '你面对第一个强大的对手。',
    rewardType: 'action',
    rounds: [
        {
            id: 'intro',
            title: '第一关',
            description: '你面对第一个强大的对手。击败他，才能继续前进。',
            choices: [{ id: 'combat_round', type: 'continue', label: '迎战' }],
        },
        {
            id: 'combat_round',
            title: '死斗',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '战利品',
            choices: [],
        },
    ],
}

export const BOSS_PHASE2: EventDef = {
    id: 'boss_phase2',
    name: '守门人',
    description: '经过海选，你只需要战胜面前的最后一人，即可获得决赛32位的资格之一。',
    rewardType: 'points',
    rounds: [
        {
            id: 'intro',
            title: '守门人',
            description: '经过海选，你只需要战胜面前的最后一人，即可获得决赛32位的资格之一。',
            choices: [{ id: 'combat_round', type: 'continue', label: '迎战' }],
        },
        {
            id: 'combat_round',
            title: '资格赛',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '战利品',
            choices: [],
        },
    ],
}

export const BOSS_PHASE3: EventDef = {
    id: 'boss_phase3',
    name: '最终首领',
    description: '最终决战。',
    rewardType: 'points',
    rounds: [
        {
            id: 'intro',
            title: '最终战',
            description: '一切恩怨在此了结。你面对最终的对手。',
            choices: [{ id: 'combat_round', type: 'continue', label: '迎战' }],
        },
        {
            id: 'combat_round',
            title: '决战',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '战利品',
            choices: [],
        },
    ],
}
