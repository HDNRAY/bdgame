import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { forEachBuffOf } from '../combat/utils'
import { runtimeSlotsOf } from '../entities/trigger'
import { ARTIFACTS, getArtifact } from '../../data/artifacts'
import { ALL_ATTRS } from '../entities/attributes'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Reward } from '../../game/entities/reward'

/**
 * 探云手偷奇物：被偷的人必须**彻底失去**这件奇物带来的一切。
 *
 * 偷取有概率（首偷 60%，成功后减半），本文件的用例只验证"偷到之后"的语义，
 * 所以统一把随机数钉成 0（< 0.6 → 必成），避免随概率变成 flaky。
 *
 * 以前只删了 `artifactDefs` / triggers / 招式，构造期属性修正和触发挂上的 buff 都留在受害者身上，
 * 而小偷照拿一份 → 实测「双方都有 +15% 招架」「双方属性都 +3 洞察 +2 推演」。现在：
 * 构造期修正走来源层账（`removeSource`），触发挂的 buff 按奇物 triggers 里的 add_buff 逐个撤。
 */
function makeChar(id: string, rewards: Reward[] = []): Character {
    return new Character({
        id,
        name: id,
        weapon: 'bare_hands',
        battleStyle: 'clinch',
        baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, 10])) as CharacterBuild['baseAttrs'],
        rewards,
    })
}
const reward = (id: string): Reward => ({ type: 'artifact', id, name: id, description: '', tags: [] })
const snap = (c: Character) => ({
    attrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, c.attrs.get(a)])),
    maxHpMod: c.maxHpMod,
    maxApMod: c.maxApMod,
    triggerSlotMod: c.triggerSlotMod,
    maxHp: c.maxHp,
    maxAp: c.maxAp,
    weaponTags: [...(c.weaponDef?.tags ?? [])].sort(),
})
const parryBonus = (c: Character, engine: BattleEngine) => {
    let sum = 0
    forEachBuffOf(engine.state.pendingBuffs, c.id, (def) => {
        if (def?.onParryChance) sum += def.onParryChance({} as never)
    })
    return sum
}
/** 该奇物运行时槽里声明的 add_buff 目标（盗走后应当从受害者身上消失） */
const grantedBuffIds = (artifactId: string) => {
    const def = getArtifact(artifactId)!
    const out = new Set<string>()
    for (const t of runtimeSlotsOf(def)) {
        for (const e of t.apply ?? []) if (e.type === 'add_buff' && e.buffId) out.add(e.buffId)
    }
    return [...out]
}
const layerIdsOf = (c: Character, engine: BattleEngine) => {
    const out: string[] = []
    forEachBuffOf(engine.state.pendingBuffs, c.id, (_def, _layer, buffId) => {
        out.push(buffId)
    })
    return out.sort()
}
const stealable = ARTIFACTS.filter(
    (a) => !a.tags.includes('inherent') && !a.tags.includes('implant') && !a.tags.includes('imperial'),
)

beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0))
afterEach(() => vi.restoreAllMocks())

