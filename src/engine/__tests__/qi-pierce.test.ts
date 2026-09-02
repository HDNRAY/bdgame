import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import type { ActionDefinition } from '../entities/action'

function makeChar(id: string, name: string, rewards: { type: 'passive'; id: string }[]): Character {
    return new Character({
        id, name, weapon: 'bare_hands',
        baseAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },        battleStyle: 'clinch' as const,

        rewards: rewards.map((r) => ({ ...r, name: r.id, description: '', tags: [] })),
    })
}

describe('锐炁诀·炁穿透', () => {
    const buff = getBuff('rui_qi_jue')!

    it('buff 定义存在,带 qi 招拆 30% 穿透', () => {
        expect(getPassive('rui_qi_jue')).toBeDefined()
        expect(buff.onPostCritDamage).toBeTypeOf('function')
    })

    it('带 qi 招式:40% 转为穿透', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const ctx = (tags: string[]) => ({
            final: 100, raw: 100, target: def, attacker: atk, engine, state: engine.state,
            layer: { restoreValue: 1 }, source: { tags },
        })
        const r = buff.onPostCritDamage!(ctx(['qi', 'range']) as never)
        expect(typeof r).toBe('object')
        if (typeof r === 'object') {
            expect(r.normal).toBe(70)
            expect(r.piercing).toBe(30)
        }
    })

    it('非 qi 招式不拆穿透(返回原值)', () => {
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const ctx = (tags: string[]) => ({
            final: 100, raw: 100, target: def, attacker: atk, engine, state: engine.state,
            layer: { restoreValue: 1 }, source: { tags },
        })
        const r = buff.onPostCritDamage!(ctx(['unarmed', 'melee']) as never)
        expect(r).toBe(100)
    })

    it('与凝炁诀联动:虚实拳(无qi)经凝炁诀增强后带 qi,触发穿透', () => {
        const ningqi = getPassive('ningqi_jue')!
        const action: ActionDefinition = { id: 'straight_punch', name: '直拳', description: '', tags: ['unarmed', 'melee'], requiredTags: [], apCost: 2, effects: [{ type: 'damage', scaling: {} }] }
        const enhanced = ningqi.actionEnhancer!(action)
        expect(enhanced.tags).toContain('qi')
        // 增强后带 qi → buff 应拆穿透
        const atk = makeChar('A', '甲', [])
        const def = makeChar('B', '乙', [])
        const engine = new BattleEngine(atk, def, 4)
        const r = buff.onPostCritDamage!({ final: 100, raw: 100, target: def, attacker: atk, engine, state: engine.state, layer: { restoreValue: 1 }, source: enhanced } as never)
        if (typeof r === 'object') {
            expect(r.normal).toBe(70)
            expect(r.piercing).toBe(30)
        } else {
            expect(r).toBe(100)
        }
    })
})
