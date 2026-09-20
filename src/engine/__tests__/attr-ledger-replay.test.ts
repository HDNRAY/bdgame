import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { processBuffEnd } from '../combat/effects/buff-end'
import { ALL_ATTRS } from '../entities/attributes'
import { getBuff } from '../../data/buffs'
import { dropBuffLayer } from '../combat/utils'
import { MAX_HP_PER_VIT } from '../calc/stats'
import { setLayerMods } from '../combat/utils/buff-layer'
import { vi } from 'vitest'
import type { CharacterBuild } from '../../game/entities/character-build'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

/**
 * 属性账：`attrs = base` 后**按序回放**（来源层 ops → 战斗层 mods），删条目即重算。
 *
 * 这一组钉住三个真实 bug：
 *  1. 夹取边界上的棘轮：按「实际生效量」平移会漂（初版方案 30−10=20，正确 29）。
 *  2. 战斗期属性 buff（内劲）被来源层重算抹掉、到期再扣一次（13 → 10 → 7）。
 *  3. 汲取扣掉的属性在对方重算时长回来（9 → 6 → 9）。
 */
/**
 * 中性探针来源：只挂一条不动属性的附着 buff（最大气血 +60），用来触发一次「来源层变动 → 重算」。
 * 构造期贡献现在全部收敛到 `add_buff`，没有单独的 `max_hp_mod` 效果类型了。
 */
const NEUTRAL_PROBE = { type: 'add_buff' as const, buffId: 'marrow_pump_hp' }

function makeChar(id: string, base = 10): Character {
    const build: CharacterBuild = {
        id,
        name: id,
        weapon: 'bare_hands',
        battleStyle: 'clinch',
        baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, base])) as CharacterBuild['baseAttrs'],
        rewards: [],
    }
    return new Character(build)
}

