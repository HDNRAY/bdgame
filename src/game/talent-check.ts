import { TALENTS } from '../data/passives'
import type { AttrName } from '../engine/entities/attributes'
import type { Reward } from '../game/entities/reward'

/**
 * 根据**原始属性**（baseAttrs：玩家分配的修炼点 / 生成器的加点结果）检查可解锁的天赋。
 * 只看 raw 值——装备、功法、状态带来的加减属性都不参与。
 */
export function checkTalents(baseAttrs: Partial<Record<AttrName, number>>): Reward[] {
    const result: Reward[] = []
    for (const t of TALENTS) {
        const minOk = t.requireAttrsMin
            ? Object.entries(t.requireAttrsMin).every(([attr, req]) => (baseAttrs[attr as AttrName] ?? 0) >= req)
            : true
        const maxOk = t.requireAttrsMax
            ? Object.entries(t.requireAttrsMax).every(([attr, req]) => (baseAttrs[attr as AttrName] ?? 99) <= req)
            : true
        if (minOk && maxOk) {
            result.push({ type: 'passive' as const, id: t.id, name: t.name, description: '', tags: [] })
        }
    }
    return result
}
