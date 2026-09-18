import { describe, it, expect } from 'vitest'
import { getArtifact } from '../../data/artifacts'
import { getBuff } from '../../data/buffs'
import { Character } from '../../engine/entities/character'
import { constructEffectsOf } from '../../engine/entities/trigger'
import { TALENTS } from '../../data/passives/talents'
import type { CharacterBuild } from '../entities/character-build'
import type { Passive } from '../../engine/entities/passive'
import type { AttrName } from '../../engine/entities/attributes'
import {
    CHAMPION_BASE_ATTR,
    CHAMPION_BOSS_ID,
    CHAMPION_BOSS_NAME,
    CHAMPION_ONLY_IMPLANT,
    championBossBuild,
    championImplantIds,
} from '../champion-boss'

const ALL_ATTRS: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

function baseBuild(over: Partial<CharacterBuild> = {}): CharacterBuild {
    return {
        id: 'p',
        name: '上一轮的人',
        battleStyle: 'melee',
        baseAttrs: { strength: 12, vitality: 12, agility: 12, dexterity: 12, insight: 12, wisdom: 12 },
        weapon: 'peach_sword',
        rewards: [],
        ...over,
    }
}

/** 一个 build 挂上的奇物带来的属性加成合计（读奇物自带 buff 的 attrMods，够本测试用） */
function artifactGrants(build: CharacterBuild): Partial<Record<AttrName, number>> {
    const out: Partial<Record<AttrName, number>> = {}
    for (const r of build.rewards) {
        if (r.type !== 'artifact') continue
        const def = getArtifact(r.id)
        for (const e of def ? constructEffectsOf(def) : []) {
            // 属性加成现在写在 buff 的 attrMods 里（来源的 on_construct 槽只声明挂哪个 buff）
            const attrs =
                e.type === 'add_buff' ? getBuff(e.buffId)?.attrMods : (e as { attrs?: Record<string, number> }).attrs
            if (!attrs) continue
            for (const [k, v] of Object.entries(attrs)) {
                const a = k as AttrName
                out[a] = (out[a] ?? 0) + v
            }
        }
    }
    return out
}

/** 实际属性 = baseAttrs + 奇物加成（忽略 buff/触发器带来的其它修正，够本测试用） */
function effective(build: CharacterBuild): Record<AttrName, number> {
    const grants = artifactGrants(build)
    const out = {} as Record<AttrName, number>
    for (const a of ALL_ATTRS) out[a] = (build.baseAttrs[a] ?? 0) + (grants[a] ?? 0)
    return out
}

/** 天赋是否生效：建了来源层（`on_construct` 槽的 apply）或挂上了触发槽（无构造槽的天赋仍是触发槽形态） */
function talentApplied(char: Character, talent: Passive): boolean {
    if (char.sourceLayers.some((l) => l.sourceId === `passive:${talent.id}`)) return true
    return (talent.effects ?? []).some((slot) => char.passiveTriggers.includes(slot))
}

