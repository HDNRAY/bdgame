import { TALENTS } from '../data/passives'
import type { AttrName } from '../entities/attributes'
import type { Reward } from '../entities/reward'

/** 根据基础属性检查可解锁的天赋 */
export function checkTalents(baseAttrs: Record<string, number>): Reward[] {
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
