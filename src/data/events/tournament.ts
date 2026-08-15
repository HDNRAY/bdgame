// ════════════════════════════════════════
//  斗炁大会 — 通用事件定义（工厂函数）
//  所有事件的 enemyId 由 processTournament 动态设置。
//  小组赛（n23/26/27/28）给奖励；淘汰赛 + 决赛（n29/30/31/33）无奖励。
// ════════════════════════════════════════

import type { EventDef } from '../../game/entities/event'
import type { Round } from '../../game/entities/round'
import { END_EVENT } from '../../game/entities/round'

/** 斗炁大会事件 ID 列表 */
export const TOURNAMENT_EVENT_IDS = [
    'tournament_open',
    'tournament_group_r1',
    'tournament_group_r2',
    'tournament_group_r3',
    'tournament_knockout_16',
    'tournament_knockout_8',
    'tournament_knockout_4',
    'tournament_final',
] as const

type TournamentEventId = (typeof TOURNAMENT_EVENT_IDS)[number]

interface TournamentEventMeta {
    title: string
    description: string
    /** 放置节点（1-based） */
    nodes: number[]
    /** 淘汰赛/决赛：无奖励（生死局没有战利品） */
    noReward: boolean
}

const EVENT_META: Record<TournamentEventId, TournamentEventMeta> = {
    tournament_open: {
        title: '斗炁大会开幕',
        description: '群雄齐聚，会场人声鼎沸。你握紧兵器，走入赛场。三十二名高手，只有一个能站到最后。',
        nodes: [23],
        noReward: false,
    },
    tournament_group_r1: {
        title: '小组赛·第一轮',
        description: '小组赛第一场。你的对手已经站在擂台上了。',
        nodes: [26],
        noReward: false,
    },
    tournament_group_r2: {
        title: '小组赛·第二轮',
        description: '小组赛第二场。连胜还是背水一战，全看这一局。',
        nodes: [27],
        noReward: false,
    },
    tournament_group_r3: {
        title: '小组赛收官',
        description: '小组赛最后一场打完，出线名单已定。你在名单上找到了自己的名字——下一场，就是淘汰赛。',
        nodes: [28],
        noReward: false,
    },
    tournament_knockout_16: {
        title: '十六强赛',
        description: '淘汰赛开始。一场定胜负，没有回头路。',
        nodes: [29],
        noReward: true,
    },
    tournament_knockout_8: {
        title: '八强赛',
        description: '只剩下八个人了。每一场都是硬仗。',
        nodes: [30],
        noReward: true,
    },
    tournament_knockout_4: {
        title: '半决赛',
        description: '四强争锋。再赢两场，就是冠军。',
        nodes: [31],
        noReward: true,
    },
    tournament_final: {
        title: '决赛',
        description: '最终决战。擂台上，你的对手已经就位。这一战，决定谁是这一届斗炁大会的冠军。',
        nodes: [33],
        noReward: true,
    },
}

/** 生成一个斗炁大会事件 */
function makeTournamentEvent(id: TournamentEventId): EventDef {
    const meta = EVENT_META[id]
    const rounds: Round[] = [
        {
            id: 'match',
            title: meta.title,
            description: meta.description,
            choices: meta.noReward
                ? [{ id: END_EVENT, type: 'continue' as const, label: '踏入擂台' }]
                : [{ id: 'reward_round', type: 'continue' as const, label: '踏入擂台' }],
        },
    ]
    if (!meta.noReward) {
        rounds.push({ id: 'reward_round', title: '战利品', description: '大战之后，你有所收获。', choices: [] })
    }
    return {
        id,
        name: meta.title,
        description: meta.description,
        placement: [{ nodes: meta.nodes }],
        reward: meta.noReward ? { kind: 'none' } : { kind: 'points' },
        rounds,
    }
}

/** 所有斗炁大会事件 */
export const TOURNAMENT_EVENTS: EventDef[] = TOURNAMENT_EVENT_IDS.map(makeTournamentEvent)

/** 按 ID 索引 */
export const TOURNAMENT_EVENT_MAP: Record<string, EventDef> = {}
for (const ev of TOURNAMENT_EVENTS) {
    TOURNAMENT_EVENT_MAP[ev.id] = ev
}
