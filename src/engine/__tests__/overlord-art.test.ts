import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { calcExpectedDamage } from '../ai/expected-damage'
import { getBuff } from '../../data/buffs'
import { getPassive } from '../../data/passives'
import { getWeapon } from '../../data/weapons/weapons'
import { OTSU } from '../../data/opponents/otsu'
import { YIDAO } from '../../data/opponents/yidao'
import { gen } from '../../data/opponents/index'
import type { ActionDefinition } from '../entities/action'
import type { WeaponDef } from '../../data/weapons/weapons'
import type { CharacterBuild } from '../../game/entities/character-build'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

/**
 * 轮舞月斩（passive `overlord_art` / buff `overlord_art_buff`）：重器与轻兵**两档互斥**。
 *
 * 回归点：`onCritChance` 曾经把 `onHitChance` 的条件照抄一遍（`includes('heavy')`），
 * 说明里的「否则暴击+15%」从未实现 —— 非重器使用者（otsu·春翁）拿到这张被动等于没拿。
 */
function hookCtx(weaponId: string) {
    const attacker = new Character({
        id: 'a',
        name: 'a',
        story: 'balanced',
        weapon: weaponId,
        baseAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },
        battleStyle: 'melee',
        rewards: [],
    })
    return { final: 0, raw: 0, target: {} as never, attacker, state: {} as never, layer: { restoreValue: 1 } }
}

describe('轮舞月斩 overlord_art', () => {
    const buff = getBuff('overlord_art_buff')!

    it('两个钩子都存在', () => {
        expect(buff.onHitChance).toBeTypeOf('function')
        expect(buff.onCritChance).toBeTypeOf('function')
    })

    // 数值随平衡调整，测试只钉「哪一档吃哪一个」——回归点是 onCritChance 曾照抄 onHitChance 的条件（两档同时生效/非重器全 0）
    it('重器：吃命中、不给暴击', () => {
        const heavy = hookCtx('overlord_blade')
        expect(getWeapon('overlord_blade').tags).toContain('heavy')
        expect(buff.onHitChance!(heavy)).toBeGreaterThan(0)
        expect(buff.onCritChance!(heavy)).toBe(0)
    })

    it('非重器：吃暴击、不给命中（旧实现这里是 0/0，整条被动失效）', () => {
        const light = hookCtx('three_section_spear')
        expect(getWeapon('three_section_spear').tags).not.toContain('heavy')
        expect(buff.onHitChance!(light)).toBe(0)
        expect(buff.onCritChance!(light)).toBeGreaterThan(0)
    })

    it('被动仍给 slash 招式加突进、并授予 retrieve_blade', () => {
        const def = getPassive('overlord_art')!
        const slash: ActionDefinition = {
            id: 'x',
            name: 'x',
            description: '',
            tags: ['slash'],
            requiredTags: [],
            apCost: 2,
            effects: [{ type: 'damage', scaling: {} }],
        }
        expect(def.actionEnhancer!(slash).effects?.[0]).toEqual({ type: 'short_dash', maxDistance: 1 })
        expect(def.grantsActions).toContain('retrieve_blade')
        // 非 slash 招式不动
        expect(def.actionEnhancer!({ ...slash, tags: ['pierce'] })).toEqual({ ...slash, tags: ['pierce'] })
    })

    it('非重器使用者（otsu）：带被动后命中不变、期望伤上升', () => {
        const withArt = gen(OTSU, 33)
        const withoutArt: CharacterBuild = { ...withArt, rewards: withArt.rewards.filter((r) => r.id !== 'overlord_art') }

        const probe = (build: CharacterBuild) => {
            const atk = new Character(build)
            const foe = new Character(gen(YIDAO, 33))
            const engine = new BattleEngine(atk, foe, 4, true)
            const act = atk.actions.find((a) => a.def.tags.includes('slash'))!
            const weapon: WeaponDef | undefined = atk.weaponDef
            expect(weapon?.tags).not.toContain('heavy')
            return calcExpectedDamage(act.def, atk, foe, atk.getEffectiveRange(), engine.state)
        }

        const on = probe(withArt)
        const off = probe(withoutArt)
        expect(on.hitChance).toBeCloseTo(off.hitChance, 10)
        expect(on.expectedDamage).toBeGreaterThan(off.expectedDamage)
    })
})
