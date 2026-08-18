// ════════════════════════════════════════
//  斗炁大会 — 通用事件定义（工厂函数）
//  所有事件的 enemyId 由 processTournament 动态设置。
//  小组赛（n23/26/27/28）给奖励；淘汰赛 + 决赛（n29/30/31/33）无奖励。
//  n23 开幕（tournament_open）内嵌一场按故事线分支的热身赛：
//    赢 → 该线前辈/师父授艺（固定功法）；输 → 无奖励（开幕表演，不计胜负、不加伤势）。
// ════════════════════════════════════════

import type { EventDef } from '../../game/entities/event'
import type { Round } from '../../game/entities/round'
import type { When } from '../../game/entities/condition'
import { END_EVENT } from '../../game/entities/round'
import { storyWhen } from './layout'

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

/** 生成一个斗炁大会事件（非开幕） */
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

// ── n23 开幕 + 热身赛（按故事线分支；赢了前辈授艺，输了无奖励） ──

/** 各线热身对手：build 复用既有对手，人物按故事线设定 */
const WARMUP_ENEMY: Record<string, { id: string; label: string; desc: string }> = {
    sect: { id: 'layue', label: '腊月师姐', desc: '师父下场考校，出手留了三分力。' },
    veteran: { id: 'hongti', label: '白山月教官', desc: '教官腰悬唐刀，朝你扬了扬下巴：「上台，让我看看你长进了多少。」' },
    wanderer: { id: 'laifeng', label: '来风', desc: '结拜兄弟第一个找你练手：「可别当着这么多人的面丢我的脸。」' },
    feud: { id: 'daixuan', label: '黛玄科长', desc: '科长以调查科代表身份下场：「考考你，看你在科里学到的东西管不管用。」' },
    xuanmen: { id: 'junshi', label: '玄演', desc: '门主一系的族中高手下场，与你切磋族中御物路数。' },
}

/** 各线热身奖励：赢 → 前辈/师父授艺（固定功法，绕过配额） */
const WARMUP_REWARD: Record<string, { id: string; label: string; desc: string }> = {
    sect: { id: 'sword_dominion', label: '剑意领域', desc: '腊月师姐传你的剑意心法。' },
    veteran: { id: 'iaijutsu_mastery', label: '居合精通', desc: '白山月教官传你的居合要诀。' },
    wanderer: { id: 'combat_instinct', label: '战斗本能', desc: '来风兄弟教的野路子，管用。' },
    feud: { id: 'insight_awareness', label: '洞察意识', desc: '黛玄科长教的侦查心法。' },
    xuanmen: { id: 'spirit_resonance', label: '精神共鸣', desc: '玄演指点的御物心法。' },
}

const STORY_IDS = ['sect', 'veteran', 'wanderer', 'feud', 'xuanmen'] as const

/** n23 开幕事件：开幕剧情 → 热身赛（story 分支对手，胜负不计入赛程）→ 小组赛 r0（engine 注入对手） */
function makeTournamentOpen(): EventDef {
    const rounds: Round[] = [
        {
            id: 'open',
            title: '斗炁大会开幕',
            description: '群雄齐聚，会场人声鼎沸。开幕词讲完，各派下场切磋暖场——三十二名高手要打的，都是硬仗。',
            choices: [{ id: 'warmup_pick', type: 'continue' as const, label: '入场' }],
        },
        {
            id: 'warmup_pick',
            title: '开幕切磋',
            description: '暖场的人里，有人点了你的名。',
            choices: STORY_IDS.map((s) => ({
                id: `warmup_${s}`,
                type: 'continue' as const,
                label: WARMUP_ENEMY[s].label,
                description: WARMUP_ENEMY[s].desc,
                when: storyWhen(s),
            })),
        },
        ...STORY_IDS.map(
            (s): Round => ({
                id: `warmup_${s}`,
                title: `与${WARMUP_ENEMY[s].label}`,
                enemyId: WARMUP_ENEMY[s].id,
                description: `你跃上擂台，与${WARMUP_ENEMY[s].label}切磋。${WARMUP_ENEMY[s].desc}`,
                choices: [{ id: 'warmup_result', type: 'continue' as const, label: '收招' }],
            }),
        ),
        {
            id: 'warmup_result',
            title: '热身结束',
            description: '你收招站定。台下响起掌声。',
            choices: [
                {
                    id: 'warmup_win',
                    type: 'continue' as const,
                    label: '赢了',
                    when: { '==': [{ var: 'result.won' }, true] } as When,
                },
                {
                    id: 'warmup_loss',
                    type: 'continue' as const,
                    label: '输了',
                    when: { '!': { var: 'result.won' } } as When,
                },
            ],
        },
        {
            id: 'warmup_win',
            title: '授艺',
            description: '「底子不错。」对方拍了拍你的肩，当场指点了几句，把一门心法传了给你。',
            choices: STORY_IDS.map((s) => ({
                id: WARMUP_REWARD[s].id,
                type: 'passive' as const,
                label: WARMUP_REWARD[s].label,
                description: WARMUP_REWARD[s].desc,
                when: storyWhen(s),
            })),
        },
        {
            id: 'warmup_end',
            title: '准备开赛',
            description: '热身结束，正式的比试要开始了。',
            choices: [{ id: 'group_r0', type: 'continue' as const, label: '准备开赛' }],
        },
        {
            id: 'warmup_loss',
            title: '技不如人',
            description: '你输了，也不丢人。开幕的切磋，不计胜负。你拍拍衣袍，回到选手席，等正式开赛。',
            choices: [{ id: 'group_r0', type: 'continue' as const, label: '准备开赛' }],
        },
        {
            id: 'group_r0',
            title: '小组赛·第一场',
            description: '开幕结束，你的第一场正式比试开始了。',
            choices: [{ id: 'group_reward', type: 'continue' as const, label: '踏入擂台' }],
        },
        {
            id: 'group_reward',
            title: '战利品',
            description: '大战之后，你有所收获。',
            reward: { kind: 'points' },
            choices: [],
        },
    ]
    return {
        id: 'tournament_open',
        name: '斗炁大会开幕',
        description: '群雄齐聚，会场人声鼎沸。',
        placement: [{ nodes: [23] }],
        reward: { kind: 'none' },
        rounds,
    }
}

/** 所有斗炁大会事件 */
export const TOURNAMENT_EVENTS: EventDef[] = TOURNAMENT_EVENT_IDS.map((id) =>
    id === 'tournament_open' ? makeTournamentOpen() : makeTournamentEvent(id),
)

/** 按 ID 索引 */
export const TOURNAMENT_EVENT_MAP: Record<string, EventDef> = {}
for (const ev of TOURNAMENT_EVENTS) {
    TOURNAMENT_EVENT_MAP[ev.id] = ev
}
