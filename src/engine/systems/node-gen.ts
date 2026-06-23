import { OPPONENTS } from '../data/opponents/index'
import { BACKGROUNDS, getBackground } from '../data/backgrounds'
import { STARTING_WEAPONS } from '../data/starting-weapons'
import { PLAYER_ACTIONS } from '../data/actions/player'
import { rewardPool } from './reward-pool'
import type { MapNode, NodeOption, NodeContent } from '../entities/node-map'
import type { RewardType } from '../entities/reward'
import type { Tag } from '../entities/tag'

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

const PHASE1_BOSS = 'zhanglie' // 临时，后续根据背景动态指定
const GATEKEEPER = 'xuanji' // 守门人（临时）
const FINAL_BOSS = 'liuxigua' // 决赛Boss（临时）

/**
 * 生成 33 节点地图。
 *
 * 结构:
 *   [1] 选背景    [2] 选武器
 *   Phase 1: [3-10] 8个 normal → [11] Phase1 Boss
 *   Phase 2: [12-21] 10个 normal → [22] 守门人
 *   Phase 3: [23-32] 10个 normal → [33] 决赛Boss
 */
export function generateMap(): MapNode[] {
    const map: MapNode[] = []
    let idx = 1

    // 背景选择
    map.push({ index: idx++, phase: 1, type: 'bg' })
    // 武器选择
    map.push({ index: idx++, phase: 1, type: 'weapon' })
    // 第3个节点固定出招式
    map.push({ index: idx++, phase: 1, type: 'normal', forceRewardType: 'action', options: [] })

    // Phase 1: normal 节点 4-10
    for (let i = 0; i < 7; i++) {
        map.push({ index: idx++, phase: 1, type: 'normal', options: [] })
    }
    // Phase 1 Boss
    map.push({ index: idx++, phase: 1, type: 'boss', bossId: PHASE1_BOSS })

    // Phase 2: normal 节点 12-21
    for (let i = 0; i < 10; i++) {
        map.push({ index: idx++, phase: 2, type: 'normal', options: [] })
    }
    // 守门人
    map.push({ index: idx++, phase: 2, type: 'boss', bossId: GATEKEEPER })

    // Phase 3: normal 节点 23-32
    for (let i = 0; i < 10; i++) {
        map.push({ index: idx++, phase: 3, type: 'normal', options: [] })
    }
    // 决赛Boss
    map.push({ index: idx, phase: 3, type: 'boss', bossId: FINAL_BOSS })

    return map
}

// ════════════════════════════════════════
//  选项生成
// ════════════════════════════════════════

const ALL_REWARD_TYPES = ['cult', 'passive', 'artifact', 'action', 'weapon'] as const

/** 奖励类型权重（数字越低越不容易出现） */
const REWARD_WEIGHTS: Record<string, number> = {
    cult: 20,
    passive: 25,
    artifact: 25,
    action: 25,
    weapon: 5,
}

/** 按节点权重生成奖励类型 */
function getRewardTypes(node: MapNode): RewardType[] {
    const types = pickWeighted<RewardType>(ALL_REWARD_TYPES, REWARD_WEIGHTS, 3)
    if (node.forceRewardType && !types.includes(node.forceRewardType)) {
        const idx = types.findIndex((t) => t !== 'cult')
        if (idx >= 0) types[idx] = node.forceRewardType
    }
    return types
}

/**
 * 为 normal 节点生成 3 个选项。
 *
 * 规则:
 *   - 3 个 rewardType 各不相同
 *   - 至少 1 个 combat, 至少 1 个 event
 *   - weapon 权重最低
 *   - forceRewardType 强制一个选项的奖励类型
 */
export function generateOptions(node: MapNode, availableEnemies: string[]): NodeOption[] {
    const types = getRewardTypes(node)
    const contents = assignContents(types.length)

    // 3. 构建选项
    return types.map((rt, i) => {
        const content = contents[i]
        const opt: NodeOption = {
            content,
            rewardType: rt,
            desc: describeOption(content, rt),
        }
        if (content === 'combat') {
            const pool = availableEnemies.length > 0 ? availableEnemies : ['zhangsan']
            opt.enemyId = pool[i % pool.length]
        } else {
            opt.eventText = pickRandom(EVENT_TEXTS, 1)[0]
        }
        return opt
    })
}

/** 加权随机取 n 个不重复元素 */
function pickWeighted<T extends string>(items: readonly T[], weights: Record<string, number>, n: number): T[] {
    const pool = items.flatMap((item) => Array(weights[item] ?? 10).fill(item))
    const result: T[] = []
    const used = new Set<T>()
    while (result.length < n && used.size < items.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)]
        if (!used.has(pick)) {
            used.add(pick)
            result.push(pick)
        }
    }
    // 万一不够，补未选的
    for (const item of items) {
        if (result.length >= n) break
        if (!used.has(item)) result.push(item)
    }
    return result
}

