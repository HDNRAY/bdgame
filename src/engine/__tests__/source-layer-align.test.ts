import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Character } from '../entities/character'
import { OPPONENTS, gen } from '../../data/opponents/index'
import { ARTIFACTS } from '../../data/artifacts'
import { PASSIVES } from '../../data/passives'
import { ALL_ATTRS } from '../entities/attributes'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Reward } from '../../game/entities/reward'

/**
 * 构造期效果改成「来源层账 + 重算」之后，必须与改造前**逐字段零漂移**。
 *
 * 金色基准 `__fixtures__/source-layer-golden.json` 是用改造前的代码生成的（316 个 build：
 * 32 对手 × level{10,20,33} + 50 件可偷奇物 + 110 个功法 + 60 组固定种子随机组合）。
 * 如果哪天有人改了构造期行为、或改了数据文件，这个测试会立刻指出是哪个 build 的哪个字段变了。
 */
const golden = JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'source-layer-golden.json'), 'utf-8'),
) as Record<string, Record<string, unknown>>

function snap(c: Character): Record<string, unknown> {
    return {
        attrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, c.attrs.get(a)])),
        maxHpMod: c.maxHpMod,
        maxApMod: c.maxApMod,
        triggerSlotMod: c.triggerSlotMod,
        maxHp: c.maxHp,
        maxAp: c.maxAp,
        maxTriggerSlots: c.maxTriggerSlots,
        weaponTags: [...(c.weaponDef?.tags ?? [])].sort(),
        restrictions: c.statRestrictionChecks.length,
        durationMults: c.buffDurationCallbacks.length,
    }
}

const base = (rewards: Reward[]): CharacterBuild => ({
    id: 't',
    name: 't',
    weapon: 'bare_hands',
    battleStyle: 'clinch',
    baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, 7])) as CharacterBuild['baseAttrs'],
    rewards,
})
const art = (id: string): Reward => ({ type: 'artifact', id, name: id, description: '', tags: [] })
const pas = (id: string): Reward => ({ type: 'passive', id, name: id, description: '', tags: [] })
const stealable = ARTIFACTS.filter(
    (a) => !a.tags.includes('inherent') && !a.tags.includes('implant') && !a.tags.includes('imperial'),
)

describe('构造期效果 → 来源层账：零漂移', () => {
    it('316 个 build（对手/奇物/功法/随机组合）与金色基准逐字段相等', () => {
        const built: Record<string, Record<string, unknown>> = {}
        for (const def of OPPONENTS) {
            for (const lv of [10, 20, 33]) built[`opp:${def.id}:${lv}`] = snap(new Character(gen(def, lv)))
        }
        for (const a of stealable) built[`art:${a.id}`] = snap(new Character(base([art(a.id)])))
        for (const p of PASSIVES) built[`pas:${p.id}`] = snap(new Character(base([pas(p.id)])))
        // 与金色基准同一套 LCG（seed 12345）随机组合，保证构建清单一致
        let seed = 12345
        const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000)
        const pool: Reward[] = [...ARTIFACTS.map((a) => art(a.id)), ...PASSIVES.map((p) => pas(p.id))]
        for (let i = 0; i < 60; i++) {
            const n = 3 + Math.floor(rnd() * 6)
            const picked: Reward[] = []
            const used = new Set<string>()
            while (picked.length < n) {
                const r = pool[Math.floor(rnd() * pool.length)]
                if (used.has(r.id)) continue
                used.add(r.id)
                picked.push(r)
            }
            built[`mix:${i}`] = snap(new Character(base(picked)))
        }

        const diffs: string[] = []
        for (const key of Object.keys(golden)) {
            const g = golden[key]
            const b = built[key]
            if (!b) {
                diffs.push(`${key}: 缺构建`)
                continue
            }
            for (const field of Object.keys(g)) {
                if (field === 'id') continue
                const gv = JSON.stringify(g[field])
                const bv = JSON.stringify(b[field])
                if (gv !== bv) diffs.push(`${key}.${field}: 金色 ${gv} ≠ 现在 ${bv}`)
            }
        }
        expect(Object.keys(golden).length).toBe(316)
        expect(diffs).toEqual([])
    })
})

describe('removeSource：撤销来源后与「从未持有」完全一致', () => {
    it('50 件可偷奇物全部覆盖（attrs / maxHp / maxAp / 触发槽 / 武器 tag）', () => {
        const diffs: string[] = []
        for (const a of stealable) {
            const withArt = new Character(base([art(a.id)]))
            const without = new Character(base([]))
            // 只有带构造期 effects 的奇物才会建层（纯触发型奇物如金丝手套没有层，返回 false 是正确行为）
            const sourceId = `artifact:${a.id}`
            const hasLayer = withArt.sourceLayers.some((l) => l.sourceId === sourceId)
            expect(withArt.removeSource(sourceId)).toBe(hasLayer)
            const left = snap(withArt)
            const target = snap(without)
            for (const field of Object.keys(target)) {
                if (JSON.stringify(left[field]) !== JSON.stringify(target[field])) {
                    diffs.push(`${a.id}.${field}: 撤销后 ${JSON.stringify(left[field])} ≠ 从未持有 ${JSON.stringify(target[field])}`)
                }
            }
            expect(withArt.sourceLayers.some((l) => l.sourceId === `artifact:${a.id}`)).toBe(false)
        }
        expect(stealable.length).toBe(50)
        expect(diffs).toEqual([])
    })

    it('移除不存在的来源返回 false，不动任何状态', () => {
        const c = new Character(base([art('iron_mask')]))
        const before = snap(c)
        expect(c.removeSource('artifact:does_not_exist')).toBe(false)
        expect(snap(c)).toEqual(before)
    })
})
