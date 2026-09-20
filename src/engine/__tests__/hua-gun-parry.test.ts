import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { getBuff } from '../../data/buffs'
import { getAction } from '../../data/actions'

const buff = getBuff('hua_gun_parry')!

function makeChar(id: string, name: string): Character {
    return new Character({
        id,
        name,
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 16, insight: 10, wisdom: 8 },
        battleStyle: 'melee' as const,
        rewards: [],
    })
}

/** 在给定间距上读一次 onParryChance 的返回值（灵巧 16 → ×1% = 0.16，加倍 = 0.32） */
function parryBonus(dist: number, actionId: string): number {
    const me = makeChar('A', '甲')
    const foe = makeChar('B', '乙')
    const engine = new BattleEngine(me, foe, dist, false)
    return buff.onParryChance!({
        final: 0,
        raw: 0,
        target: me,
        attacker: foe,
        engine,
        state: engine.state,
        layer: { restoreValue: 1, extra: {} },
        source: getAction(actionId),
    })
}

describe('舞花棍 · 招架率看实时距离（不看招式 tag）', () => {
    it('距离 ≥4m 加倍，近距离只有基础值', () => {
        expect(parryBonus(1, 'light_slash')).toBeCloseTo(0.16)
        expect(parryBonus(3, 'light_slash')).toBeCloseTo(0.16)
        expect(parryBonus(4, 'light_slash')).toBeCloseTo(0.32)
        expect(parryBonus(6, 'light_slash')).toBeCloseTo(0.32)
    })

    it('判据是距离不是 tag：远距离的近战招式照样加倍', () => {
        // light_slash 不带 range tag，_luo_yue 带 —— 同一距离上两者应给出相同加成
        expect(parryBonus(5, '_luo_yue')).toBeCloseTo(parryBonus(5, 'light_slash'))
        expect(parryBonus(5, '_luo_yue')).toBeCloseTo(0.32)
        // 反之，带 range tag 的招式贴脸打也只有基础值
        expect(parryBonus(2, '_luo_yue')).toBeCloseTo(0.16)
    })
})
