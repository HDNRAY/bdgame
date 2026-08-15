import type { EventDef } from '../entities/event'
import type { Candidate, NodeResolution, NodeSpec, Placement } from '../entities/node-spec'
import { evaluateWhen } from '../entities/condition'

// ════════════════════════════════════════
//  地图构建 + 渐进生成解析（纯函数）
//  由全部事件的 placement 聚合出 33 个节点槽；
//  到达节点时按当前 flags 解析：过滤 when → 非 fallback 优先 → 直接开始 / 加权 3 选 1 / 兜底池。
// ════════════════════════════════════════

export const TOTAL_NODES = 33

/** 生成 33 个空节点槽。 */
export function emptyNodeSpecs(): NodeSpec[] {
    return Array.from({ length: TOTAL_NODES }, () => ({ candidates: [] }))
}

/** 把一个 placement 展开成若干候选（nodes 与 range 都支持）。 */
function expandPlacement(p: Placement, eventId: string): { index: number; candidate: Candidate }[] {
    const out: { index: number; candidate: Candidate }[] = []
    const base: Candidate = { eventId, weight: p.weight, when: p.when, fallback: p.fallback }
    for (const n of p.nodes ?? []) {
        if (n >= 1 && n <= TOTAL_NODES) out.push({ index: n - 1, candidate: base })
    }
    if (p.range) {
        const [min, max] = p.range
        for (let i = min; i <= max; i++) {
            if (i >= 1 && i <= TOTAL_NODES) out.push({ index: i - 1, candidate: base })
        }
    }
    return out
}

/** 由事件列表聚合出 33 个节点槽（每个事件的所有 placement 都展开进去）。 */
export function buildNodeSpecs(events: Iterable<EventDef>): NodeSpec[] {
    const specs = emptyNodeSpecs()
    for (const ev of events) {
        if (!ev.placement) continue
        for (const p of ev.placement) {
            for (const { index, candidate } of expandPlacement(p, ev.id)) {
                specs[index].candidates.push(candidate)
            }
        }
    }
    return specs
}

/** 从候选里加权抽取 n 个（不重复）。 */
export function weightedSample<T extends { weight?: number }>(candidates: T[], n: number): T[] {
    const copy = [...candidates]
    const result: T[] = []
    while (result.length < n && copy.length > 0) {
        const total = copy.reduce((s, c) => s + (c.weight ?? 1), 0)
        let r = Math.random() * total
        let idx = 0
        for (let i = 0; i < copy.length; i++) {
            r -= copy[i].weight ?? 1
            if (r < 0) {
                idx = i
                break
            }
        }
        result.push(copy[idx])
        copy.splice(idx, 1)
    }
    return result
}

/**
 * 渐进生成：按当前 flags 解析一个节点槽。
 *
 *  1) 过滤 when → 存活候选
 *  2) 非 fallback 存活 → 用它们（故事专属压过通用池）；否则用 fallback 存活
 *  3) 恰好 1 个 → direct；多个 → 加权抽 ≤3 → choice；0 个 → empty
 */
export function resolveNode(
    spec: NodeSpec | undefined,
    flags: Record<string, boolean | string | number>,
    labelOf: (eventId: string) => { label: string; description?: string } = (id) => ({ label: id }),
): NodeResolution {
    if (!spec || spec.candidates.length === 0) return { mode: 'empty' }
    const alive = spec.candidates.filter((c) => evaluateWhen(c.when, { flags }))
    const primary = alive.filter((c) => !c.fallback)
    const usable = primary.length > 0 ? primary : alive.filter((c) => c.fallback)

    if (usable.length === 1) {
        return { mode: 'direct', eventId: usable[0].eventId }
    }
    if (usable.length > 1) {
        const picked = weightedSample(usable, Math.min(3, usable.length))
        return {
            mode: 'choice',
            options: picked.map((c) => ({ eventId: c.eventId, ...labelOf(c.eventId) })),
        }
    }
    return { mode: 'empty' }
}
