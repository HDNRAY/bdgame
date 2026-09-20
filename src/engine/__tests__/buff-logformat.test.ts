import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { runBattle } from '../battle-runner'
import { getBuff } from '../../data/buffs'
import { ALL_ATTRS } from '../entities/attributes'
import type { LogEvent } from '../combat/log-events'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

function makeChar(id: string, rewards: Character['build']['rewards'] = []): Character {
    return new Character({
        id,
        name: id,
        weapon: 'peach_sword',
        battleStyle: 'clinch',
        baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, 10])) as Character['build']['baseAttrs'],
        rewards,
    })
}

/** 从引擎**存下来的**日志里取系统行：构造期（开局物化）的消息早于 onLog 监听器注册，只能用这个读 */
const sysLines = (engine: BattleEngine): string[] =>
    engine.state.log
        .getAll()
        .map((e) => e.event as LogEvent)
        .filter((e) => e.type === 'system')
        .map((e) => (e as { message: string }).message)

describe('buff 的 logFormat', () => {
    it('add_buff 建层日志用 logFormat 覆盖描述（并带上持有者的真实数值）', () => {
        const me = makeChar('a')
        me.attrs.set('dexterity', 25) // 25 × 0.04 = 1
        const foe = makeChar('b')
        const engine = new BattleEngine(me, foe, 4, false)
        processActionEffect({ type: 'add_buff', buffId: 'yue_nv_buff' }, { self: me, enemy: foe, engine, tMs: 0 })

        const line = sysLines(engine).find((m) => m.includes('越女剑意'))
        expect(line).toBeDefined()
        expect(line).toContain('附加灵巧×0.04 = 1') // logFormat 的数值段
        expect(line).not.toContain('白猿授剑') // 描述被覆盖
    })

    it('开局物化的附着 buff 同样走 logFormat（越女剑法 → 越女剑意）', () => {
        const me = makeChar('me', [{ type: 'passive', id: 'yue_nv_sword', name: '越女剑法', description: '', tags: [] }])
        const foe = makeChar('foe')
        const { engine } = runBattle(me, foe, undefined, 4, false) // quiet=false：quiet 模式不建日志

        const line = sysLines(engine).find((m) => m.includes('越女剑意'))
        expect(line).toBeDefined()
        expect(line).toContain('附加灵巧×0.04 = 0.4') // 灵巧 10 × 0.04
    })

    it('不滞于物：logFormat 报四维最高者 ×0.05 与缠劲代价', () => {
        const me = makeChar('a')
        me.attrs.set('strength', 30) // 四维最高 30 → 1.5
        const foe = makeChar('b')
        const engine = new BattleEngine(me, foe, 4, false)
        processActionEffect({ type: 'add_buff', buffId: 'bu_zhi_yu_wu' }, { self: me, enemy: foe, engine, tMs: 0 })

        const line = sysLines(engine).find((m) => m.includes('不滞于物'))
        expect(line).toBeDefined()
        expect(line).toContain('（30）×0.05 = 1.5')
        expect(line).toContain('每次命中消耗1缠劲')
    })

    it('没写 logFormat 的 buff 照旧用描述（不回归）', () => {
        const me = makeChar('a')
        const foe = makeChar('b')
        const engine = new BattleEngine(me, foe, 4, false)
        processActionEffect({ type: 'add_buff', buffId: 'chill_blade' }, { self: me, enemy: foe, engine, tMs: 0 })

        expect(getBuff('chill_blade')!.logFormat).toBeUndefined()
        const line = sysLines(engine).find((m) => m.includes('寒锋'))
        expect(line).toContain('每层伤害+8%') // 描述原文
    })
})
