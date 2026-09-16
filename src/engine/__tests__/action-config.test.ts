import { describe, it, expect } from 'vitest'
import { checkCondition } from '../../game/entities/action-config'
import {
    getConditionPreset,
    describeCondition,
    CONDITION_PRESETS,
    CONDITION_TYPES,
    conditionParams,
    defaultParams,
    resolveCondition,
    unknownConditionIds,
} from '../../data/conditions'
import { Character } from '../entities/character'
import { PositionSystem } from '../combat/position'
import { BattleLog } from '../combat/battle-log'
import { TurnManager } from '../combat/turn'
import { BuffRegistry } from '../combat/utils/buff-registry'
import { BattleState } from '../combat/battle-state'
import type { BattleState as BattleStateType } from '../combat/types'

function makeChar(attrs: Record<string, number> = {}): Character {
    return new Character({
        id: 'test',
        name: '测试',
        story: 'balanced',
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10, ...attrs },        battleStyle: 'clinch' as const,

        rewards: [],
    })
}

function makeState(char: Character): BattleStateType {
    const enemy = new Character({
        id: 'enemy',
        name: '敌人',
        story: 'balanced',
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },        battleStyle: 'clinch' as const,

        rewards: [],
    })
    const tm = new TurnManager()
    const st = new BattleState()
    st.phase = 'fighting'
    st.characters = [char, enemy] as [Character, Character]
    st.position = new PositionSystem(char.id, -3, enemy.id, 3)
    st.turn = tm
    st.log = new BattleLog()
    st.eventActorId = null
    st.eventTime = 0
    st.pendingBuffs = new BuffRegistry()
    st.actionCount = 0
    st.isEmitting = false
    st.moveDelta = 0
    st.triggeredThisChain = null
    return st
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
        expect(describeCondition({ type: 'always' })).toBe('不设条件')
    })

    it('describes hp_below_50', () => {
        expect(describeCondition({ type: 'hp_below', ratio: 0.5 })).toBe('气血 < 50%')
    })

    it('describes distance_gt_3', () => {
        expect(describeCondition({ type: 'distance_greater_than', meters: 3 })).toBe('距离 > 3m')
    })

    it('describes distance_between', () => {
        expect(describeCondition({ type: 'distance_between', min: 1, max: 3 })).toBe('距离 1~3m')
    })

    it('describes ap / chan / time conditions', () => {
        expect(describeCondition({ type: 'ap_below', value: 4 })).toBe('内息 < 4')
        expect(describeCondition({ type: 'chan_above', value: 30 })).toBe('缠劲 ≥ 30')
        expect(describeCondition({ type: 'time_above', seconds: 20 })).toBe('交手 ≥ 20秒')
    })
})

describe('CONDITION_TYPES', () => {
    it('every type builds a condition of its own type', () => {
        for (const t of CONDITION_TYPES) {
            expect(t.build(defaultParams(t)).type).toBe(t.type)
        }
    })

    it('params round-trip through conditionParams', () => {
        for (const t of CONDITION_TYPES) {
            expect(conditionParams(t.build(defaultParams(t)))).toEqual(defaultParams(t))
        }
    })

    it('every type has a description', () => {
        for (const t of CONDITION_TYPES) {
            expect(describeCondition(t.build(defaultParams(t)))).toBeTruthy()
        }
    })
})

