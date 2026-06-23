import { OPPONENTS } from '../data/opponents/index'
import type { MapNode, NodeOption, NodeContent } from '../entities/node-map'

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

    // Phase 1: normal 节点 3-10
    for (let i = 0; i < 8; i++) {
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

/**
 * 为 normal 节点生成 3 个选项。
 *
 * 规则:
 *   - 3 个 rewardType 各不相同
 *   - 至少 1 个 combat, 至少 1 个 event
 *   - weapon 权重最低
 */
export function generateOptions(_node: MapNode, availableEnemies: string[]): NodeOption[] {
    // 1. 加权随机选 3 个不重复的 rewardType
    const types = pickWeighted(ALL_REWARD_TYPES, REWARD_WEIGHTS, 3)

    // 2. 分配 content：确保至少 1 combat + 1 event
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
