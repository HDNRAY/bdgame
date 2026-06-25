import { OPPONENTS } from '../data/opponents/index'
import { STORIES, getStory } from '../data/stories/index'
import { STARTING_WEAPONS } from '../data/starting-weapons'
import { PLAYER_ACTIONS } from '../data/actions/player'
import { rewardPool } from './reward-pool'
import { EVENT_DB } from '../data/events/index'
import { isSimpleStoryEvent } from '../util/event-utils'
import type { MapNode } from '../entities/node-map'
import type { Tag } from '../entities/tag'
import type { EventDef } from '../entities/event'
import type { RewardType } from '../entities/reward'

// ════════════════════════════════════════
//  工具函数
// ════════════════════════════════════════

/** Fisher-Yates 洗牌 */
export function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/** 随机取 n 个 */
export function pickRandom<T>(arr: T[], n: number): T[] {
    return shuffle(arr).slice(0, n)
}

/** 所有对手 ID（不含张三） */
export const ALL_OPPONENT_IDS: string[] = OPPONENTS.map((o) => o.id)

/** 张三（必输占位） */
export const ZHANGSAN_ID = 'zhangsan'

// ════════════════════════════════════════
//  地图生成
// ════════════════════════════════════════

/**
 * 生成 33 节点地图。
 *
 * 结构:
 *   [1] 选背景     [2] 选武器     [3] 第一个招式
 *   Phase 1: [4-10] 7个 event → [11] Phase1 Boss
 *   Phase 2: [12-21] 10个 event → [22] 守门人
 *   Phase 3: [23-32] 10个 event → [33] 决赛Boss
 */
export function generateMap(): MapNode[] {
    const map: MapNode[] = []
    let idx = 1

    map.push({ index: idx++, type: 'bg' })
    map.push({ index: idx++, type: 'weapon' })
    map.push({ index: idx++, type: 'first_action' })

    // Phase 1
    for (let i = 0; i < 7; i++) map.push({ index: idx++, type: 'event' })
    map.push({ index: idx++, type: 'boss' })

    // Phase 2
    for (let i = 0; i < 10; i++) map.push({ index: idx++, type: 'event' })
    map.push({ index: idx++, type: 'boss' })

    // Phase 3
    for (let i = 0; i < 10; i++) map.push({ index: idx++, type: 'event' })
    map.push({ index: idx, type: 'boss' })

    return map
}

// ════════════════════════════════════════
//  选项展示类型
// ════════════════════════════════════════

export interface NodeChoice {
    id: string
    name: string
    desc: string
    tags?: Tag[]
    /** 选择前的叙事文案 */
    flavorText?: string
    /** 战斗事件的奖励类型（已决定的或固定的） */
    rewardType?: RewardType
}

// ════════════════════════════════════════
//  各节点类型的选项生成
// ════════════════════════════════════════

/** 背景选择——随机 3 个背景 */
export function getBgChoices(): NodeChoice[] {
    return pickRandom(STORIES, 3).map((s) => ({
        id: s.id,
        name: s.name,
        desc: s.desc,
        tags: s.tags,
    }))
}

/** 武器选择——随机 3 把武器 */
export function getWeaponChoices(): NodeChoice[] {
    return pickRandom(STARTING_WEAPONS, 3).map((w) => ({
        id: w.id,
        name: w.name,
        desc: w.description,
        tags: w.tags,
    }))
}

