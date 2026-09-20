import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import { rng } from '../util/rng'

const buff = getBuff('elemental_immunity')!

function makeChar(id: string, name: string): Character {
    return new Character({
        id,
        name,
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 8 },
        battleStyle: 'melee' as const,
        rewards: [],
    })
}

/** 走一次 onReceiveDebuff：0 = 完全免疫，undefined = 不干预，>0 = 削到该层数 */
function receive(buffId: string, stacks = 2): number | undefined {
    const me = makeChar('A', '甲')
    const foe = makeChar('B', '乙')
    const engine = new BattleEngine(me, foe, 4, false)
    return buff.onReceiveDebuff!({
        self: me,
        enemy: foe,
        engine,
        state: engine.state,
        stacks,
        buffId,
        layer: undefined,
    } as never)
}

describe('冰心 · 减益免疫', () => {
    it('霜冻 100% 免疫', () => {
        expect(receive('frost')).toBe(0)
    })

    it('麻痹/灼烧/不幸/迷惑 各 50% 几率免疫（返回 0 或 undefined）', () => {
        rng.seedMain(2024)
        for (const id of ['paralyze', 'burn', 'bu_xing', 'confuse']) {
            let immune = 0
            const N = 4000
            for (let i = 0; i < N; i++) {
                const r = receive(id)
                expect(r === 0 || r === undefined).toBe(true)
                if (r === 0) immune++
            }
            expect(immune / N).toBeCloseTo(0.5, 1) // 约一半被免疫
        }
    })

    it('不在名单里的减益（中毒/流血等）不干预', () => {
        for (const id of ['poison', 'bleed', 'weakness']) {
            expect(receive(id)).toBeUndefined()
        }
    })

    it('冰心诀不给属性：不带属性修正（暂时只保留免疫）', () => {
        expect(getPassive('ice_heart')).toBeDefined()
        expect(buff.attrMods).toBeUndefined()
        const plain = makeChar('A', '甲')
        const withIce = new Character({
            id: 'B',
            name: '乙',
            weapon: 'peach_sword',
            baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 8 },
            battleStyle: 'melee' as const,
            rewards: [{ type: 'passive', id: 'ice_heart', name: '冰心诀', description: '', tags: [] }],
        })
        expect(withIce.attrs.get('vitality')).toBeCloseTo(plain.attrs.get('vitality'))
    })
})
