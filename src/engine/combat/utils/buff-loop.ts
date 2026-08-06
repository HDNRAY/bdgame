import { getBuff } from '../../../data/buffs'
import type { BuffDef } from '../../../data/buffs/types'
import type { BuffLayer } from '../types'

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