describe('resolveCondition', () => {
    it('returns undefined when no condition', () => {
        expect(resolveCondition(undefined)).toBeUndefined()
        expect(resolveCondition({ actionId: 'a' })).toBeUndefined()
    })

    it('returns undefined for always (no gate)', () => {
        expect(resolveCondition({ actionId: 'a', condition: { type: 'always' } })).toBeUndefined()
    })

    it('falls back to preset conditionId', () => {
        const c = resolveCondition({ actionId: 'a', conditionId: 'hp_below_50' })
        expect(c?.type).toBe('hp_below')
    })

    it('structured condition wins over conditionId', () => {
        const c = resolveCondition({
            actionId: 'a',
            conditionId: 'hp_below_50',
            condition: { type: 'hp_below', ratio: 0.2 },
        })
        expect(c?.type).toBe('hp_below')
        if (c?.type === 'hp_below') expect(c.ratio).toBe(0.2)
    })

    it('unknown conditionId resolves to undefined but is reported', () => {
        const configs = [{ actionId: 'a', conditionId: 'no_such_preset' }, { actionId: 'b', conditionId: 'hp_below_50' }]
        expect(resolveCondition(configs[0])).toBeUndefined()
        expect(unknownConditionIds(configs)).toEqual(['no_such_preset'])
    })

    it('structured condition is never reported as unknown', () => {
        expect(unknownConditionIds([{ actionId: 'a', conditionId: 'gone', condition: { type: 'ap_below', value: 3 } }])).toEqual(
            [],
        )
    })
})

describe('resolveCondition 对 always 的处理', () => {
    it('预设 always 与结构化 always 都解析为「无门槛」', () => {
        expect(resolveCondition({ actionId: 'a', conditionId: 'always' })).toBeUndefined()
        expect(resolveCondition({ actionId: 'a', condition: { type: 'always' } })).toBeUndefined()
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

    it('distance_between: true only inside the window', () => {
        const char = makeChar()
        const state = makeState(char)
        const d = state.position.distance(char.id, state.characters[1].id)
        expect(checkCondition({ type: 'distance_between', min: d - 1, max: d + 1 }, char, state)).toBe(true)
        expect(checkCondition({ type: 'distance_between', min: d + 1, max: d + 2 }, char, state)).toBe(false)
    })

    it('ap_above / ap_below follow current AP', () => {
        const char = makeChar()
        const state = makeState(char)
        char.ap = 5
        expect(checkCondition({ type: 'ap_above', value: 4 }, char, state)).toBe(true)
        expect(checkCondition({ type: 'ap_below', value: 4 }, char, state)).toBe(false)
        char.ap = 1
        expect(checkCondition({ type: 'ap_above', value: 4 }, char, state)).toBe(false)
        expect(checkCondition({ type: 'ap_below', value: 4 }, char, state)).toBe(true)
    })

    it('chan_above / chan_below follow current chan', () => {
        const char = makeChar()
        const state = makeState(char)
        char.chan = 30
        expect(checkCondition({ type: 'chan_above', value: 30 }, char, state)).toBe(true)
        expect(checkCondition({ type: 'chan_below', value: 30 }, char, state)).toBe(false)
        char.chan = 10
        expect(checkCondition({ type: 'chan_above', value: 30 }, char, state)).toBe(false)
        expect(checkCondition({ type: 'chan_below', value: 30 }, char, state)).toBe(true)
    })

    it('time_above compares against scheduled time', () => {
        const char = makeChar()
        const state = makeState(char)
        state.turn.setTime(15_000)
        expect(checkCondition({ type: 'time_above', seconds: 10 }, char, state)).toBe(true)
        expect(checkCondition({ type: 'time_above', seconds: 20 }, char, state)).toBe(false)
    })

    it('enemy_buff_stacks_below / above read the enemy layer', () => {
        const char = makeChar()
        const state = makeState(char)
        const enemy = state.characters.find((c) => c.id !== char.id)!
        state.pendingBuffs.set(`bleed::${enemy.id}`, { restoreValue: 3 })
        expect(checkCondition({ type: 'enemy_buff_stacks_above', buffId: 'bleed', minStacks: 3 }, char, state)).toBe(true)
        expect(checkCondition({ type: 'enemy_buff_stacks_below', buffId: 'bleed', maxStacks: 3 }, char, state)).toBe(false)
        // 自身同名状态不参与判定：自身 0 层不应让「目标层数少于 1」成立
        state.pendingBuffs.set(`bleed::${char.id}`, { restoreValue: 0 })
        expect(checkCondition({ type: 'enemy_buff_stacks_below', buffId: 'bleed', maxStacks: 1 }, char, state)).toBe(false)
    })
})
