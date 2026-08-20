import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../combat/engine'
import { processActionEffect } from '../combat/effects/action'
import { Character } from '../entities/character'
import type { EffectDef } from '../entities/action'
import type { BuffLayer } from '../combat/types'

// ─────────────────────────────────────────────────────────────────────────────
// 测试基建：真实 BattleEngine（quiet）+ 直接 processActionEffect
// ─────────────────────────────────────────────────────────────────────────────

function makeChar(id: string, attrs: Record<string, number> = {}): Character {
    return new Character({
        id,
        name: id,
        story: 'balanced',
        // 用 peach_sword 而非 bare_hands：bare_hands 自带 stat_buff 身法+2，会污染属性断言
        weapon: 'peach_sword',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10, ...attrs },
        rewards: [],
    })
}

interface Fixture {
    engine: BattleEngine
    a: Character
    b: Character
}

function makeFixture(attrsA: Record<string, number> = {}, attrsB: Record<string, number> = {}): Fixture {
    const a = makeChar('a', attrsA)
    const b = makeChar('b', attrsB)
    const engine = new BattleEngine(a, b, 4, true)
    return { engine, a, b }
}

function apply(engine: BattleEngine, eff: EffectDef, self: Character): void {
    const enemy = engine.getOpponent(self.id)!
    processActionEffect(eff, { self, enemy, engine, tMs: engine.state.eventTime })
}

function layer(engine: BattleEngine, buffId: string, charId: string): BuffLayer | undefined {
    return engine.state.pendingBuffs.get(`${buffId}::${charId}`)
}

function layerKeys(engine: BattleEngine, prefix: string): string[] {
    return [...engine.state.pendingBuffs.keys()].filter((k) => k.startsWith(prefix))
}

function hasSystemEvent(engine: BattleEngine, id: string): boolean {
    return engine.state.turn.entries.some((e) => e.type === 'system' && e.id === id)
}

function systemEventTime(engine: BattleEngine, id: string): number | undefined {
    return engine.state.turn.entries.find((e) => e.type === 'system' && e.id === id)?.nextActionAt
}

// ─────────────────────────────────────────────────────────────────────────────
// add_buff
// ─────────────────────────────────────────────────────────────────────────────