describe('探云手：偷走后受害者不再持有该奇物的一切', () => {
    it('触发挂 buff 型（金丝手套）：受害者失去金丝护手与招架加成，小偷拿到', () => {
        const thief = makeChar('A')
        const victim = makeChar('B', [reward('golden_silk_gloves')])
        const engine = new BattleEngine(thief, victim, 4)
        expect(engine.state.pendingBuffs.has(`silk_guard::${victim.id}`)).toBe(true)
        expect(parryBonus(victim, engine)).toBeCloseTo(0.15)

        processActionEffect({ type: 'steal_artifact' }, { self: thief, enemy: victim, engine, tMs: 100 })

        expect(victim.artifactDefs.some((a) => a.id === 'golden_silk_gloves')).toBe(false)
        expect(engine.state.pendingBuffs.has(`silk_guard::${victim.id}`)).toBe(false)
        expect(parryBonus(victim, engine)).toBe(0)
        // 小偷拿到奇物与 buff（不再出现"两边都有"）
        expect(thief.artifactDefs.some((a) => a.id === 'golden_silk_gloves')).toBe(true)
        expect(engine.state.pendingBuffs.has(`silk_guard::${thief.id}`)).toBe(true)
        expect(parryBonus(thief, engine)).toBeCloseTo(0.15)
        // 小偷这层带来源标记（bySource 索引可用：将来缴械/被偷回可整来源撤销）
        expect(engine.state.pendingBuffs.get(`silk_guard::${thief.id}`)?.originId).toBe(
            'artifact:golden_silk_gloves',
        )
        expect(engine.state.pendingBuffs.keysOfOrigin('artifact:golden_silk_gloves')).toEqual([
            `silk_guard::${thief.id}`,
        ])
    })

    it('构造期属性型（机巧面具）：受害者属性精确回退，小偷单独获得', () => {
        const thief = makeChar('A')
        const victim = makeChar('B', [reward('iron_mask')])
        const engine = new BattleEngine(thief, victim, 4)
        const before = snap(victim)
        const plain = makeChar('B')
        expect(before.attrs).not.toEqual(snap(plain).attrs)

        processActionEffect({ type: 'steal_artifact' }, { self: thief, enemy: victim, engine, tMs: 100 })

        // 受害者 == 从未持有
        expect(snap(victim)).toEqual(snap(plain))
        // 小偷获得了同样的加成（一份，不是两份）
        expect(snap(thief).attrs).toEqual(before.attrs)
    })

    it('全部 50 件可偷奇物：偷完后受害者 == 从未持有（属性/派生值/该奇物挂的 buff）', () => {
        const diffs: string[] = []
        for (const a of stealable) {
            const thief = makeChar('A')
            const victim = makeChar('B', [reward(a.id)])
            const engine = new BattleEngine(thief, victim, 4)
            const plain = makeChar('B')
            processActionEffect({ type: 'steal_artifact' }, { self: thief, enemy: victim, engine, tMs: 100 })
            const left = snap(victim) as Record<string, unknown>
            const target = snap(plain) as Record<string, unknown>
            for (const field of Object.keys(target)) {
                if (JSON.stringify(left[field]) !== JSON.stringify(target[field])) {
                    diffs.push(`${a.id}.${field}: ${JSON.stringify(left[field])} ≠ ${JSON.stringify(target[field])}`)
                }
            }
            const leftover = layerIdsOf(victim, engine).filter((b) => grantedBuffIds(a.id).includes(b))
            if (leftover.length > 0) diffs.push(`${a.id}: 仍残留 buff 层 ${leftover.join(',')}`)
        }
        expect(stealable.length).toBe(50)
        expect(diffs).toEqual([])
    })
})

describe('探云手：偷取概率（首偷 60%，成功后减半）', () => {
    function setup() {
        const thief = makeChar('A')
        const victim = makeChar('B', [reward('iron_mask')])
        const engine = new BattleEngine(thief, victim, 4)
        return { thief, victim, engine }
    }
    it('随机数 < 0.6 → 首次得手，并把下次概率降到 0.3', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.59)
        const { thief, victim, engine } = setup()
        processActionEffect({ type: 'steal_artifact' }, { self: thief, enemy: victim, engine, tMs: 100 })
        expect(victim.artifactDefs.some((a) => a.id === 'iron_mask')).toBe(false)
        expect(engine.state.pendingBuffs.get(`steal_artifact_track::${thief.id}`)?.restoreValue).toBe(0.3)
        spy.mockRestore()
    })
    it('随机数 ≥ 0.6 → 首次失手，奇物不动、概率不降', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.61)
        const { thief, victim, engine } = setup()
        processActionEffect({ type: 'steal_artifact' }, { self: thief, enemy: victim, engine, tMs: 100 })
        expect(victim.artifactDefs.some((a) => a.id === 'iron_mask')).toBe(true)
        expect(engine.state.pendingBuffs.get(`steal_artifact_track::${thief.id}`)).toBeUndefined()
        spy.mockRestore()
    })
})