/** 分配 content，保证至少 1 combat + 1 event */
function assignContents(count: number): NodeContent[] {
    const result: NodeContent[] = []
    // 先确保多样性
    result.push('combat')
    result.push('event')
    // 剩余随机
    for (let i = result.length; i < count; i++) {
        result.push(Math.random() > 0.5 ? 'combat' : 'event')
    }
    return shuffle(result)
}

/** 选项简短描述 */
function describeOption(content: NodeContent, rewardType: string): string {
    const icon = content === 'combat' ? '⚔' : '❓'
    const label: Record<string, string> = {
        cult: '+4修炼',
        passive: '功法',
        artifact: '奇物',
        action: '招式',
        weapon: '武器',
    }
    return `${icon} ${label[rewardType] ?? rewardType}`
}

/** 通用事件文本池 */
const EVENT_TEXTS = [
    '你在路边遇到一位云游的炼炁士，他指点你一二。',
    '一处废弃的遗迹中，你发现了一件遗物。',
    '有人认出了你的来历，塞给你一样东西后匆匆离去。',
    '你在集市上淘到一件有用的物件。',
    '一位老者打量了你一番，点头说道："不错，有缘。"',
]

// ════════════════════════════════════════
//  节点选择内容生成
// ════════════════════════════════════════

export interface NodeChoice {
    id: string
    name: string
    desc: string
    tags?: Tag[]
    /** 选择前的叙事文案（节点2/3等固定节点使用） */
    flavorText?: string
}

/** 背景选择——随机 3 个背景 */
export function getBgChoices(): NodeChoice[] {
    return pickRandom(BACKGROUNDS, 3).map((b) => ({
        id: b.id,
        name: b.name,
        desc: b.desc,
        tags: b.tags,
    }))
}

/** 默认节点文案 */
const DEFAULT_NODE_TEXTS: Partial<Record<number, string>> = {
    2: '你发现了一件趁手的兵器。',
    3: '你领悟了一招新招式。',
}

/** 获取节点文案（优先用背景覆盖） */
export function getNodeFlavorText(nodeIndex: number, backgroundId?: string): string | undefined {
    if (backgroundId) {
        const bg = getBackground(backgroundId)
        const override = bg?.nodeTexts?.[nodeIndex]
        if (override) return override
    }
    return DEFAULT_NODE_TEXTS[nodeIndex]
}

/** 武器选择——随机 3 把武器，附带 flavorText */
export function getWeaponChoices(bgId?: string): NodeChoice[] {
    const ft = getNodeFlavorText(2, bgId)
    return pickRandom(STARTING_WEAPONS, 3).map((w, i) => ({
        id: w.id,
        name: w.name,
        desc: w.description,
        tags: w.tags,
        flavorText: i === 0 ? ft : undefined,
    }))
}

/** forceRewardType 节点——奖励选择，附带 flavorText */
export function getForceRewardChoices(
    node: MapNode,
    ownedIds: string[],
    playerTags: Tag[],
    bgId?: string,
    /** 仅返回 apCost≤2 的非辅助招式（第1个招式节点专用） */
    lowCostActions?: boolean,
): NodeChoice[] {
    if (!node.forceRewardType || node.forceRewardType === 'cult') return []

    let pool = rewardPool.getPool(node.forceRewardType)
    if (node.forceRewardType === 'action' && lowCostActions) {
        const allowed = new Set(
            PLAYER_ACTIONS.filter((a) => a.apCost <= 2 && !a.tags.includes('support')).map((a) => a.id),
        )
        pool = pool.filter((r) => allowed.has(r.id))
    }

    const ft = getNodeFlavorText(node.index, bgId)
    return rewardPool.pickChoicesFrom(pool, 3, ownedIds, playerTags).map((r, i) => ({
        id: r.id,
        name: r.name,
        desc: r.description,
        tags: r.tags,
        flavorText: i === 0 ? ft : undefined,
    }))
}

/**
 * 统一入口：根据节点类型返回选择项。
 * bg/weapon → 3选1 背景/武器
 * forceRewardType → 3选1 奖励（附带 flavorText）
 * normal → 已由 generateOptions 填充 options
 * boss → []
 */
export function getNodeChoices(node: MapNode, ownedIds: string[], playerTags: Tag[], bgId?: string): NodeChoice[] {
    if (node.type === 'bg') return getBgChoices()
    if (node.type === 'weapon') return getWeaponChoices(bgId)
    if (node.type === 'boss') return []
    if (node.forceRewardType) return getForceRewardChoices(node, ownedIds, playerTags, bgId)
    // normal 节点：generateOptions 已填充 node.options
    return (node.options ?? []).map((o) => ({
        id: `${node.index}-${o.rewardType}-${o.content}`,
        name: o.desc,
        desc: o.eventText ?? (o.content === 'combat' ? `vs ${o.enemyId}` : ''),
        tags: [],
    }))
}
