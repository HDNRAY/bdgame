import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getAction } from '../../data/actions'
import { calcCritChance } from '../calc/damage'
import { calcEffectiveCritChance } from '../combat/utils'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

function makeChar(id: string, name: string, dexterity = 14, insight = 20): Character {
    return new Character({
        id,
        name,
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity, insight, wisdom: 8 },
        battleStyle: 'melee' as const,
        rewards: [],
    })
}

function setup() {
    const atk = makeChar('A', '甲')
    const foe = makeChar('B', '乙')
    const engine = new BattleEngine(atk, foe, 4, false)
    return { atk, foe, state: engine.state }
}

const slash = getAction('rising_slash')! // 自带 onActionCritChance +0.15

describe('实时暴击率 · calcEffectiveCritChance', () => {
    it('基础值 = calcCritChance(灵巧, 洞察)', () => {
        const { atk, foe, state } = setup()
        const base = calcCritChance(atk.attrs.get('dexterity'), atk.attrs.get('insight'))
        expect(calcEffectiveCritChance(state, atk, foe, getAction('blaze_strike'))).toBeCloseTo(base)
    })

    it('含暴击 buff（心眼 +25%）', () => {
        const { atk, foe, state } = setup()
        const base = calcCritChance(atk.attrs.get('dexterity'), atk.attrs.get('insight'))
        state.pendingBuffs.set(`mind_eye::${atk.id}`, { restoreValue: 1, buffId: 'mind_eye' })
        expect(calcEffectiveCritChance(state, atk, foe, getAction('blaze_strike'))).toBeCloseTo(base + 0.25)
    })

    it('含招式自带 onActionCritChance（挑斩 +15%）', () => {
        const { atk, foe, state } = setup()
        const base = calcCritChance(atk.attrs.get('dexterity'), atk.attrs.get('insight'))
        expect(calcEffectiveCritChance(state, atk, foe, slash)).toBeCloseTo(base + 0.15)
    })

    it('不传招式时攻方 onCritChance 不生效（与引擎「无招不判」一致）', () => {
        const { atk, foe, state } = setup()
        const base = calcCritChance(atk.attrs.get('dexterity'), atk.attrs.get('insight'))
        state.pendingBuffs.set(`mind_eye::${atk.id}`, { restoreValue: 1, buffId: 'mind_eye' })
        expect(calcEffectiveCritChance(state, atk, foe)).toBeCloseTo(base)
    })

    it('依赖 source 的暴击 buff（无想 +10%）必须把招式传进去才算', () => {
        const { atk, foe, state } = setup()
        const base = calcCritChance(atk.attrs.get('dexterity'), atk.attrs.get('insight'))
        state.pendingBuffs.set(`wu_xiang::${atk.id}`, { restoreValue: 1, buffId: 'wu_xiang' })
        const move = getAction('blaze_strike')!
        expect(calcEffectiveCritChance(state, atk, foe, move)).toBeCloseTo(base + 0.1)
        expect(calcEffectiveCritChance(state, atk, foe)).toBeCloseTo(base) // 漏传招式 → 老实现会恒为 0
    })
})
