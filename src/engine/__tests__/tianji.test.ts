import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { getBuff } from '../../data/buffs'
import { YIDAO } from '../../data/opponents/yidao'
import { gen } from '../../data/opponents/index'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { AttrName } from '../entities/attributes'
import type { ActionDefinition } from '../entities/action'
import type { BuffLayer } from '../combat/types'

/**
 * 天机（袖里玄机满层的一次性强化）：只认**玩家主动出手的主招**。
 *
 * 回归点：`isMainMove` 原先只看标签（排除 pre/post/summon），触发招也是普通标签 → 判定通过。
 * 而玄机是靠**触发**攒的，于是「攒满 9 层 → 下一发自动反击把天机吃掉」，
 * 玩家自己选的那一招永远吃不到。现在三条钩子都带上 `ctx.triggered`，触发招既不吃也不消耗。
 */
const tianji = getBuff('tianji_ready')!

function makeChar(): Character {
    const build: CharacterBuild = {
        id: 'a',
        name: '甲',
        story: 'balanced',
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 14, insight: 10, wisdom: 20 } as Partial<Record<AttrName, number>>,
        battleStyle: 'clinch',
        rewards: [{ id: 'straight_punch', name: '直拳', type: 'action', description: '', tags: [] }],
    }
    return new Character(build)
}

function setup() {
    const a = makeChar()
    const b = new Character(gen(YIDAO, 33))
    const engine = new BattleEngine(a, b, 1, true)
    processActionEffect({ type: 'add_buff', buffId: 'xuan_ji', stacks: 9 }, { self: a, enemy: b, engine, tMs: 0 })
    return { a, b, engine }
}

const hasTianji = (a: Character, engine: BattleEngine) => engine.state.pendingBuffs.has(`tianji_ready::${a.id}`)
const xuanji = (a: Character, engine: BattleEngine) => engine.state.pendingBuffs.get(`xuan_ji::${a.id}`)?.restoreValue ?? 0

/** 钩子口径：ctx.triggered 决定算不算「主招」 */
/** onCanBeParried 的 ctx 形状与 BuffHookCtx 不同（只有 self/engine/source/triggered） */
const parryCtx = (source: Partial<ActionDefinition>, triggered: boolean) =>
    ({
        self: {} as never,
        engine: {} as never,
        source: { tags: [], apCost: 2, ...source } as ActionDefinition,
        triggered,
    })

const hookCtx = (source: Partial<ActionDefinition>, triggered: boolean, layer: BuffLayer) =>
    ({
        final: 0,
        raw: 0,
        target: {} as never,
        attacker: {} as never,
        state: {} as never,
        layer,
        source: { tags: [], apCost: 2, ...source } as ActionDefinition,
        triggered,
    })

describe('天机：只认主动主招', () => {
    it('玄机 9 层 → 天机就绪', () => {
        const { a, engine } = setup()
        expect(xuanji(a, engine)).toBe(9)
        expect(hasTianji(a, engine)).toBe(true)
    })

    it('触发招：必中/必暴/无视招架全部不生效', () => {
        const layer = { restoreValue: 1 }
        expect(tianji.onHitChance!(hookCtx({ tags: ['melee'] }, true, layer))).toBe(0)
        expect(tianji.onCritChance!(hookCtx({ tags: ['melee'] }, true, layer))).toBe(0)
        expect(tianji.onCanBeParried!(parryCtx({ tags: ['melee'] }, true))).toBe(true)
    })

    it('主动主招：三个钩子都生效', () => {
        const layer = { restoreValue: 1 }
        expect(tianji.onHitChance!(hookCtx({ tags: ['melee'] }, false, layer))).toBe(1)
        expect(tianji.onCritChance!(hookCtx({ tags: ['melee'] }, false, layer))).toBe(1)
        expect(tianji.onCanBeParried!(parryCtx({ tags: ['melee'] }, false))).toBe(false)
    })

    it('辅助招（pre/post）无论是否触发都不算主招', () => {
        const layer = { restoreValue: 1 }
        expect(tianji.onHitChance!(hookCtx({ tags: ['pre_action'] }, false, layer))).toBe(0)
        expect(tianji.onHitChance!(hookCtx({ tags: ['post_action'] }, true, layer))).toBe(0)
    })

    it('触发招实战中打出去：天机不被消耗，玄机保留', () => {
        const { a, b, engine } = setup()
        a.passiveTriggers.push({ condition: { type: 'on_dodge' }, actionId: 'straight_punch' })
        engine.emit('on_dodge', a, b)
        expect(hasTianji(a, engine), '天机应还留着').toBe(true)
        expect(xuanji(a, engine), '玄机仍是 9').toBe(9)
    })

    it('主动出招：天机被消耗，玄机归零', () => {
        const { a, engine } = setup()
        // execute 是私有的：用公开的 runEvent 驱动回合（plan 直接给一条出招指令）；
        // 首个事件可能是系统 tick，所以循环推进到出招发生
        for (let i = 0; i < 10 && hasTianji(a, engine); i++) {
            engine.runEvent(() => [{ type: 'attack', actionId: 'straight_punch' }])
        }
        expect(hasTianji(a, engine)).toBe(false)
        expect(xuanji(a, engine)).toBe(0)
    })
})
