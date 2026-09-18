import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { ALL_ATTRS, type AttrName } from '../entities/attributes'
import { TALENTS } from '../../data/passives/talents'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { Reward } from '../../game/entities/reward'

/**
 * 天赋解锁只看**原始属性**（baseAttrs）：
 * 装备/功法带来的加减属性既不能让天赋冒出来，也不能让它消失。
 * 判定在构造角色（= 每场战斗前）时做一次，战斗内不重算。
 */
function makeBuild(attrs: Partial<Record<AttrName, number>>, rewards: Reward[] = []): CharacterBuild {
    const base: Record<string, number> = {}
    for (const a of ALL_ATTRS) base[a] = 7
    return {
        id: 'p',
        name: '试招',
        battleStyle: 'clinch',
        weapon: 'bare_hands',
        baseAttrs: { ...base, ...attrs } as CharacterBuild['baseAttrs'],
        rewards,
    }
}

const artifact = (id: string): Reward => ({ type: 'artifact', id, name: id, description: '', tags: [] })
const passive = (id: string): Reward => ({ type: 'passive', id, name: id, description: '', tags: [] })

/**
 * 天赋是否生效：达标就建了**来源层**（`passive:<id>`，顶层 `effects` 走层账）或挂上了触发槽。
 *
 * 迁移前天赋的 buff 挂在 `battle_start` 触发槽上，所以这里当初按「触发槽在不在」判断；
 * 现在 buff 在顶层 `effects` 里，判定换成来源层（无 effects 的天赋仍保留触发槽形态）。
 */
function applied(build: CharacterBuild, talentId: string): boolean {
    const t = TALENTS.find((x) => x.id === talentId)!
    const c = new Character(build)
    if (c.sourceLayers.some((l) => l.sourceId === `passive:${talentId}`)) return true
    return (t.triggers ?? []).some((slot) => c.passiveTriggers.includes(slot))
}

describe('天赋解锁只看原始属性', () => {
    // 凌波微步：身法 ≥ 20（效果含急速，走 battle_start 的 buff）
    it('凌波微步：原始身法 20 生效、19 不生效', () => {
        expect(applied(makeBuild({ agility: 20 }), 'ling_bo_wei_bu')).toBe(true)
        expect(applied(makeBuild({ agility: 19 }), 'ling_bo_wei_bu')).toBe(false)
    })

    it('装备把生效属性推过门槛也没用：原始身法 15 + 斗铠/奇物 +5 → 不生效', () => {
        const c = new Character(makeBuild({ agility: 15 }, [artifact('muscle_boost')]))
        expect(c.attrs.get('agility')).toBeGreaterThanOrEqual(20) // 生效属性确实到 20 了
        expect(applied(makeBuild({ agility: 15 }, [artifact('muscle_boost')]), 'ling_bo_wei_bu')).toBe(false) // 但天赋没解锁
    })

    it('装备把生效属性压到门槛下也不影响：原始力道 20 + 三分归元气（力道-2）→ 仍生效', () => {
        // 用力道（赤手空拳只加身法，不干扰这条）
        const b = makeBuild({ strength: 20 }, [passive('spirit_resonance')])
        const c = new Character(b)
        expect(c.attrs.get('strength')).toBeLessThan(20) // 生效 18
        expect(applied(b, 'yuanting_yuezhi')).toBe(true) // 天赋照样解锁
    })

    it('requireAttrsMax 同样只看原始属性：分心错手（灵巧 ≥ 18 且 推演 ≤ 4）', () => {
        expect(applied(makeBuild({ dexterity: 18, wisdom: 4 }), 'zuoyou_hubo')).toBe(true)
        expect(applied(makeBuild({ dexterity: 18, wisdom: 5 }), 'zuoyou_hubo')).toBe(false)
    })

    it('奖励表里预置了同一个天赋也不会重复（不触发重复奖励检查）', () => {
        expect(applied(makeBuild({ agility: 20 }, [passive('ling_bo_wei_bu')]), 'ling_bo_wei_bu')).toBe(true)
    })
})
