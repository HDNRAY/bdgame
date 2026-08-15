import type { EventDef } from '../../game/entities/event'
import { OPPONENTS } from '../../data/opponents/index'

/** 所有可作通用 Boss 的对手 id（未指定时随机）。 */
export const ALL_OPPONENT_IDS = OPPONENTS.map((o) => o.id)

// ════════════════════════════════════════
//  选背景故事（n1）
//  出身选项由引擎随机抽 3 条故事线生成；选项 effects 激活故事 flag + 给开局奖励。
// ════════════════════════════════════════

export const PICK_STORY: EventDef = {
    id: 'pick_story',
    name: '你从哪里来',
    description: '在开始之前，先说说你的来历。',
    placement: [{ nodes: [1] }],
    rounds: [
        {
            id: 'pick',
            title: '你从哪里来',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  默认 Boss 战（故事未覆盖时使用；未指定敌人 → 随机挑一个对手）
// ════════════════════════════════════════

export const BOSS_PHASE1: EventDef = {
    id: 'boss_phase1',
    name: '首领战·一',
    description: '你面对第一个强大的对手。',
    placement: [{ nodes: [11], fallback: true }],
    reward: { kind: 'item', pool: 'action' },
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
            enemyPool: ALL_OPPONENT_IDS,
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
    placement: [{ nodes: [22], fallback: true }],
    reward: { kind: 'points' },
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
            enemyPool: ALL_OPPONENT_IDS,
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
    reward: { kind: 'points' },
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
            enemyPool: ALL_OPPONENT_IDS,
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '战利品',
            choices: [],
        },
    ],
}
