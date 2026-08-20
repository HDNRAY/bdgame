import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import { Character } from '../entities/character'
import { getBuff } from '../../data/buffs'
import { processActionEffect } from '../combat/effects'
import type { BuffLayer } from '../combat/types'

function makeChar(
    id: string,
    name: string,
    attrs: Record<string, number>,
    rewards: unknown[],
    weapon = 'bare_hands',
): Character {
    return new Character({
        id,
        name,
        story: 'balanced',
        weapon,
        baseAttrs: attrs,
        rewards: rewards as never[],
    })
}

const PUNCH = { type: 'action', id: 'straight_punch', name: 'x', description: '', tags: [] }
const SHEN = { type: 'passive', id: 'ru_shen_zuo_zhao', name: 'x', description: '', tags: [] }
const NOLIGHT = { type: 'passive', id: 'no_light_wisdom', name: 'x', description: '', tags: [] }

describe('神照（入神坐照）', () => {
    function setup(rewards: unknown[]) {
        const p = makeChar(
            'p',
            'P',
            { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
            [PUNCH, ...rewards],
        )
        const o = makeChar('o', 'O', { strength: 8, vitality: 8, agility: 6, dexterity: 6, insight: 4, wisdom: 3 }, [
            PUNCH,
        ])
        const e = new BattleEngine(p, o, 4)
        return { engine: e, p, o }
    }

    function shenLayer(e: BattleEngine, id: string): BuffLayer | undefined {
        return e.state.pendingBuffs.get(`shen_zhao::${id}`)
    }

    function spend(e: BattleEngine, charId: string, amount: number): void {
        const def = getBuff('shen_zhao')
        const layer = e.state.pendingBuffs.get(`shen_zhao::${charId}`)!
        const self = e.getCharacter(charId)!
        def!.onApSpent!({ self, amount, engine: e, state: e.state, layer })
    }

    it('四档累计洞察 +2/+4/+6/+6，第4档后迷眼被拦截', () => {
        const { engine: e, p } = setup([SHEN])
        const baseInsight = p.attrs.get('insight')

        spend(e, p.id, 25)
        expect(p.attrs.get('insight')).toBe(baseInsight + 2)
        spend(e, p.id, 25)
        expect(p.attrs.get('insight')).toBe(baseInsight + 4)
        spend(e, p.id, 25)
        expect(p.attrs.get('insight')).toBe(baseInsight + 6)
        spend(e, p.id, 25)
        expect(p.attrs.get('insight')).toBe(baseInsight + 6) // 第4档不再加洞察
        expect(shenLayer(e, p.id)!.extra!.stage).toBe(4)

        // 第4档后：迷眼（洞察-4）被 stat_restriction 拦截
        const before = p.attrs.get('insight')
        const o = e.getCharacter('o')!
        const eff = { type: 'add_debuff', buffId: 'sand_blind', stacks: 1, chance: 1 }
        processActionEffect(eff as never, { self: o, enemy: p, engine: e, tMs: e.state.eventTime } as never)
        expect(p.attrs.get('insight')).toBe(before)
        // 迷眼层被建了吗？attrMods 全拦 → 层存在但无减益（或层建了但属性未降）
        const sand = e.state.pendingBuffs.get(`sand_blind::${p.id}`)
        expect(sand).toBeDefined()
        expect(p.attrs.get('insight')).toBe(before)
    })

    it('未满4档时迷眼仍生效', () => {
        const { engine: e, p } = setup([SHEN])
        spend(e, p.id, 25) // 只到第1档
        const before = p.attrs.get('insight')
        const o = e.getCharacter('o')!
        const eff = { type: 'add_debuff', buffId: 'sand_blind', stacks: 1, chance: 1 }
        processActionEffect(eff as never, { self: o, enemy: p, engine: e, tMs: e.state.eventTime } as never)
        expect(p.attrs.get('insight')).toBe(before - 4)
    })

    it('无明之明的洞察-4不受神照免疫影响', () => {
        // 无明之明在构造期 stat_buff -4，state 无 → stat_restriction 不拦
        const { p } = setup([SHEN, NOLIGHT])
        // 构造时 -4 已生效（相对 base 10 → 6，神照未累计阶段仍为0）
        expect(p.attrs.get('insight')).toBe(6)
    })
})
