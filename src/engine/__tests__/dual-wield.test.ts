import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { canExecuteAction } from '../calc/action-executor'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

/** 造双持角色：主手绣冬 [1,3] + 副手春雷 [0,2] */
function dualWield(): Character {
    return new Character({
        id: 'dual',
        name: '双持',
        weapon: 'xiu_dong',
        offhand: 'chun_lei',
        battleStyle: 'melee',
        baseAttrs: { strength: 14, vitality: 14, agility: 16, dexterity: 16, insight: 14, wisdom: 4 },
        rewards: [{ type: 'action', id: 'light_slash', name: '顺劈', description: '', tags: [] }],
    })
}

describe('双持主副手射程并集', () => {
    it('getEffectiveRange = [min(主手[0],副手[0]), max(主手[1],副手[1])]', () => {
        const c = dualWield()
        expect(c.getEffectiveRange()).toEqual([0, 3])
        // 单持时 = 主手射程本身
        const single = new Character({
            id: 's',
            name: '单持',
            weapon: 'xiu_dong',
            battleStyle: 'melee',
            baseAttrs: { strength: 14, vitality: 14, agility: 16, dexterity: 16, insight: 14, wisdom: 4 },
            rewards: [],
        })
        expect(single.getEffectiveRange()).toEqual([1, 3])
    })

    it('贴脸 0m 也能放默认射程招式（顺劈不再被主手下限 1 卡死）', () => {
        const dual = dualWield()
        // 主手绣冬 顺劈默认射程 [1,3]；并集后 0m 也该够得着
        expect(dual.getEffectiveRange()[0]).toBe(0)

        const enemy = new Character({
            id: 'e',
            name: '敌',
            weapon: 'bare_hands',
            battleStyle: 'clinch',
            baseAttrs: { strength: 8, vitality: 8, agility: 6, dexterity: 6, insight: 4, wisdom: 3 },
            rewards: [],
        })
        // 距离 0 → 顺劈可执行
        const engine = new BattleEngine(dual, enemy, 0)
        const action = dual.actions.find((a) => a.id === 'light_slash')!.def
        const ok = canExecuteAction(action, dual, engine.state, engine)
        expect(ok.ok).toBe(true)
    })

    it('主手绣冬无副手时贴脸 0m 打不出顺劈（单持保持下限约束）', () => {
        const single = new Character({
            id: 's',
            name: '单持',
            weapon: 'xiu_dong',
            battleStyle: 'melee',
            baseAttrs: { strength: 14, vitality: 14, agility: 16, dexterity: 16, insight: 14, wisdom: 4 },
            rewards: [{ type: 'action', id: 'light_slash', name: '顺劈', description: '', tags: [] }],
        })
        const enemy = new Character({
            id: 'e',
            name: '敌',
            weapon: 'bare_hands',
            battleStyle: 'clinch',
            baseAttrs: { strength: 8, vitality: 8, agility: 6, dexterity: 6, insight: 4, wisdom: 3 },
            rewards: [],
        })
        const engine = new BattleEngine(single, enemy, 0)
        const action = single.actions.find((a) => a.id === 'light_slash')!.def
        const ok = canExecuteAction(action, single, engine.state, engine)
        expect(ok.ok).toBe(false)
    })
})

describe('双持 requiredTags 并集', () => {
    it('主手 slash + 副手 pierce：pierce 招式也可用（任一武器满足即可）', () => {
        // 主手春雷(slash) 副手?春雷无 pierce……用锁链断刀 [0,2]? 构造:主手 slash 剑 + 副手 pierce 匕首
        const dual = new Character({
            id: 'dual2',
            name: '双持2',
            weapon: 'xiu_dong', // slash
            offhand: 'special_forces_dagger', // pierce
            battleStyle: 'clinch',
            baseAttrs: { strength: 10, vitality: 10, agility: 12, dexterity: 12, insight: 10, wisdom: 6 },
            rewards: [{ type: 'action', id: 'thrust', name: '突刺', description: '', tags: [] }],
        })
        // special_forces_dagger 有 pierce → thrust(requiredTags pierce) 应可用
        const tags = dual.getWeaponTags()
        expect(tags).toContain('pierce')
        expect(tags).toContain('slash')
    })
})