/** 第一个招式选择——低费非辅助 + 武器 tag 兼容 */
export function getFirstActionChoices(ownedIds: string[], playerTags: Tag[]): NodeChoice[] {
    // 先用 apCost 和 support 过滤
    const candidates = PLAYER_ACTIONS.filter((a) => a.apCost <= 2 && !a.tags.includes('support'))
    // 再按 requiredTags 过滤：至少有一个 tag 匹配武器（playerTags 已含武器 tag）
    const weaponTags = new Set(playerTags)
    const compatible = candidates.filter((a) => {
        if (a.requiredTags.length === 0) return true
        return a.requiredTags.some((t) => weaponTags.has(t))
    })
    const allowed = new Set(compatible.map((a) => a.id))
    const pool = rewardPool.getPool('action').filter((r) => allowed.has(r.id))
    return rewardPool.pickChoicesFrom(pool, 3, ownedIds, playerTags).map((r) => ({
        id: r.id,
        name: r.name,
        desc: r.description,
        tags: r.tags,
    }))
}

// ════════════════════════════════════════
//  事件节点的事件选择
// ════════════════════════════════════════

export interface EventPickContext {
    nodeIndex: number
    storyId: string
    flags: Record<string, boolean>
    injury: number
    rewardCount: number
    usedEventIds: Set<string>
}

/**
 * 从 EVENT_DB 中筛选出 3 个符合条件的事件。
 * 保证至少 1 个 combat。
 */
export function pickEventOptions(ctx: EventPickContext): string[] {
    const filtered = EVENT_DB.filter((e) => {
        // boss 事件有固定节点位置，不出现在 normal 三选一
        if (e.type === 'boss') return false
        if (e.maxCount && ctx.usedEventIds.has(e.id)) return false
        if (e.minNode && ctx.nodeIndex < e.minNode) return false
        if (e.maxNode && ctx.nodeIndex > e.maxNode) return false
        if (
            e.condition &&
            !e.condition({
                nodeIndex: ctx.nodeIndex,
                storyId: ctx.storyId,
                flags: ctx.flags,
                injury: ctx.injury,
                rewardCount: ctx.rewardCount,
            })
        )
            return false
        // story 事件：requireFlags 检查（仅 StoryEventDef 有此字段）
        if (isSimpleStoryEvent(e) && e.requireFlags) {
            for (const [k, v] of Object.entries(e.requireFlags)) {
                if ((ctx.flags[k] ?? false) !== v) return false
            }
        }
        return true
    })

    // 保证至少 1 个 combat
    const combatEvents = filtered.filter((e) => e.type === 'combat')
    const nonCombatEvents = filtered.filter((e) => e.type !== 'combat')

    const result: EventDef[] = []
    if (combatEvents.length > 0) {
        result.push(pickRandom(combatEvents, 1)[0])
    }
    // 从剩余中补到 3 个
    const rest = pickRandom(
        nonCombatEvents.length > 0 ? nonCombatEvents : filtered.filter((e) => !result.includes(e)),
        3 - result.length,
    )
    result.push(...rest)

    return shuffle(result).map((e) => e.id)
}

/** 默认节点叙事文案（story 可通过 getNodeOverride.flavorText 覆盖） */
const DEFAULT_NODE_TEXTS: Partial<Record<number, string>> = {
    1: '你走进擂台，环顾四周。各路高手齐聚于此，为了一场生死不论的淘汰赛。',
    2: '你打量着面前的兵器架。选一把趁手的。',
    3: '你默默回想自己最熟练的起手式。',
    11: '第一轮结束。你望向擂台的更深處——那里还有更强的对手在等你。',
    12: '硝烟未散，第二轮的旗号已经升起。剩下的人都不简单。',
    22: '你站在最后一扇门前。守门人就在里面。',
    23: '最后的十人，最后的擂台。每个人都有自己的故事，只有一个人能站着出去。',
    33: '决赛。你面前站着这一路来最强大的对手。你握紧了手中的兵器。',
}

/** 获取节点文案（优先用故事覆盖，其次默认） */
export function getNodeFlavorText(nodeIndex: number, storyId?: string): string | undefined {
    if (storyId) {
        const s = getStory(storyId)
        const override = s?.getNodeOverride?.(nodeIndex)
        if (override?.flavorText) return override.flavorText
    }
    return DEFAULT_NODE_TEXTS[nodeIndex]
}
