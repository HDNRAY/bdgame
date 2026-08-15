import { getStory } from '../../data/stories/index'
import { BRANCH_EVENTS } from '../../data/events/branch'
import type { GameState } from '../entities/state'
import type { Node } from '../../game/entities/node'
import type { StoryDef } from '../../game/entities/story'

// ── 斗炁大会默认事件映射 ──
// 骨架阶段将以下节点设为对应的大会事件。
// 故事可通过 overrides 替换其中任意节点。
export const TOURNAMENT_NODE_MAP: Record<number, string> = {
    23: 'tournament_open',
    26: 'tournament_group_r1',
    27: 'tournament_group_r2',
    28: 'tournament_group_r3',
    29: 'tournament_knockout_16',
    30: 'tournament_knockout_8',
    31: 'tournament_knockout_4',
    33: 'tournament_final',
}

/**
 * 生成 33 个骨架节点。
 *
 * 骨架是地图的初始状态，故事叠加层在此基础上修改。
 * 固定节点：
 *   node 1       = 选背景故事
 *   node 2       = 选兵器
 *   node 3       = 选招式
 *   node 11/22 = Boss 位（默认 generic boss，故事可覆盖）
 *   node 23/26-33 = 斗炁大会事件（由 applyTournamentLayer 设置，故事可覆盖）
 *
 * 其余节点为空，由 fillEmptyNodes 填充。
 */
export function buildSkeleton(): Node[] {
    const nodes: Node[] = []
    for (let i = 1; i <= 33; i++) {
        const node: Node = {}
        if (i === 1) node.eventIds = ['pick_story']
        else if (i === 2) node.eventIds = ['pick_weapon']
        else if (i === 3) node.eventIds = ['pick_action']
        else if (i === 11) node.eventIds = ['boss_phase1']
        else if (i === 22) node.eventIds = ['boss_phase2']
        // n33 = tournament_final（由 applyTournamentLayer 设置，故事可覆盖）
        nodes.push(node)
    }
    return nodes
}

/**
 * 应用故事叠加（Layer 2）。
 *
 * 选完背景故事后调用，在骨架节点基础上：
 * 1. 应用 overrides — 替换指定节点的 eventIds
 * 2. 应用 insertions — 在范围内随机选空节点插入事件
 *
 * 所有随机在此函数中一次性定死。
 *
 * @param nodes - 33 个骨架节点（会被直接修改）
 * @param storyId - 玩家选中的故事 ID
 * @returns 故事定义（供后续 onNode 使用），未找到则返回 undefined
 */
export function applyStoryOverlay(nodes: Node[], storyId: string): StoryDef | undefined {
    const story = getStory(storyId)
    if (!story) return undefined

    // 1. 应用 overrides
    if (story.overrides) {
        for (const [key, value] of Object.entries(story.overrides)) {
            const idx = parseInt(key) - 1
            if (idx === 0) continue // n1 始终是出身选择（pick_story），出身事件由引擎在选中后启动
            if (idx >= 0 && idx < nodes.length) {
                nodes[idx].eventIds = [value]
            }
        }
    }

    // 2. 应用 insertions
    if (story.insertions) {
        for (const ins of story.insertions) {
            const [min, max] = ins.range
            const candidates: number[] = []
            for (let i = min; i <= max; i++) {
                const n = nodes[i - 1]
                if (!n.eventIds || n.eventIds.length === 0) {
                    candidates.push(i)
                }
            }
            if (candidates.length > 0) {
                const pick = candidates[Math.floor(Math.random() * candidates.length)]
                nodes[pick - 1].eventIds = [ins.eventId]
            }
        }
    }

    return story
}

/**
 * 第三层：填充所有空节点的 eventIds。
 * 没有故事覆盖的节点，从支线事件池随机选 3 个不同事件。
 */
export function fillEmptyNodes(nodes: Node[], state?: GameState): void {
    for (const node of nodes) {
        if (!node.eventIds || node.eventIds.length === 0) {
            let pool = [...BRANCH_EVENTS]
            if (state) {
                pool = pool.filter((ev) => !ev.available || ev.available(state))
            }
            const shuffled = pool.sort(() => Math.random() - 0.5)
            node.eventIds = shuffled.slice(0, 3).map((ev) => ev.id)
        }
    }
}

/**
 * 第 1.5 层：斗炁大会默认节点。
 *
 * 在骨架之后、故事叠加之前调用。
 * 将 TOURNAMENT_NODE_MAP 中定义的节点设为对应的大会事件。
 * 故事可通过 overrides 替换其中任意节点。
 */
export function applyTournamentLayer(nodes: Node[]): void {
    for (const [key, eventId] of Object.entries(TOURNAMENT_NODE_MAP)) {
        const idx = parseInt(key) - 1
        if (idx >= 0 && idx < nodes.length) {
            nodes[idx].eventIds = [eventId]
        }
    }
}
