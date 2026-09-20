import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { canExecuteAction } from '../calc/action-executor'
import { processActionEffect } from '../combat/effects'
import { applyDamage } from '../combat/effects/damage'
import { getAction } from '../../data/actions'
import { rng } from '../util/rng'
import type { LogEvent } from '../combat/log-events'

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

describe('缴械 · 招架看主副手并集', () => {
    function dummy(id: string): Character {
        return new Character({
            id,
            name: id,
            weapon: 'bare_hands',
            battleStyle: 'clinch',
            baseAttrs: { strength: 12, vitality: 12, agility: 12, dexterity: 16, insight: 12, wisdom: 8 },
            rewards: [{ type: 'action', id: 'straight_punch', name: '直拳', description: '', tags: [] }],
        })
    }

    /** 同一颗种子连打 N 次，返回招架判定的掷骰次数 */
    function parryRolls(target: Character, attacker: Character, engine: BattleEngine, n = 40): number {
        const events: LogEvent[] = []
        engine.onLog((e) => events.push(e))
        rng.seedMain(999)
        let rolls = 0
        for (let i = 0; i < n; i++) {
            events.length = 0
            target.hp = target.maxHp
            applyDamage({ raw: 5, target, attacker, engine, source: getAction('straight_punch') })
            rolls += events.filter((e) => e.type === 'check_parry').length
        }
        return rolls
    }

    it('副手带 parry：被缴械（只脱主手）后照旧能招架', () => {
        const me = dualWield() // 主手绣冬 + 副手春雷，两把都带 parry
        const foe = dummy('foe')
        const engine = new BattleEngine(me, foe, 4, false)
        expect(parryRolls(me, foe, engine)).toBeGreaterThan(0)

        processActionEffect(
            { type: 'disarm' } as never,
            { self: foe, enemy: me, engine, tMs: engine.state.turn.currentTime } as never,
        )
        expect(me.weaponDef!.id).toBe('bare_hands') // 主手脱了
        // 副手仍在：射程并集还留着春雷的 [0,2]，标签里也还有 parry（都是公开口径）
        expect(me.getEffectiveRange()).toEqual([0, 2])
        expect(me.getWeaponTags()).toContain('parry')
        expect(parryRolls(me, foe, engine)).toBeGreaterThan(0)
    })

    it('单持被缴械后不能招架（主手没了就是没了）', () => {
        const me = new Character({
            id: 'solo',
            name: '单持',
            weapon: 'xiu_dong',
            battleStyle: 'melee',
            baseAttrs: { strength: 14, vitality: 14, agility: 16, dexterity: 16, insight: 14, wisdom: 4 },
            rewards: [],
        })
        const foe = dummy('foe2')
        const engine = new BattleEngine(me, foe, 4, false)
        expect(parryRolls(me, foe, engine)).toBeGreaterThan(0)

        processActionEffect(
            { type: 'disarm' } as never,
            { self: foe, enemy: me, engine, tMs: engine.state.turn.currentTime } as never,
        )
        expect(me.weaponDef!.id).toBe('bare_hands')
        expect(parryRolls(me, foe, engine)).toBe(0)
    })
})