describe('champion-boss（隐藏boss 构造）', () => {
    it('换入的义体：14 件 implant 里排除悬浮座椅与战斗芯片·改，并排除专属义体', () => {
        const ids = championImplantIds()
        expect(ids).not.toContain('wheelchair_lightness')
        expect(ids).not.toContain('doctor_chip')
        expect(ids).not.toContain(CHAMPION_ONLY_IMPLANT)
        expect(ids).toContain('titanium_arm')
        expect(ids).toContain('marrow_pump')
        expect(ids.length).toBe(13)
    })

    it('六项基础属性一律 7 点，奖励与义体全部叠上去（不抵扣玩家的 baseAttrs）', () => {
        const player = baseBuild({
            baseAttrs: { strength: 30, vitality: 30, agility: 30, dexterity: 30, insight: 30, wisdom: 30 },
        })
        const boss = championBossBuild(player)
        for (const a of ALL_ATTRS) expect(boss.baseAttrs[a], a).toBe(CHAMPION_BASE_ATTR)
        // 实际属性 = 7 + 奖励/义体的加成（与玩家存档里的 baseAttrs 无关）
        const be = effective(boss)
        const grants = artifactGrants(boss)
        for (const a of ALL_ATTRS) expect(be[a], a).toBe(CHAMPION_BASE_ATTR + (grants[a] ?? 0))
        expect(boss.name).toBe(CHAMPION_BOSS_NAME)
        expect(boss.taunt).toBeTruthy()
        expect(boss.story).toBeUndefined()
    })

    it('14 件义体一共给 42 点属性（平均每项 7 点，含失重/失感的负项）', () => {
        // 迁移后义体的全部属性修正都在构造期槽（`on_construct`）里（以前 overload / muscle_degradation 挂在装备期
        // 触发槽，这个只读构造期槽的助手看不到负项，所以旧口径是 48）。战斗属性不变：开局两条路径都会应用。
        const boss = championBossBuild(baseBuild())
        const grants = artifactGrants(boss)
        const total = ALL_ATTRS.reduce((sum, a) => sum + (grants[a] ?? 0), 0)
        expect(total).toBe(42)
        expect(total / ALL_ATTRS.length).toBe(7)
    })

    it('玩家已有的义体不重复挂（属性照常叠加）', () => {
        const owned = 'titanium_arm'
        const player = baseBuild({
            rewards: [{ type: 'artifact', id: owned, name: owned, description: '', tags: [] }],
        })
        const boss = championBossBuild(player)
        const ids = boss.rewards.map((r) => r.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.filter((id) => id === owned)).toHaveLength(1)

        const be = effective(boss)
        const grants = artifactGrants(boss)
        for (const a of ALL_ATTRS) expect(be[a], a).toBe(CHAMPION_BASE_ATTR + (grants[a] ?? 0))
    })

    it('义体全挂上：13 件换入 + 1 件专属', () => {
        const boss = championBossBuild(baseBuild())
        const ids = boss.rewards.map((r) => r.id)
        for (const id of championImplantIds()) expect(ids).toContain(id)
        expect(ids).toContain(CHAMPION_ONLY_IMPLANT)
        expect(ids.length).toBe(championImplantIds().length + 1)
    })

    it('13 个奖励与武器完全保留', () => {
        const rewards = Array.from({ length: 13 }, (_, i) => ({
            type: 'passive' as const,
            id: `p${i}`,
            name: `p${i}`,
            description: '',
            tags: [],
        }))
        const boss = championBossBuild(baseBuild({ rewards }))
        for (const r of rewards) expect(boss.rewards.some((b) => b.id === r.id)).toBe(true)
        expect(boss.rewards.length).toBe(13 + championImplantIds().length + 1)
        expect(boss.weapon).toBe('peach_sword')
    })

    it('主手不是单手兵器时清掉副手', () => {
        expect(championBossBuild(baseBuild({ weapon: 'dark_iron_sword', offhand: 'dagger' })).offhand).toBeUndefined()
        expect(championBossBuild(baseBuild({ weapon: 'peach_sword', offhand: 'dagger' })).offhand).toBe('dagger')
    })

    it('战斗 id 与玩家不同（同 id 会让引擎把 boss 战恒判为败）', () => {
        const boss = championBossBuild(baseBuild({ id: 'player' }))
        expect(boss.id).not.toBe('player')
        expect(boss.id).toBe(CHAMPION_BOSS_ID)
    })

    it('存档属性再低也不影响 boss 的六项 7 点', () => {
        const low: Partial<Record<AttrName, number>> = {}
        for (const a of ALL_ATTRS) low[a] = 1
        const boss = championBossBuild(baseBuild({ baseAttrs: low }))
        for (const a of ALL_ATTRS) expect(boss.baseAttrs[a]).toBe(CHAMPION_BASE_ATTR)
    })

    it('不继承玩家上一局解锁的天赋（boss 的原始属性只有 7 点起）', () => {
        // 玩家上一局身法 20 → 解锁凌波微步（haste 200）
        const saved = baseBuild({ baseAttrs: { strength: 7, vitality: 7, agility: 20, dexterity: 7, insight: 7, wisdom: 7 } })
        const player = new Character(saved)
        const playerTalent = TALENTS.find((t) => t.id === 'ling_bo_wei_bu')!
        expect(talentApplied(player, playerTalent)).toBe(true)

        // 同一份存档当隐藏boss：baseAttrs 全被重置为 7（+义体也到不了 20）→ 天赋不再解锁
        const boss = new Character(championBossBuild(saved))
        expect(boss.attrs.get('agility')).toBeLessThan(20)
        expect(talentApplied(boss, playerTalent)).toBe(false)
    })
})