describe('add_buff', () => {
    it('creates a new layer and applies attrMods', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'calming_fragrance', stacks: 1 }, a)

        const l = layer(engine, 'calming_fragrance', 'a')
        expect(l).toBeDefined()
        expect(l!.restoreValue).toBe(1)
        expect(a.attrs.get('insight')).toBe(12) // 10 + 2
        expect(a.attrs.get('wisdom')).toBe(12) // 10 + 2
        expect(l!.mods).toMatchObject({ insight: 2, wisdom: 2 })
    })

    it('re-applying a non-additive (none) buff is idempotent', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'calming_fragrance', stacks: 1 }, a)
        apply(engine, { type: 'add_buff', buffId: 'calming_fragrance', stacks: 1 }, a)

        expect(layerKeys(engine, 'calming_fragrance::a').length).toBe(1)
        expect(a.attrs.get('insight')).toBe(12) // 未重复叠加
    })

    it('additive buff stacks and caps at max, scaling attrMods per layer', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(a.attrs.get('strength')).toBe(14)
        expect(a.attrs.get('agility')).toBe(8)

        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(layer(engine, 'vigor_stance', 'a')!.restoreValue).toBe(2)
        expect(a.attrs.get('strength')).toBe(18)
        expect(a.attrs.get('agility')).toBe(6)

        // 已达上限（max:2），再多叠不上去
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 3 }, a)
        expect(layer(engine, 'vigor_stance', 'a')!.restoreValue).toBe(2)
        expect(a.attrs.get('strength')).toBe(18)
    })

    it('additive buff with stacks:0 is skipped (no layer created)', () => {
        // 回归保护：靠 hook 叠层的 additive buff 若以 stacks:0 初始化会被 add_buff 跳过
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 0 }, a)

        expect(layer(engine, 'vigor_stance', 'a')).toBeUndefined()
        expect(a.attrs.get('strength')).toBe(10)
        expect(a.attrs.get('agility')).toBe(10)
    })

    it('add_buff first apply does NOT cap additive at max (preserves legacy, e.g. zhou stacks:2 > max:1)', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'zhou', stacks: 2 }, a)
        expect(layer(engine, 'zhou', 'a')!.restoreValue).toBe(2) // 首次建层不按上限截断
        expect(a.attrs.get('strength')).toBe(14) // 每层 +2，两层 +4
    })

    it('non-additive fractional-stack buff (yuwu_cost) keeps fractional restoreValue (not floored by stackGate)', () => {
        // 回归保护：御物耗炁 stacks:0.4 是 non-additive 分数层，不能经过 onStackGain 的 Math.floor
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'yuwu_cost', stacks: 0.5 }, a)
        expect(layer(engine, 'yuwu_cost', 'a')!.restoreValue).toBe(0.5)
    })

    it('duration buff schedules a buff_end system event', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)

        expect(hasSystemEvent(engine, 'buff_end_vigor_stance::a')).toBe(true)
        expect(systemEventTime(engine, 'buff_end_vigor_stance::a')).toBe(20000) // 0 + 20000ms
    })

    it('stacking a duration buff refreshes (re-schedules) its expiry', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(systemEventTime(engine, 'buff_end_vigor_stance::a')).toBe(20000)

        // 推进战斗时间再叠一层 → 到期事件应重新计时
        engine.state.eventTime = 5000
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(systemEventTime(engine, 'buff_end_vigor_stance::a')).toBe(25000)
    })

    it('independent buff creates one layer per application with unique keys', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'you_shen', stacks: 1 }, a)
        apply(engine, { type: 'add_buff', buffId: 'you_shen', stacks: 1 }, a)

        const keys = layerKeys(engine, 'you_shen::a::')
        expect(keys.length).toBe(2)
        expect(a.attrs.get('agility')).toBe(12) // 每层 +1，两层
        expect(a.attrs.get('dexterity')).toBe(12)
    })

    it('applying a stance buff auto-replaces the previous stance', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'melee_stance', stacks: 1 }, a)
        expect(layer(engine, 'melee_stance', 'a')).toBeDefined()

        apply(engine, { type: 'add_buff', buffId: 'polearm_stance', stacks: 1 }, a)
        expect(layer(engine, 'melee_stance', 'a')).toBeUndefined()
        expect(layer(engine, 'polearm_stance', 'a')).toBeDefined()
    })

    it('maxApMod buff lowers AP cap on apply and stacks (capped)', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'ap_drain', stacks: 1 }, a)
        expect(a.maxApMod).toBe(-1)

        apply(engine, { type: 'add_buff', buffId: 'ap_drain', stacks: 1 }, a)
        expect(a.maxApMod).toBe(-2)

        apply(engine, { type: 'add_buff', buffId: 'ap_drain', stacks: 1 }, a)
        expect(a.maxApMod).toBe(-2) // max:2 封顶
    })

    it('onStackGain hook blocks stacking when resource is insufficient', () => {
        const { engine, a } = makeFixture()
        // 真假无用：所有 additive buff 叠层需 2 缠/层，且上限翻倍
        apply(engine, { type: 'add_buff', buffId: 'yuxin_sword_mastery', stacks: 1 }, a)
        expect(a.chan).toBe(0)

        // 缠不足 → 叠层被拦截，不建层、不扣缠
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(layer(engine, 'vigor_stance', 'a')).toBeUndefined()
        expect(a.chan).toBe(0)
    })

    it('onStackGain hook spends resource and onBuffApply doubles the max', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'yuxin_sword_mastery', stacks: 1 }, a)
        a.chan = 100

        // 叠到 4 层（vigor_stance 原始 max:2，真假无用 onBuffApply 翻倍 → 4）
        for (let i = 0; i < 4; i++) {
            apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        }
        expect(layer(engine, 'vigor_stance', 'a')!.restoreValue).toBe(4)
        expect(a.chan).toBe(100 - 4 * 2) // 每层扣 2 缠

        // 第 5 层被翻倍上限拦住，不再扣缠
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(layer(engine, 'vigor_stance', 'a')!.restoreValue).toBe(4)
        expect(a.chan).toBe(100 - 4 * 2)
    })

    it('super_armor buff clears existing CC layers (stun/knockdown/disarmed)', () => {
        const { engine, a } = makeFixture()
        engine.state.pendingBuffs.set('stun::a', { restoreValue: 1 })
        engine.state.pendingBuffs.set('knockdown::a', { restoreValue: 1 })
        engine.state.pendingBuffs.set('disarmed::a', { restoreValue: 1 })

        apply(engine, { type: 'add_buff', buffId: 'yuanting_yuezhi', stacks: 1 }, a)

        expect(layer(engine, 'stun', 'a')).toBeUndefined()
        expect(layer(engine, 'knockdown', 'a')).toBeUndefined()
        expect(layer(engine, 'disarmed', 'a')).toBeUndefined()
        expect(layer(engine, 'yuanting_yuezhi', 'a')).toBeDefined()
    })

    it('tickInterval buff schedules a tick_buff system event', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vitality_regen', stacks: 1 }, a)

        expect(hasSystemEvent(engine, 'tick_buff_vitality_regen::a')).toBe(true)
        expect(systemEventTime(engine, 'tick_buff_vitality_regen::a')).toBe(2000)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// add_debuff
// ─────────────────────────────────────────────────────────────────────────────

describe('add_debuff', () => {
    it('chance:0 applies nothing (no layer)', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'poison', stacks: 3, chance: 0 }, a)
        expect(layer(engine, 'poison', 'b')).toBeUndefined()
    })

    it('chance:1 applies all stacks and triggers onDebuffApply (remainingTicks)', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'poison', stacks: 3, chance: 1 }, a)

        const l = layer(engine, 'poison', 'b')
        expect(l).toBeDefined()
        expect(l!.restoreValue).toBe(3)
        expect((l!.extra?.remainingTicks as number[]).length).toBe(3)
        expect(l!.sourceId).toBe('a')
    })

    it('poison schedules a tick_poison system event', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'poison', stacks: 2, chance: 1 }, a)
        expect(hasSystemEvent(engine, 'tick_poison_b')).toBe(true)
        expect(systemEventTime(engine, 'tick_poison_b')).toBe(1600) // 2000 - 2×200
    })

    it('burn schedules a tick_burn system event', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'burn', stacks: 1, chance: 1 }, a)
        expect(layer(engine, 'burn', 'b')!.restoreValue).toBe(1)
        expect(hasSystemEvent(engine, 'tick_burn_b')).toBe(true)
    })

    it('additive debuff stacks up to max', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'shen_jian_mark', stacks: 2, chance: 1 }, a)
        apply(engine, { type: 'add_debuff', buffId: 'shen_jian_mark', stacks: 2, chance: 1 }, a)
        apply(engine, { type: 'add_debuff', buffId: 'shen_jian_mark', stacks: 2, chance: 1 }, a)
        expect(layer(engine, 'shen_jian_mark', 'b')!.restoreValue).toBe(5) // max:5 封顶
    })
    it('add_debuff first apply caps additive at max', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'shen_jian_mark', stacks: 6, chance: 1 }, a)
        expect(layer(engine, 'shen_jian_mark', 'b')!.restoreValue).toBe(5) // max:5 封顶
    })
    it('re-applying a none-stacking debuff is skipped', () => {
        const { engine, a, b } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'sand_blind', stacks: 1, chance: 1 }, a)
        apply(engine, { type: 'add_debuff', buffId: 'sand_blind', stacks: 1, chance: 1 }, a)

        expect(layerKeys(engine, 'sand_blind::b').length).toBe(1)
        expect(b.attrs.get('insight')).toBe(6) // 10 - 4，仅减一次
    })

    it('onReceiveDebuff hook can fully resist a debuff', () => {
        const { engine, a, b } = makeFixture()
        // 渊渟岳峙：免疫 眩晕/倒地/缴械
        apply(engine, { type: 'add_buff', buffId: 'yuanting_yuezhi', stacks: 1 }, b)
        apply(engine, { type: 'add_debuff', buffId: 'stun', stacks: 1, chance: 1 }, a)

        expect(layer(engine, 'stun', 'b')).toBeUndefined()
    })

    it('stun applies attribute reduction via afterApplyDebuff', () => {
        const { engine, a, b } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'stun', stacks: 1, chance: 1 }, a)

        // stun 是 independent 叠层，key 带 appId 后缀
        expect(layerKeys(engine, 'stun::b::').length).toBe(1)
        expect(b.attrs.get('agility')).toBeLessThan(10)
        expect(b.attrs.get('insight')).toBeLessThan(10)
    })

    it('independent debuff creates one layer per application', () => {
        const { engine, a, b } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 1 }, a)
        apply(engine, { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 1 }, a)

        expect(layerKeys(engine, 'paralyze::b::').length).toBe(2)
        expect(b.attrs.get('agility')).toBe(8) // 每层 -1，两层
        expect(b.attrs.get('dexterity')).toBe(8)
    })

    it('duration debuff schedules a buff_end and applies attrMods', () => {
        const { engine, a, b } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'confuse', stacks: 2, chance: 1 }, a)

        // confuse 为 independent 叠层（key 带 appId 后缀）
        const keys = layerKeys(engine, 'confuse::b::')
        expect(keys.length).toBe(1)
        expect(engine.state.pendingBuffs.get(keys[0])!.restoreValue).toBe(2)
        expect(b.attrs.get('wisdom')).toBe(8) // 10 - 2
        expect(hasSystemEvent(engine, `buff_end_${keys[0]}`)).toBe(true)
    })

    it('records the attacker as sourceId', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_debuff', buffId: 'bleed', stacks: 1, chance: 1 }, a)
        expect(layer(engine, 'bleed', 'b')!.sourceId).toBe('a')
    })

    it('applying poison broadcasts on_poison via the debuff onDebuffApply hook', () => {
        const { engine, a } = makeFixture()
        // 攻击方挂一个 on_poison 触发槽：施加中毒时给自己叠「定心清香」
        a.passiveTriggers.push({
            condition: { type: 'on_poison' },
            effects: [{ type: 'add_buff', buffId: 'calming_fragrance', stacks: 1 }],
        })

        apply(engine, { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 }, a)

        // 施加中毒 → poison.onDebuffApply 广播 on_poison → 攻击方触发槽生效
        expect(layer(engine, 'calming_fragrance', 'a')).toBeDefined()
        expect(a.attrs.get('insight')).toBe(12)
    })

    it('applying bleed broadcasts on_bleed to drive the attacker trigger (方烈·追击枪)', () => {
        const { engine, a } = makeFixture()
        a.passiveTriggers.push({
            condition: { type: 'on_bleed' },
            effects: [{ type: 'add_buff', buffId: 'calming_fragrance', stacks: 1 }],
        })

        apply(engine, { type: 'add_debuff', buffId: 'bleed', stacks: 1, chance: 1 }, a)

        // 施加流血 → bleed.onDebuffApply 广播 on_bleed → 攻击方触发槽生效
        expect(layer(engine, 'calming_fragrance', 'a')).toBeDefined()
    })

    it('victim-side on_debuff + buffId:poison fires when the target is poisoned (战术腰包解毒机制)', () => {
        const { engine, a, b } = makeFixture()
        // 受害者 b 挂 on_debuff + buffId=poison 触发槽：中毒时给自己叠「定心清香」
        b.passiveTriggers.push({
            condition: { type: 'on_debuff', buffId: 'poison', check: () => true },
            effects: [{ type: 'add_buff', buffId: 'calming_fragrance', stacks: 1 }],
        })

        apply(engine, { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 }, a)

        // 施加中毒 → on_debuff(受害者侧)+buffId 过滤 → 受害者触发槽生效
        expect(layer(engine, 'calming_fragrance', 'b')).toBeDefined()
        expect(b.attrs.get('insight')).toBe(12)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// remove_buff
// ─────────────────────────────────────────────────────────────────────────────

describe('remove_buff', () => {
    it('removes the layer and fully reverts attrMods', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(a.attrs.get('strength')).toBe(18)

        apply(engine, { type: 'remove_buff', buffId: 'vigor_stance' }, a)

        expect(layer(engine, 'vigor_stance', 'a')).toBeUndefined()
        expect(a.attrs.get('strength')).toBe(10)
        expect(a.attrs.get('agility')).toBe(10)
    })

    it('removes the scheduled buff_end event on full removal', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(hasSystemEvent(engine, 'buff_end_vigor_stance::a')).toBe(true)

        apply(engine, { type: 'remove_buff', buffId: 'vigor_stance' }, a)
        expect(hasSystemEvent(engine, 'buff_end_vigor_stance::a')).toBe(false)
    })

    it('no-ops when the layer does not exist', () => {
        const { engine, a } = makeFixture()
        expect(() => apply(engine, { type: 'remove_buff', buffId: 'vigor_stance' }, a)).not.toThrow()
        expect(a.attrs.get('strength')).toBe(10)
    })

    it('partial removal (stacks) decrements the layer count', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)

        apply(engine, { type: 'remove_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(layer(engine, 'vigor_stance', 'a')!.restoreValue).toBe(1)
    })

    it('partial removal reverts attrMods proportionally to removed stacks', () => {
        const { engine, a } = makeFixture()
        // 2 层 vigor_stance：力量 +8、身法 -4
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        expect(a.attrs.get('strength')).toBe(18)
        expect(a.attrs.get('agility')).toBe(6)

        // 移除 1/2 层 → 回退一半：力量 +8→+4、身法 -4→-2
        apply(engine, { type: 'remove_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        const l = layer(engine, 'vigor_stance', 'a')!
        expect(l.restoreValue).toBe(1)
        expect(a.attrs.get('strength')).toBe(14)
        expect(a.attrs.get('agility')).toBe(8)
        expect(l.mods).toMatchObject({ strength: 4, agility: -2 })
    })

    it('partial removal with stacks >= layer goes through full removal', () => {
        const { engine, a } = makeFixture()
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)
        apply(engine, { type: 'add_buff', buffId: 'vigor_stance', stacks: 1 }, a)

        apply(engine, { type: 'remove_buff', buffId: 'vigor_stance', stacks: 2 }, a)
        expect(layer(engine, 'vigor_stance', 'a')).toBeUndefined()
        expect(a.attrs.get('strength')).toBe(10)
    })

    it('removes a disarmed layer (no special casing breaks removal)', () => {
        const { engine, a } = makeFixture()
        engine.state.pendingBuffs.set('disarmed::a', { restoreValue: 1 })

        apply(engine, { type: 'remove_buff', buffId: 'disarmed' }, a)
        expect(layer(engine, 'disarmed', 'a')).toBeUndefined()
    })
})
