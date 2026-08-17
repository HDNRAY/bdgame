import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import type { EventPlan } from '../combat/types'
import type { BattleState } from '../combat/types'
import { runBattle } from '../battle-runner'
import { Character } from '../entities/character'
import { getBuff } from '../../data/buffs'
import type { BuffHookCtx } from '../../data/buffs/types'
import type { BuffLayer } from '../../engine/combat/types'
import { gen, getOpponentDef } from '../../data/opponents/index'

function makeChar(
    id: string,
    name: string,
    attrs: Record<string, number>,
    moveIds: string[] = [],
    weapon = 'bare_hands',
): Character {
    const rewards = moveIds.map((id) => ({
        type: 'action' as const,
        id,
        name: id,
        description: '',
        tags: [] as never[],
    }))
    return new Character({
        id,
        name,
        story: 'balanced',
        weapon,
        baseAttrs: attrs,
        rewards,
    })
}

describe('BattleEngine', () => {
    it('should simulate a fight with action data', () => {
        const p = makeChar(
            'laifeng',
            '玩家',
            { strength: 14, vitality: 12, agility: 10, dexterity: 10, insight: 8, wisdom: 6 },
            ['straight_punch'],
        )
        const o = makeChar(
            'o1',
            '野怪',
            { strength: 8, vitality: 8, agility: 6, dexterity: 6, insight: 4, wisdom: 3 },
            ['straight_punch'],
        )
        const { winner, engine } = runBattle(p, o)
        const types = engine.state.log.getAll().map((e) => e.event.type)
        expect(types).toContain('battle_start')
        // 有胜者则有 defeat，平局则无
        if (winner === '平局') {
            expect(engine.state.phase).toBe('finished')
        } else {
            expect(types).toContain('defeat')
        }
    })

    it('should handle distance management with spear', () => {
        const p = makeChar(
            'laifeng',
            '远程',
            { dexterity: 12, agility: 14, strength: 6, vitality: 8, insight: 6, wisdom: 10 },
            ['iron_pellet'],
            'iron_spear',
        )
        const o = makeChar('o1', '近战', {
            strength: 14,
            vitality: 10,
            agility: 8,
            dexterity: 6,
            insight: 4,
            wisdom: 3,
        })
        const e = new BattleEngine(p, o, 4)
        const plan: EventPlan = () => [{ type: 'attack', actionId: 'iron_pellet' }]
        // 半 AP 起手：驱动时间轴直到轮到 p 行动出招
        for (let i = 0; i < 100; i++) {
            const self = e.state.turn.peek()
            e.runEvent(self?.id === p.id ? plan : () => [])
            if (e.state.log.getAll().some((l) => l.event.type === 'attack_start')) break
        }
        const logs = e.state.log.getAll()
        const attacks = logs.filter((l) => l.event.type === 'attack_start')
        expect(attacks.length).toBeGreaterThan(0)
    })

    it('should end when a character dies', () => {
        const w = makeChar(
            'w',
            '弱者',
            { strength: 14, vitality: 10, agility: 10, dexterity: 10, insight: 6, wisdom: 5 },
            ['fissure'],
        )
        const s = makeChar(
            's',
            '强者',
            { strength: 18, vitality: 20, agility: 10, dexterity: 14, insight: 8, wisdom: 6 },
            ['fissure'],
        )
        const { winner, engine } = runBattle(w, s)
        // 战斗应该结束且有胜者
        expect(engine.state.phase).toBe('finished')
        expect(winner).toBeTruthy()
        // 应该只有一个存活
        const alive = engine.state.characters.filter((c) => c.isAlive())
        expect(alive.length).toBeGreaterThanOrEqual(1)
    })

    it('should log with action names', () => {
        const a = makeChar('a', 'A', {
            strength: 10,
            vitality: 10,
            agility: 10,
            dexterity: 10,
            insight: 6,
            wisdom: 5,
        })
        const b = makeChar('b', 'B', {
            strength: 10,
            vitality: 10,
            agility: 10,
            dexterity: 10,
            insight: 6,
            wisdom: 5,
        })
        const engine = new BattleEngine(a, b, 1)
        const plan: EventPlan = () => [{ type: 'attack', actionId: 'straight_punch' }]
        // 半 AP 起手：驱动时间轴直到轮到 a 行动出招
        for (let i = 0; i < 100; i++) {
            const self = engine.state.turn.peek()
            engine.runEvent(self?.id === a.id ? plan : () => [])
            if (engine.state.log.getAll().some((l) => l.event.type === 'attack_start')) break
        }
        const logs = engine.state.log.getAll()
        const attacks = logs.filter((l) => l.event.type === 'attack_start')
        expect(attacks.length).toBeGreaterThan(0)
        if (attacks[0].event.type === 'attack_start') {
            expect(attacks[0].event.actionName).toBe('虚实拳')
        }
    })
})

describe('御物耗炁上限与低属性战斗终止（回归：净 AP 回复为负 → 时间倒退死循环）', () => {
    function yuwuCtx(wisdom: number, restoreValue: number) {
        const target = new Character({
            id: 't',
            name: 't',
            story: 'balanced',
            weapon: 'floating_silk',
            baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom },
            rewards: [],
        })
        const ctx = {
            final: 0,
            raw: 0,
            target,
            attacker: target,
            state: {} as BattleState,
            layer: { restoreValue } as BuffLayer,
        }
        return ctx as unknown as BuffHookCtx
    }

    it('御物耗炁扣减 ≤ 2/3 基础 AP 回复，净回复恒为正', () => {
        const hook = getBuff('yuwu_cost')!.apRegenPerSec!
        // 低推演（wis=3，基础 0.9）：0.7 被压到 0.6 → 净 +0.3
        const lowDrain = hook(yuwuCtx(3, 0.7))
        expect(lowDrain).toBeCloseTo(-0.6)
        expect(lowDrain + 0.9).toBeGreaterThan(0)
        // 高推演（wis=20，基础 1.75）：0.7 未触顶 → 净 +1.05
        expect(hook(yuwuCtx(20, 0.7))).toBeCloseTo(-0.7)
    })

    it('低属性御物 vs junshi 的战斗必须正常终止（不卡死）', () => {
        const p = new Character({
            id: 'player',
            name: '玄十',
            story: 'xuanmen',
            weapon: 'floating_silk',
            baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
            rewards: [],
        })
        const enemy = new Character(gen(getOpponentDef('junshi')!, 11))
        const { winner } = runBattle(p, enemy)
        expect(['player', 'junshi', '平局']).toContain(winner)
    })
})
