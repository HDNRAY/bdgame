import { getBuff } from '../../../data/buffs'
import type { BuffDef } from '../../../data/buffs/types'
import type { BuffLayer } from '../types'

/** 浅克隆单个 buff layer（替代 structuredClone 深拷贝；mods/extra 各一层，extra 数组值复制） */
function cloneBuffLayer(l: BuffLayer): BuffLayer {
    const c: BuffLayer = { ...l }
    if (l.mods) c.mods = { ...l.mods }
    if (l.extra) {
        const extra: BuffLayer['extra'] = {}
        for (const [k, v] of Object.entries(l.extra)) {
            extra[k] = Array.isArray(v) ? ([...v] as number[] | string[]) : v
        }
        c.extra = extra
    }
    return c
}

/** 仅克隆指定角色的 buff layer（AI 估算沙盒：钩子只读写这些角色的层，召唤物 ownerId 属于召唤者） */
export function cloneBuffsFor(
    pendingBuffs: Map<string, BuffLayer>,
    charIds: readonly string[],
): Map<string, BuffLayer> {
    const out = new Map<string, BuffLayer>()
    for (const [key, layer] of pendingBuffs) {
        const sep = key.indexOf('::')
        if (sep < 0) continue
        const rest = key.slice(sep + 2)
        const sep2 = rest.indexOf('::')
        const ownerId = sep2 < 0 ? rest : rest.slice(0, sep2)
        if (!charIds.includes(ownerId)) continue
        out.set(key, cloneBuffLayer(layer))
    }
    return out
}

/**
 * 遍历 pendingBuffs 中属于指定角色的层，回调 (def, layer, buffId, key, ownerId)。
 * - charIds 可为单个角色 id，或数组（target+attacker 双遍历场景）
 * - 用 indexOf 解析 key，避免逐条 split('::') 分配数组
 * - 回调返回 false 可提前终止
 */
export function forEachBuffOf(
    pendingBuffs: Map<string, BuffLayer>,
    charIds: string | readonly string[],
    fn: (def: BuffDef | undefined, layer: BuffLayer, buffId: string, key: string, ownerId: string) => void | false,
): void {
    const single = typeof charIds === 'string'
    for (const [key, layer] of pendingBuffs) {
        const sep = key.indexOf('::')
        if (sep < 0) continue
        const buffId = key.slice(0, sep)
        const rest = key.slice(sep + 2)
        const sep2 = rest.indexOf('::')
        const ownerId = sep2 < 0 ? rest : rest.slice(0, sep2)
        if (single ? ownerId !== (charIds as string) : !(charIds as readonly string[]).includes(ownerId)) continue
        if (fn(getBuff(buffId), layer, buffId, key, ownerId) === false) return
    }
}
