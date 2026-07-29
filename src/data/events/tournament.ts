// ════════════════════════════════════════
//  斗炁大会 — 通用事件定义（工厂函数）
//  所有事件的 enemyId 由 processTournament 动态设 flags 提供。
// ════════════════════════════════════════

import type { EventDef } from '../../game/entities/event'

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
    rewardType: 'points' | 'heal'
}

const EVENT_META: Record<TournamentEventId, TournamentEventMeta> = {
    tournament_open: {
        title: '斗炁大会开幕',
        description: '群雄齐聚，会场人声鼎沸。你握紧兵器，走入赛场。三十二名高手，只有一个能站到最后。',
        rewardType: 'points',
    },
    tournament_group_r1: {
        title: '小组赛·第一轮',
        description: '小组赛第一场。你的对手已经站在擂台上了。',
        rewardType: 'points',
    },
    tournament_group_r2: {
        title: '小组赛·第二轮',
        description: '小组赛第二场。连胜还是背水一战，全看这一局。',
        rewardType: 'points',
    },
    tournament_group_r3: {
        title: '小组赛·第三轮',
        description: '小组赛最后一场。赢则出线在望，输则可能淘汰。',
        rewardType: 'points',
    },
    tournament_knockout_16: {
        title: '十六强赛',
        description: '淘汰赛开始。一场定胜负，没有回头路。',
        rewardType: 'points',
    },
    tournament_knockout_8: {
        title: '八强赛',
        description: '只剩下八个人了。每一场都是硬仗。',
        rewardType: 'points',
    },
    tournament_knockout_4: {
        title: '半决赛',
        description: '四强争锋。再赢两场，就是冠军。',
        rewardType: 'points',
    },
    tournament_final: {
        title: '决赛',
        description: '最终决战。擂台上，你的对手已经就位。这一战，决定谁是这一届斗炁大会的冠军。',
        rewardType: 'points',
    },
}

/** 生成一个斗炁大会事件 */
function makeTournamentEvent(id: TournamentEventId): EventDef {
    const meta = EVENT_META[id]
    return {
        id,
        name: meta.title,
        description: meta.description,
        rewardType: meta.rewardType,
        rounds: [
            {
                id: 'match',
                title: meta.title,
                description: meta.description,
                choices: [{ id: '__end__', type: 'continue', label: '踏入擂台' }],
            },
        ],
    }
}

/** 所有斗炁大会事件 */
export const TOURNAMENT_EVENTS: EventDef[] = TOURNAMENT_EVENT_IDS.map(makeTournamentEvent)

/** 按 ID 索引 */
export const TOURNAMENT_EVENT_MAP: Record<string, EventDef> = {}
for (const ev of TOURNAMENT_EVENTS) {
    TOURNAMENT_EVENT_MAP[ev.id] = ev
}
