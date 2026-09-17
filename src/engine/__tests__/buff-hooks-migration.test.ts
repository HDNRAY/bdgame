import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { forEachBuffOf } from '../combat/utils'
import { applyAttrMods } from '../combat/utils/buff-layer'
import { getBuff } from '../../data/buffs'
import { getArtifact } from '../../data/artifacts'
import { getPassive } from '../../data/passives'
import { calcHitChance, calcParryChance } from '../calc/damage'
import type { Reward } from '../../game/entities/reward'

/**
 * 闪避 / 招架 / 属性下限这三个原来靠「构造期写死字段」的机制，全部改成了 buff / stat_restriction。
 * 这里钉住三件事：数据挂在哪个 buff 上、战斗里算出来的数没变、运行时偷奇物也拿得到。
 */
const reward = (type: Reward['type'], id: string): Reward => ({ id, type, name: id, description: '', tags: [] })

function makeChar(id: string, name: string, over: Partial<ConstructorParameters<typeof Character>[0]> = {}): Character {
    return new Character({
        id,
        name,
        weapon: 'bare_hands',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        battleStyle: 'clinch',
        rewards: [],
        ...over,
    })
}

/** 把角色身上所有 buff 的某个钩子加起来（引擎里就是这么汇总的） */
function sumHook(char: Character, engine: BattleEngine, hook: 'onDodgeChance' | 'onParryChance'): number {
    let sum = 0
    forEachBuffOf(engine.state.pendingBuffs, char.id, (def) => {
        const fn = def?.[hook]
        if (!fn) return
        const v = fn({ final: 0, raw: 0, attacker: char, target: char, engine, state: engine.state } as never)
        if (typeof v === 'number') sum += v
    })
    return sum
}

describe('闪避 / 招架改由 buff 承载', () => {
    it('效果类型已经删掉，数据挂在 buff 上（数值是可调平衡项，这里只钉钩子在且为正）', () => {
        const guard = getBuff('silk_guard')!
        expect(guard.onParryChance).toBeTypeOf('function')
        expect(guard.onParryChance!({} as never)).toBeGreaterThan(0)
        const shenxing = getBuff('shenxing_baibian_buff')!
        expect(shenxing.onDodgeChance).toBeTypeOf('function')
        expect(shenxing.onDodgeChance!({} as never)).toBeGreaterThan(0)
    })

    it('金丝手套：开局给金丝护手，招架加成立刻进 calcParryChance 同口径', () => {
        const atk = makeChar('A', '甲')
        const def = makeChar('B', '乙', { rewards: [reward('artifact', 'golden_silk_gloves')] })
        const engine = new BattleEngine(atk, def, 4)
        expect(engine.state.pendingBuffs.has(`silk_guard::${def.id}`)).toBe(true)
        const bonus = sumHook(def, engine, 'onParryChance')
        expect(bonus).toBeGreaterThan(0)
        // 引擎里的招架率就是「基础 + buff 钩子之和」，两边必须同一个口径
        const base = calcParryChance(def.attrs.get('dexterity'), def.attrs.get('insight'))
        expect(base + bonus).toBeGreaterThan(base)
        expect(sumHook(def, engine, 'onParryChance')).toBeCloseTo(
            getBuff('silk_guard')!.onParryChance!({} as never),
        )
    })

    it('神行百变：开局给闪避 buff，修正真的进了命中判定（数值不写死）', () => {
        const atk = makeChar('A', '甲')
        const def = makeChar('B', '乙', { rewards: [reward('passive', 'shenxing_baibian')] })
        const engine = new BattleEngine(atk, def, 4)
        expect(engine.state.pendingBuffs.has(`shenxing_baibian_buff::${def.id}`)).toBe(true)
        const dodgeMod = sumHook(def, engine, 'onDodgeChance')
        expect(dodgeMod).toBeGreaterThan(0)
        // 和 buff 自己声明的值一致（数值可调，不写死）
        expect(dodgeMod).toBeCloseTo(getBuff('shenxing_baibian_buff')!.onDodgeChance!({} as never))
        // 闪避修正进的是命中率（防御方越高越难打中）
        const noDodge = calcHitChance({
            attackerDexterity: 10,
            attackerInsight: 10,
            defenderAgility: 10,
            defenderInsight: 10,
            defenderDodgeMod: 0,
        })
        const withDodge = calcHitChance({
            attackerDexterity: 10,
            attackerInsight: 10,
            defenderAgility: 10,
            defenderInsight: 10,
            defenderDodgeMod: dodgeMod,
        })
        expect(withDodge).toBeLessThan(noDodge)
    })

    it('运行时偷奇物：addArtifact 补触发装备期效果，偷来的金丝手套照样给金丝护手', () => {
        const thief = makeChar('A', '甲')
        const victim = makeChar('B', '乙', { rewards: [reward('artifact', 'golden_silk_gloves')] })
        const engine = new BattleEngine(thief, victim, 4)
        expect(getArtifact('golden_silk_gloves')).toBeDefined()

        thief.addArtifact('golden_silk_gloves', engine)
        expect(thief.artifactDefs.some((a) => a.id === 'golden_silk_gloves')).toBe(true)
        expect(engine.state.pendingBuffs.has(`silk_guard::${thief.id}`)).toBe(true)
        expect(sumHook(thief, engine, 'onParryChance')).toBeCloseTo(0.15)

        // 不带 engine 的旧调用方（构造/测试）不能炸
        const other = makeChar('C', '丙')
        expect(other.addArtifact('golden_silk_gloves')).toBe(true)
        expect(other.addArtifact('golden_silk_gloves')).toBe(false) // 重复添加拒绝
    })
})

describe('属性下限改用 stat_restriction', () => {
    it('凌波微步：身法被减时不低于 16（原来靠 attr_floor 的读时地板）', () => {
        const c = makeChar('A', '甲', {
            baseAttrs: { strength: 10, vitality: 10, agility: 20, dexterity: 10, insight: 10, wisdom: 10 },
            rewards: [reward('passive', 'ling_bo_wei_bu')],
        })
        const engine = new BattleEngine(c, makeChar('B', '乙'), 4)
        const start = c.attrs.get('agility') // 赤手空拳自带 +2 身法，不写死 20
        expect(getPassive('ling_bo_wei_bu')).toBeDefined()
        expect(start).toBeGreaterThan(16)

        // 小幅减益照常生效（闸门只兜地板，不免疫减属性）
        applyAttrMods(c, engine.state, { agility: -2 }, 'test')
        expect(c.attrs.get('agility')).toBe(start - 2)
        // 一次减到底 → 停在 16
        applyAttrMods(c, engine.state, { agility: -(start - 16) - 5 }, 'test')
        expect(c.attrs.get('agility')).toBe(16)
    })

    it('没解锁这个天赋就不拦（同一路减属性，完整生效）', () => {
        // 身法 18 < 门槛 20 → 天赋不解锁，没有闸门
        const c = makeChar('A', '甲', {
            baseAttrs: { strength: 10, vitality: 10, agility: 18, dexterity: 10, insight: 10, wisdom: 10 },
        })
        const engine = new BattleEngine(c, makeChar('B', '乙'), 4)
        const start = c.attrs.get('agility')
        applyAttrMods(c, engine.state, { agility: -6 }, 'test')
        expect(c.attrs.get('agility')).toBe(start - 6)
    })
})
