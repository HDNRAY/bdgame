import { getBuff } from '../../../data/buffs'
import type { BuffDef } from '../../../data/buffs/types'
import type { BuffLayer } from '../types'
import { BuffRegistry, cloneBuffLayer } from './buff-registry'
import type { RegisteredHook } from './buff-registry'

/**
 * 遍历 buff 中属于指定角色的层，回调 (def, layer, buffId, key, ownerId)。
 * - pendingBuffs 为 BuffRegistry（战斗真源）时走 byOwner 索引，只遍历目标角色层；
 *   为裸 Map（测试/沙盒手搓）时保持旧全表扫描语义
 * - charIds 可为单个角色 id，或数组（target+attacker 双遍历场景）
 * - 回调返回 false 可提前终止
 */
export function forEachBuffOf(
    pendingBuffs: Map<string, BuffLayer>,
    charIds: string | readonly string[],
    fn: (def: BuffDef | undefined, layer: BuffLayer, buffId: string, key: string, ownerId: string) => void | false,
): void {
    if (pendingBuffs instanceof BuffRegistry) {
        pendingBuffs.forEachBuffOf(charIds, fn)
        return
    }
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

/**
 * 遍历「带某钩子」的层，回调 (def, layer, ownerId, key)。
 * - BuffRegistry：走 hook 桶直达 —— 桶条目里已缓存 def，省掉逐层 `key.indexOf/slice` + `getBuff`，
 *   且不扫无关层（结算/资源计算这类「只问一个钩子」的场景都该走这里）。
 * - 裸 Map（测试/手搓 state，无桶）：退回全表扫描 + `def[hook]` 过滤，语义一致。
 * 前提：桶里只有「建层时登记过」的层。用裸 `pendingBuffs.set` 写入、且 def 带钩子的层需要
 * 走 `register()`（或 BuffRegistry.set 的登记分支），否则会被漏掉。
 */
export function forEachHookOf(
    pendingBuffs: Map<string, BuffLayer>,
    hook: RegisteredHook,
    ownerIds: string | readonly string[] | undefined,
    fn: (def: BuffDef, layer: BuffLayer, ownerId: string, key: string) => void | false,
): void {
    if (pendingBuffs instanceof BuffRegistry) {
        pendingBuffs.forEachHook(hook, ownerIds, fn)
        return
    }
    const filterOwner = ownerIds === undefined ? null : typeof ownerIds === 'string' ? [ownerIds] : ownerIds
    for (const [key, layer] of pendingBuffs) {
        const sep = key.indexOf('::')
        if (sep < 0) continue
        const rest = key.slice(sep + 2)
        const sep2 = rest.indexOf('::')
        const ownerId = sep2 < 0 ? rest : rest.slice(0, sep2)
        if (filterOwner && !filterOwner.includes(ownerId)) continue
        const def = getBuff(key.slice(0, sep))
        if (!def || !def[hook]) continue
        if (fn(def, layer, ownerId, key) === false) return
    }
}

/** 兼容旧导出：仅克隆指定角色的层（BuffRegistry 上已有 cloneFor，裸 Map 用此兜底） */
export function cloneBuffsFor(
    pendingBuffs: Map<string, BuffLayer>,
    charIds: readonly string[],
): Map<string, BuffLayer> {
    if (pendingBuffs instanceof BuffRegistry) {
        return pendingBuffs.cloneFor(charIds)
    }
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
