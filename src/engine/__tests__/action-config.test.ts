import { describe, it, expect } from 'vitest'
import { checkCondition } from '../entities/action-config'
import { getConditionPreset, describeCondition, CONDITION_PRESETS } from '../data/conditions'
import { Character } from '../entities/character'
import { PositionSystem } from '../combat/position'
import { BattleLog } from '../combat/battle-log'
import { TurnManager } from '../combat/turn'
import type { BattleState } from '../combat/types'

function makeChar(attrs: Record<string, number> = {}): Character {
    return new Character({
        id: 'test',
        name: '测试',
        background: 'balanced',
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10, ...attrs },
        rewards: [],
    })
}

function makeState(char: Character): BattleState {
    const enemy = new Character({
        id: 'enemy',
        name: '敌人',
        background: 'balanced',
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        rewards: [],
    })
    const tm = new TurnManager()
    return {
        phase: 'fighting',
        characters: [char, enemy] as [Character, Character],
        position: new PositionSystem(char.id, -3, enemy.id, 3),
        turn: tm,
        log: new BattleLog(),
        eventActorId: null,
        eventTime: 0,
        triggerUses: new Map(),
        pendingBuffs: new Map(),
        actionCount: 0,
        lastActionExtraDelay: 0,
        lastActionExtraStun: 0,
        actionTimeOffset: 0,
        isEmitting: false,
        moveDelta: 0,
        triggeredThisChain: null,
    }
}

describe('getConditionPreset', () => {
    it('returns always preset', () => {
        const c = getConditionPreset('always')
        expect(c).toBeDefined()
        expect(c!.type).toBe('always')
    })

    it('returns hp_below_50 preset', () => {
        const c = getConditionPreset('hp_below_50')!
        expect(c.type).toBe('hp_below')
        if (c.type === 'hp_below') expect(c.ratio).toBe(0.5)
    })

    it('returns distance_gt_3 preset', () => {
        const c = getConditionPreset('distance_gt_3')!
        expect(c.type).toBe('distance_greater_than')
        if (c.type === 'distance_greater_than') expect(c.meters).toBe(3)
    })

    it('returns undefined for unknown preset', () => {
        expect(getConditionPreset('unknown')).toBeUndefined()
    })

    it('all CONDITION_PRESETS have valid build functions', () => {
        for (const p of CONDITION_PRESETS) {
            const c = p.build()
            expect(c).toBeDefined()
            expect(c.type).toBeTruthy()
        }
    })
})

describe('describeCondition', () => {
    it('describes always', () => {
        expect(describeCondition({ type: 'always' })).toBe('始终可用')
    })

    it('describes hp_below_50', () => {
        expect(describeCondition({ type: 'hp_below', ratio: 0.5 })).toBe('HP < 50%')
    })

    it('describes distance_gt_3', () => {
        expect(describeCondition({ type: 'distance_greater_than', meters: 3 })).toBe('距离 > 3m')
    })
})

describe('checkCondition', () => {
    it('always returns true', () => {
        const char = makeChar()
        const state = makeState(char)
        expect(checkCondition({ type: 'always' }, char, state)).toBe(true)
    })

    it('hp_below: true when HP is low', () => {
        const char = makeChar({ vitality: 20 })
        const maxHp = char.maxHp
        char.hp = maxHp * 0.3
        const state = makeState(char)
        expect(checkCondition({ type: 'hp_below', ratio: 0.5 }, char, state)).toBe(true)
    })

    it('hp_below: false when HP is high', () => {
        const char = makeChar({ vitality: 20 })
        char.hp = char.maxHp * 0.8
        const state = makeState(char)
        expect(checkCondition({ type: 'hp_below', ratio: 0.5 }, char, state)).toBe(false)
    })

    it('hp_above: true when HP is high', () => {
        const char = makeChar({ vitality: 20 })
        char.hp = char.maxHp * 0.8
        const state = makeState(char)
        expect(checkCondition({ type: 'hp_above', ratio: 0.5 }, char, state)).toBe(true)
    })

    it('enemy_hp_below: true when enemy HP is low', () => {
        const char = makeChar()
        const state = makeState(char)
        const enemy = state.characters.find((c) => c.id !== char.id)!
        enemy.hp = 20
        expect(checkCondition({ type: 'enemy_hp_below', ratio: 0.5 }, char, state)).toBe(true)
    })

    it('enemy_hp_above: false when enemy HP is low', () => {
        const char = makeChar()
        const state = makeState(char)
        const enemy = state.characters.find((c) => c.id !== char.id)!
        enemy.hp = 20
        expect(checkCondition({ type: 'enemy_hp_above', ratio: 0.5 }, char, state)).toBe(false)
    })

    it('distance_less_than: true when close', () => {
        const char = makeChar()
        const state = makeState(char)
        expect(checkCondition({ type: 'distance_less_than', meters: 10 }, char, state)).toBe(true)
    })

    it('distance_greater_than: false when close', () => {
        const char = makeChar()
        const state = makeState(char)
        expect(checkCondition({ type: 'distance_greater_than', meters: 10 }, char, state)).toBe(false)
    })

    it('debuff_not_active: true when no debuff', () => {
        const char = makeChar()
        const state = makeState(char)
        expect(checkCondition({ type: 'debuff_not_active', buffId: 'stun' }, char, state)).toBe(true)
    })

    it('debuff_not_active: false when debuff exists', () => {
        const char = makeChar()
        const state = makeState(char)
        const enemy = state.characters.find((c) => c.id !== char.id)!
        state.pendingBuffs.set(`stun::${enemy.id}`, { restoreValue: 1 })
        expect(checkCondition({ type: 'debuff_not_active', buffId: 'stun' }, char, state)).toBe(false)
    })

    it('buff_not_active: true when no buff', () => {
        const char = makeChar()
        const state = makeState(char)
        expect(checkCondition({ type: 'buff_not_active', buffId: 'momentum' }, char, state)).toBe(true)
    })

    it('buff_stacks_below: true when stacks below max', () => {
        const char = makeChar()
        const state = makeState(char)
        state.pendingBuffs.set(`momentum::${char.id}`, { restoreValue: 3 })
        expect(checkCondition({ type: 'buff_stacks_below', buffId: 'momentum', maxStacks: 5 }, char, state)).toBe(true)
    })

    it('buff_stacks_above: true when stacks meet min', () => {
        const char = makeChar()
        const state = makeState(char)
        state.pendingBuffs.set(`momentum::${char.id}`, { restoreValue: 4 })
        expect(checkCondition({ type: 'buff_stacks_above', buffId: 'momentum', minStacks: 4 }, char, state)).toBe(true)
    })
})
