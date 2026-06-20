import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { Talent } from '../../entities/passive'

/** 统计角色所有 tag 频率 */
export function countTags(self: Character): Map<string, number> {
    const freq = new Map<string, number>()
    const add = (tags: string[]) => {
        for (const t of tags) freq.set(t, (freq.get(t) ?? 0) + 1)
    }
    add(self.weaponDef?.tags ?? [])
    for (const p of self.passiveDefs) add(p.tags)
    for (const a of self.artifactDefs) add(a.tags)
    for (const a of self.actions) add(a.def.tags)
    return freq
}

/** 选对面最匹配的 N 个功法（按 tag 重叠度），排除属性不达标的 */
export function pickBestPassives(self: Character, enemy: Character, count: number): string[] {
    const selfTags = countTags(self)
    const candidates = enemy.passiveDefs.filter((p) => {
        if (self.passiveDefs.some((sp) => sp.id === p.id)) return false
        // 固有标签的功法不可复制
        if (p.tags.includes('inherent')) return false
        // 天赋需要属性达标才能偷
        if ('requireAttrsMin' in p) {
            const t = p as unknown as Talent
            const entries = Object.entries(t.requireAttrsMin) as [AttrName, number][]
            const minOk = entries.every(([attr, req]) => self.attrs.get(attr) >= req)
            if (!minOk) return false
        }
        return true
    })
    if (candidates.length === 0) return []
    candidates.sort((a, b) => {
        const scoreA = a.tags.reduce((s, t) => s + (selfTags.get(t) ?? 0), 0)
        const scoreB = b.tags.reduce((s, t) => s + (selfTags.get(t) ?? 0), 0)
        return scoreB - scoreA
    })
    return candidates.slice(0, count).map((c) => c.id)
}
