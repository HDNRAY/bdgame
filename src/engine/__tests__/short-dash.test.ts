import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { getWeapon } from '../../data/weapons/weapons'
import { getActionRange } from '../../data/actions'
import { canExecuteAction } from '../calc/action-executor'
import type { ActionDefinition } from '../entities/action'

const mk = (id: string, name: string) =>
    new Character({
        id,
        name,
        weapon: 'bare_hands',
        battleStyle: 'melee' as const,
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        rewards: [],
    })

/** 带 short_dash 的假招:射程 [1,2],dash 1 */
const fakeAction = {
    id: 'x',
    name: 'x',
    description: '',
    requiredTags: [] as string[],
    apCost: 2,
    tags: [] as string[],
    effects: [{ type: 'short_dash', maxDistance: 1 }, { type: 'damage', scaling: { strength: 0.5 } }],
} as unknown as ActionDefinition

describe('short_dash 双向垫步', () => {
    it('getActionRange 下限也随 dash 扩展(贴脸够得到)', () => {
        expect(getActionRange(fakeAction, [1, 2])).toEqual([0, 3])
        // 无 dash 招下限不扩展
        const plain = { ...fakeAction, effects: [{ type: 'damage', scaling: { strength: 0.5 } }] } as never
        expect(getActionRange(plain, [1, 2])).toEqual([1, 2])
    })

    it('dist 超上限 → 前冲入射程', () => {
        const self = mk('a', '甲')
        const enemy = mk('b', '乙')
        self.weaponDef = { ...getWeapon('bare_hands'), range: [1, 2] as [number, number] }
        const engine = new BattleEngine(self, enemy, 3, true)
        processActionEffect({ type: 'short_dash', maxDistance: 1 }, { self, enemy, engine, tMs: 0 })
        expect(engine.state.position.distance(self.id, enemy.id)).toBeCloseTo(2)
    })

    it('dist 低于下限(贴脸) → 后撤入射程', () => {
        const self = mk('a', '甲')
        const enemy = mk('b', '乙')
        self.weaponDef = { ...getWeapon('bare_hands'), range: [1, 2] as [number, number] }
        const engine = new BattleEngine(self, enemy, 0, true)
        processActionEffect({ type: 'short_dash', maxDistance: 1 }, { self, enemy, engine, tMs: 0 })
        expect(engine.state.position.distance(self.id, enemy.id)).toBeCloseTo(1)
    })

    it('在下限~上限之间 → 不冲', () => {
        const self = mk('a', '甲')
        const enemy = mk('b', '乙')
        self.weaponDef = { ...getWeapon('bare_hands'), range: [1, 2] as [number, number] }
        const engine = new BattleEngine(self, enemy, 1.5, true)
        processActionEffect({ type: 'short_dash', maxDistance: 1 }, { self, enemy, engine, tMs: 0 })
        expect(engine.state.position.distance(self.id, enemy.id)).toBeCloseTo(1.5)
    })

    it('贴脸 0m 时带 dash 招 canExecute 放行(靠后撤)', () => {
        const self = mk('a', '甲')
        const enemy = mk('b', '乙')
        self.weaponDef = { ...getWeapon('bare_hands'), range: [1, 2] as [number, number] }
        const engine = new BattleEngine(self, enemy, 0, true)
        expect(canExecuteAction(fakeAction, self, engine.state).ok).toBe(true)
    })
})
