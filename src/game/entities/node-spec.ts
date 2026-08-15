import type { When } from './condition'

// ════════════════════════════════════════
//  节点候选（渐进生成）
//  33 个节点槽，每个槽是一组候选；到达节点时按当前 flags 现场解析：
//    1) 过滤 when → 存活候选
//    2) 有非 fallback 候选 → 优先它们（故事专属节点压过通用池）
//    3) 恰好 1 个 → 直接开始；多个 → 加权抽 ≤3 让玩家选
//    4) 没有非 fallback → 用 fallback 候选（通用池）
//  事件可出现在多个节点、带不同条件 —— 链式解锁（喝酒结拜、副手天工坊等）即数据表达。
// ════════════════════════════════════════

/** 事件的一个放置声明（写在 EventDef.placement 上）。 */
export interface Placement {
    /** 固定节点（1-based） */
    nodes?: number[]
    /** 节点范围 [min, max]（含两端）：范围内每个节点都成为该事件的候选 */
    range?: [number, number]
    /** 候选权重（多候选时加权抽取；默认 1） */
    weight?: number
    /** 出现条件（flag 表达式） */
    when?: When
    /** 兜底候选：仅当该节点没有非 fallback 候选存活时使用（通用池/默认 Boss） */
    fallback?: boolean
}

/** 节点槽里的一个候选 */
export interface Candidate {
    eventId: string
    weight?: number
    when?: When
    fallback?: boolean
}

/** 一个节点槽（33 个） */
export interface NodeSpec {
    candidates: Candidate[]
}

/** 节点解析结果：要么直接开始某事件，要么让玩家从若干候选中选一个。 */
export type NodeResolution =
    | { mode: 'direct'; eventId: string }
    | { mode: 'choice'; options: { eventId: string; label: string; description?: string }[] }
    | { mode: 'empty' }