describe('属性账按序回放', () => {
    it('夹取边界不漂：base 9 + A(+10) + B(+20)，撤 A = 29', () => {
        // 用真实附着 buff 当砝码：每层力道 +2（attrMods 折进来源层账）
        const per = getBuff('titanium_arm_attr')!.attrMods!.strength
        const a10 = { type: 'add_buff' as const, buffId: 'titanium_arm_attr', stacks: 10 / per }
        const b20 = { type: 'add_buff' as const, buffId: 'titanium_arm_attr', stacks: 20 / per }
        const c = makeChar('A', 9)
        expect(c.attrs.get('strength')).toBe(9) // 赤手空拳不动力道
        c.addSource('s:A', 'passive', [a10])
        expect(c.attrs.get('strength')).toBe(19)
        c.addSource('s:B', 'passive', [b20])
        expect(c.attrs.get('strength')).toBe(30) // 被上限夹住
        c.removeSource('s:A')
        expect(c.attrs.get('strength')).toBe(29) // 从 base 回放：9 + 20
        // 反复增删同一来源不漂
        for (let i = 0; i < 5; i++) {
            c.addSource('s:A', 'passive', [a10])
            c.removeSource('s:A')
        }
        expect(c.attrs.get('strength')).toBe(29)
    })

    it('战斗期属性 buff（内劲这类）：来源层重算不吞属性，到期只扣一次', () => {
        const a = makeChar('A')
        const b = makeChar('B')
        const engine = new BattleEngine(a, b, 4)
        const start = a.attrs.get('strength')
        // 一条战斗期的属性条目（请求值 +3），与数据里带时长的具名属性 buff 同形
        engine.state.pendingBuffs.set('probe_buff::A', {
            restoreValue: 1,
            mods: { strength: 3 },
            modsPerStack: { strength: 3 },
        })
        a.rebuildDerived(engine.state)
        const buffed = a.attrs.get('strength')
        expect(buffed).toBe(start + 3)

        // 战斗中撤掉一个来源（探云手偷奇物那条路径）：战斗层属性必须留着
        a.addSource('probe', 'passive', [NEUTRAL_PROBE])
        a.removeSource('probe', engine.state)
        expect(a.attrs.get('strength')).toBe(buffed)

        dropBuffLayer(engine.state, 'probe_buff::A')
        expect(a.attrs.get('strength')).toBe(start) // 只扣一次，不是 start - 3
    })

    it('汲取：被汲取方重算不长回来，到期双方一起还原', () => {
        const a = makeChar('A')
        const b = makeChar('B')
        const engine = new BattleEngine(a, b, 4)
        const before = b.attrs.get('strength')
        processActionEffect(
            { type: 'stat_transfer', stat: 'strength', value: 3, duration: 5000 },
            { self: a, enemy: b, engine, tMs: 100 },
        )
        expect(b.attrs.get('strength')).toBe(before - 3)
        expect(a.attrs.get('strength')).toBe(before + 3)

        // 被汲取方触发一次重算（来源层变动）：掉掉的属性不能长回来
        b.addSource('probe', 'passive', [NEUTRAL_PROBE])
        b.removeSource('probe', engine.state)
        expect(b.attrs.get('strength')).toBe(before - 3)

        const key = [...engine.state.pendingBuffs.keys()].find(
            (k) => k.startsWith('stat_transfer::') && k.split('::')[1] === a.id,
        )!
        const drainKey = [...engine.state.pendingBuffs.keys()].find((k) => k.startsWith('stat_transfer_drain::'))!
        processBuffEnd(key, engine)
        processBuffEnd(drainKey, engine)
        expect(a.attrs.get('strength')).toBe(before)
        expect(b.attrs.get('strength')).toBe(before)
    })

    it('动态属性修正：根骨↑按口径回血、轮离根骨按比例掉血（七十二变那类）', () => {
        const a = makeChar('A')
        const engine = new BattleEngine(a, makeChar('B'), 4)
        // 造一条"七十二变式"的动态属性层：先给体质，再换到身法
        engine.state.pendingBuffs.set('dyn::A', { restoreValue: 0, mods: {}, modsPerStack: {} })
        const layer = engine.state.pendingBuffs.get('dyn::A')!
        a.hp = Math.round(a.maxHp * 0.5) // 半血，便于观察比例
        const hpBefore = a.hp
        const maxBefore = a.maxHp

        setLayerMods(layer, a, engine.state, { vitality: 6 })
        expect(a.maxHp).toBeGreaterThan(maxBefore)
        // 旧 applyAttrMods 口径：新上限 − Δ根骨×每点根骨气血 估旧上限，比例 ≥1 即回满
        const ratio = hpBefore / (a.maxHp - 6 * MAX_HP_PER_VIT)
        expect(a.hp).toBe(Math.round(a.maxHp * Math.min(ratio, 1)))

        const hpAfterBuff = a.hp
        const maxAfterBuff = a.maxHp
        setLayerMods(layer, a, engine.state, { agility: 6 })
        expect(a.maxHp).toBe(maxBefore)
        // 旧 revertBuffMods 口径：按新上限/旧上限比例掉血（保底 1）
        expect(a.hp).toBe(Math.max(1, Math.round(hpAfterBuff * (maxBefore / maxAfterBuff))))
    })

    it('概率限制器只在施加时掷一次：重算不消耗随机数、不改变结果', () => {
        const draws: number[] = []
        const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
            draws.push(1)
            return 0.9 // > 0.5 → 限制器不拦
        })
        try {
            const a = makeChar('A')
            // 玄机那类：50% 挡下推演降低
            // 菩提头环那类：50% 挡下推演降低（限制器回调存在 `pu_ti_tou_huan_guard` 上）
            a.addSource('restrict', 'passive', [{ type: 'add_buff', buffId: 'pu_ti_tou_huan_guard' }])
            const engine = new BattleEngine(a, makeChar('B'), 4)
            engine.state.pendingBuffs.set('probe::A', { restoreValue: 1, mods: { wisdom: -1 } })
            a.rebuildDerived(engine.state)
            const afterApply = a.attrs.get('wisdom')
            const drawsAfterApply = draws.length
            expect(afterApply).toBe(makeChar('A').attrs.get('wisdom') - 1)
            // 反复重算：不掷骰、结果不变
            for (let i = 0; i < 5; i++) a.rebuildDerived(engine.state)
            expect(draws.length).toBe(drawsAfterApply)
            expect(a.attrs.get('wisdom')).toBe(afterApply)
        } finally {
            spy.mockRestore()
        }
    })

    it('换武：账、weaponDef、属性三者一致，之后重算不回滚', () => {
        const a = makeChar('A')
        const b = makeChar('B')
        const engine = new BattleEngine(a, b, 4)
        expect(a.currentWeaponId).toBe('bare_hands')
        processActionEffect(
            { type: 'switch_weapon', weaponId: 'yanling_blade' },
            { self: a, enemy: b, engine, tMs: 100 },
        )
        expect(a.currentWeaponId).toBe('yanling_blade')
        expect(a.weaponDef?.id).toBe('yanling_blade')
        expect(a.sourceLayers.map((l) => l.sourceId)).toEqual(['weapon:yanling_blade'])
        const switched = a.attrs.getAll()

        // 任何一次后续重算都不许把换武回滚（旧实现账里仍是旧武器 → 重算后 weaponDef 变回赤手空拳）
        a.addSource('probe', 'passive', [NEUTRAL_PROBE])
        a.removeSource('probe', engine.state)
        expect(a.weaponDef?.id).toBe('yanling_blade')
        expect(a.attrs.getAll()).toEqual(switched)
    })
})
