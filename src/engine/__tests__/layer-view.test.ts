import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { layersOf } from '../entities/character/source-layer'
import { OPPONENTS, gen } from '../../data/opponents/index'
import { ARTIFACTS } from '../../data/artifacts'
import { PASSIVES } from '../../data/passives'
import { ALL_ATTRS } from '../entities/attributes'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Reward } from '../../game/entities/reward'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

/**
 * 层的统一读视图 `layersOf()`：来源层（构造期，住在 Character.sourceLayers）与
 * 战斗层（住在 state.pendingBuffs）合并成一个只读列表，谁也不用关心层住在哪。
 */
const base = (rewards: Reward[], id = 't'): CharacterBuild => ({
    id,
    name: id,
    weapon: 'bare_hands',
    battleStyle: 'clinch',
    baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, 7])) as CharacterBuild['baseAttrs'],
    rewards,
})
const art = (id: string): Reward => ({ type: 'artifact', id, name: id, description: '', tags: [] })
const pas = (id: string): Reward => ({ type: 'passive', id, name: id, description: '', tags: [] })

const golden = JSON.parse(
    readFileSync(join(__dirname, '__fixtures__', 'source-layer-golden.json'), 'utf-8'),
) as Record<string, Record<string, unknown>>
const stealable = ARTIFACTS.filter(
    (a) => !a.tags.includes('inherent') && !a.tags.includes('implant') && !a.tags.includes('imperial'),
)

// 偷取有概率（首偷 60%）→ 本文件相关用例把随机数钉成 0（必成），只验证层视图语义
beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('layersOf：来源层与战斗层的统一读视图', () => {
    it('不变式：所有来源层的实际生效量之和 == attrs − baseAttrs（316 个 build 全覆盖）', () => {
        const bad: string[] = []
        const check = (key: string, c: Character) => {
            const baseAttrs = c.build.baseAttrs as Record<string, number>
            const sum: Record<string, number> = {}
            for (const v of layersOf(c)) {
                if (v.origin !== 'source') continue
                for (const [attr, delta] of Object.entries(v.mods)) sum[attr] = (sum[attr] ?? 0) + delta
            }
            for (const a of ALL_ATTRS) {
                const baseVal = baseAttrs[a] ?? 3
                const want = c.attrs.get(a) - baseVal
                const got = sum[a] ?? 0
                if (Math.abs(want - got) > 1e-9) bad.push(`${key}.${a}: 层和 ${got} ≠ attrs−base ${want}`)
            }
        }
        for (const def of OPPONENTS) {
            for (const lv of [10, 20, 33]) check(`opp:${def.id}:${lv}`, new Character(gen(def, lv)))
        }
        for (const a of stealable) check(`art:${a.id}`, new Character(base([art(a.id)], 'A')))
        for (const p of PASSIVES) check(`pas:${p.id}`, new Character(base([pas(p.id)], 'A')))
        expect(Object.keys(golden).length).toBeGreaterThan(300)
        expect(bad).toEqual([])
    })

    it('来源层带 origin=source 与 sourceId；战斗层带 origin=battle（开战后可见）', () => {
        const c = new Character(base([art('iron_mask')], 'C'))
        const src = layersOf(c)
        expect(src.length).toBeGreaterThan(0)
        expect(src.every((v) => v.origin === 'source')).toBe(true)
        const iron = src.find((v) => v.id === 'artifact:iron_mask')
        expect(iron).toBeDefined()
        expect(iron!.mods).toEqual({ insight: 3, wisdom: 2 })

        // 开战前只传角色：看不到战斗层；开战后传 state：战斗层出现
        const other = new Character(base([pas('spirit_resonance')], 'D'))
        expect(layersOf(other).some((v) => v.id === 'passive:spirit_resonance')).toBe(true)
        const engine = new BattleEngine(c, other, 4)
        const all = layersOf(other, engine.state)
        const battle = all.filter((v) => v.origin === 'battle')
        expect(battle.some((v) => v.id === 'spirit_resonance_buff')).toBe(true)
        // 来源层仍然在（两个存储合并读）
        expect(all.some((v) => v.origin === 'source' && v.id === 'passive:spirit_resonance')).toBe(true)
    })

    it('探云手偷走后：来源层与它挂的战斗层都从视图里消失', () => {
        // 两件奇物分开测，避免"只偷第一件"带来的歧义
        const caseA = (() => {
            const thief = new Character(base([], 'A'))
            const victim = new Character(base([art('golden_silk_gloves')], 'B'))
            const engine = new BattleEngine(thief, victim, 4)
            expect(layersOf(victim, engine.state).some((v) => v.key === `silk_guard::B`)).toBe(true)
            processActionEffect({ type: 'steal_artifact' }, { self: thief, enemy: victim, engine, tMs: 100 })
            return { after: layersOf(victim, engine.state), thief: layersOf(thief, engine.state) }
        })()
        expect(caseA.after.some((v) => v.key === `silk_guard::B`)).toBe(false)
        expect(caseA.thief.some((v) => v.key === `silk_guard::A`)).toBe(true)

        const caseB = (() => {
            const thief = new Character(base([], 'A'))
            const victim = new Character(base([art('iron_mask')], 'B'))
            const engine = new BattleEngine(thief, victim, 4)
            expect(layersOf(victim).some((v) => v.id === 'artifact:iron_mask')).toBe(true)
            processActionEffect({ type: 'steal_artifact' }, { self: thief, enemy: victim, engine, tMs: 100 })
            return { after: layersOf(victim), thief: layersOf(thief) }
        })()
        expect(caseB.after.some((v) => v.id === 'artifact:iron_mask')).toBe(false)
        expect(caseB.thief.some((v) => v.id === 'artifact:iron_mask')).toBe(true)
    })
})
