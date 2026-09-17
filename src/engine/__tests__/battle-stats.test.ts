import { describe, it, expect } from 'vitest'
import { BattleStats } from '../combat/battle-stats'
import type { LogEvent } from '../combat/log-events'

/** 构造日志事件的小工具（字段与 log-events.ts 对齐） */
const attack = (over: Partial<Extract<LogEvent, { type: 'attack_start' }>> = {}): LogEvent => ({
    type: 'attack_start',
    actionId: 'a1',
    actionName: '甲招',
    weapon: '剑',
    sourceId: 'p1',
    targetId: 'p2',
    apCost: 2,
    apRemaining: 3,
    triggered: false,
    ...over,
})

const hit = (result: boolean): LogEvent => ({
    type: 'check_hit',
    sourceId: 'p1',
    targetId: 'p2',
    hitChance: 0.8,
    roll: result ? 0.1 : 0.9,
    result,
})

const damage = (over: Partial<Extract<LogEvent, { type: 'damage' }>> = {}): LogEvent => ({
    type: 'damage',
    actionId: 'a1',
    actionName: '甲招',
    sourceId: 'p1',
    targetId: 'p2',
    base: 20,
    final: 12,
    blocked: 8,
    isCrit: false,
    isParried: false,
    tags: [],
    ...over,
})

describe('BattleStats 口径', () => {
    it('输出 / 承伤 / 命中 面板：命中数来自 check_hit，招架来自 check_parry', () => {
        const s = new BattleStats(1)
        s.handle(attack())
        s.handle(hit(true))
        s.handle({
            type: 'check_parry',
            sourceId: 'p1',
            targetId: 'p2',
            parryChance: 0.3,
            roll: 0.1,
            result: true,
        })
        s.handle({ type: 'check_crit', sourceId: 'p1', critChance: 0.2, roll: 0.05, result: true })
        s.handle(damage({ final: 12, blocked: 8 }))

        const p1 = s.chars.get('p1')!
        expect(p1.casts).toBe(1)
        expect(p1.hits).toBe(1)
        expect(p1.hitsWithDamage).toBe(1)
        expect(p1.parried).toBe(1)
        expect(p1.crits).toBe(1)
        expect(p1.dealt).toBe(12)
        expect(p1.actions.get('a1')!.damage).toBe(12)

        const p2 = s.chars.get('p2')!
        expect(p2.taken).toBe(12)
        expect(p2.mitigated).toBe(8)
        expect(p2.takenByAction.get('a1')!.amount).toBe(12)
    })

    it('被闪避：check_hit 失败计入被闪避、不计命中', () => {
        const s = new BattleStats(1)
        s.handle(attack())
        s.handle(hit(false))
        const p1 = s.chars.get('p1')!
        expect(p1.casts).toBe(1)
        expect(p1.hits).toBe(0)
        expect(p1.dodged).toBe(1)
    })

    it('打中但没造成伤害：命中算数、伤害为 0（零伤）', () => {
        const s = new BattleStats(1)
        s.handle(attack())
        s.handle(hit(true))
        const p1 = s.chars.get('p1')!
        expect(p1.hits).toBe(1)
        expect(p1.hitsWithDamage).toBe(0)
        expect(p1.dealt).toBe(0)
    })

    it('附伤按 tags 里的 bonus_damage 单列，不污染命中数', () => {
        const s = new BattleStats(1)
        s.handle(attack())
        s.handle(damage({ final: 10 }))
        s.handle(damage({ actionId: 'bonus', actionName: '雷法', final: 4, tags: ['bonus_damage'] }))
        const p1 = s.chars.get('p1')!
        expect(p1.dealtDirect).toBe(10)
        expect(p1.dealtBonus).toBe(4)
        expect(p1.dealt).toBe(14)
        expect(p1.hitsWithDamage).toBe(1)
        expect(p1.actions.get('bonus')!.bonus).toBe(4)
    })

    it('DoT 单列，来源缺失时归到承受方', () => {
        const s = new BattleStats(1)
        s.handle({ type: 'damage_over_time', actionId: 'burn', actionName: '灼烧', status: 'burn', targetId: 'p2', amount: 6 })
        const p2 = s.chars.get('p2')!
        expect(p2.dealtDot).toBe(6)
        expect(p2.taken).toBe(6)
    })

    it('治疗按有效 / 溢出记账', () => {
        const s = new BattleStats(1)
        s.handle({ type: 'heal', actionId: 'h', actionName: '回春', sourceId: 'p1', targetId: 'p1', amount: 20, effective: 15, overheal: 5 })
        const p1 = s.chars.get('p1')!
        expect(p1.heal).toBe(15)
        expect(p1.overheal).toBe(5)
    })

    it('失手单独计数、不计入出手数（失手发生在 attack_start 之前）', () => {
        const s = new BattleStats(1)
        s.handle({ type: 'fumble', sourceId: 'p1' })
        const p1 = s.chars.get('p1')!
        expect(p1.fumbles).toBe(1)
        expect(p1.casts).toBe(0)
    })

    it('level 1 不收资源与距离；level 2 收（按招式归属的消耗）', () => {
        const l1 = new BattleStats(1)
        l1.handle(attack({ chanCost: 30 }))
        l1.handle({ type: 'move', sourceId: 'p1', delta: -2, newDistance: 2, apCost: 1, apRemaining: 2 })
        expect(l1.chars.get('p1')!.actions.get('a1')!.chanSpent).toBe(0)
        expect(l1.chars.get('p1')!.distanceSamples).toBe(0)

        const l2 = new BattleStats(2)
        l2.handle(attack({ chanCost: 30 }))
        l2.handle({ type: 'move', sourceId: 'p1', delta: -2, newDistance: 2, apCost: 1, apRemaining: 2 })
        expect(l2.chars.get('p1')!.actions.get('a1')!.chanSpent).toBe(30)
        expect(l2.chars.get('p1')!.actions.get('a1')!.apSpent).toBe(2)
        expect(l2.chars.get('p1')!.distanceSamples).toBe(1)
        expect(l2.chars.get('p1')!.distanceSum).toBe(2)
    })

    it('资源总账只认 setResources（角色自己记账），merge 逐项累加', () => {
        const s = new BattleStats(2)
        s.setResources('p1', {
            apSpent: 12,
            apDrained: 1,
            apGained: 20,
            apWasted: 4,
            chanGained: 9,
            chanSpent: 6,
            chanOverflow: 3,
        })
        const p1 = s.chars.get('p1')!
        expect(p1.res.chanSpent).toBe(6)
        expect(p1.res.apWasted).toBe(4)

        // 招式事件不会污染角色总账
        s.handle(attack({ chanCost: 30 }))
        expect(p1.res.chanSpent).toBe(6)

        const other = new BattleStats(2)
        other.setResources('p1', {
            apSpent: 1,
            apDrained: 0,
            apGained: 2,
            apWasted: 0,
            chanGained: 0,
            chanSpent: 1,
            chanOverflow: 0,
        })
        s.merge(other)
        expect(p1.res.apSpent).toBe(13)
        expect(p1.res.chanSpent).toBe(7)
        expect(p1.res.apGained).toBe(22)

        // 快照必须深拷贝，否则合并会串场
        const snap = s.snapshot()
        expect(snap.chars.find((c) => c.id === 'p1')!.res).not.toBe(p1.res)
    })

    it('merge 累加（脚本跑 N 场用）', () => {
        const a = new BattleStats(1)
        a.handle(attack())
        a.handle(hit(true))
        a.handle(damage({ final: 10 }))
        const b = new BattleStats(1)
        b.handle(attack())
        b.handle(hit(false))
        b.handle(damage({ final: 6 }))

        const total = BattleStats.accumulator(1)
        total.merge(a)
        total.merge(b)
        const p1 = total.chars.get('p1')!
        expect(p1.casts).toBe(2)
        expect(p1.hits).toBe(1)
        expect(p1.dodged).toBe(1)
        expect(p1.dealt).toBe(16)
        expect(p1.actions.get('a1')!.casts).toBe(2)
        expect(p1.actions.get('a1')!.damage).toBe(16)
    })

    it('样本场数：新建算 1 场，aggregator 从 0 起算，merge 逐场累加', () => {
        expect(new BattleStats(1).battles).toBe(1)
        const acc = BattleStats.accumulator(1)
        expect(acc.battles).toBe(0)
        acc.merge(new BattleStats(1))
        acc.merge(new BattleStats(1))
        acc.merge(new BattleStats(1))
        expect(acc.battles).toBe(3)
        expect(acc.snapshot().battles).toBe(3)
    })

    it('snapshot → fromSnapshot 往返一致，mergeSnapshots 等于直接 merge', () => {
        const a = new BattleStats(2)
        a.handle(attack({ chanCost: 3 }))
        a.handle(hit(true))
        a.handle(damage({ final: 10, tags: ['bonus_damage'] }))
        a.setResources('p1', {
            apSpent: 5,
            apDrained: 0,
            apGained: 6,
            apWasted: 1,
            chanGained: 9,
            chanSpent: 3,
            chanOverflow: 2,
        })
        const b = new BattleStats(2)
        b.handle(attack({ actionId: 'a2', actionName: '乙招' }))
        b.handle(hit(false))

        const snapA = a.snapshot()
        const snapB = b.snapshot()
        expect(BattleStats.fromSnapshot(snapA).snapshot()).toEqual(snapA)
        expect(BattleStats.mergeSnapshots([snapA, snapB]).snapshot()).toEqual(
            (() => {
                const acc = BattleStats.accumulator(2)
                acc.merge(a)
                acc.merge(b)
                return acc.snapshot()
            })(),
        )
        // 空列表不炸
        expect(BattleStats.mergeSnapshots([]).battles).toBe(0)
    })

    it('snapshot 把 Map 换成数组（跨到 UI 用）', () => {
        const s = new BattleStats(2)
        s.handle(attack())
        s.handle(damage())
        const snap = s.snapshot()
        expect(snap.level).toBe(2)
        expect(snap.chars[0].actions[0].actionId).toBe('a1')
        expect(Array.isArray(snap.chars[0].takenByAction)).toBe(true)
    })

    it('命中率的分母是判定次数：连发一招多判，用出手当分母会超过 100%', () => {
        const s = new BattleStats(1)
        s.handle(attack()) // 1 次出手
        s.handle(hit(true))
        s.handle(hit(true))
        s.handle(hit(true))
        s.handle(hit(false)) // 共 4 次判定（1 次出手打出 4 段）
        s.handle(damage({ final: 5 })) // 报告只列有输出的角色
        const p1 = s.chars.get('p1')!
        expect(p1.casts).toBe(1)
        expect(p1.hits).toBe(3)
        expect(p1.dodged).toBe(1)
        const text = s.format({ p1: '甲' }).join('\n')
        expect(text).toContain('出手 1  判定 4')
        expect(text).toContain('命中 3（75.0%）')
        expect(text).toContain('命中 3（判定 4）') // 按招式明细同口径
    })

    it('format 能出报告且包含关键分区', () => {
        const s = new BattleStats(2)
        s.handle(attack())
        s.handle(hit(true))
        s.handle(damage())
        s.handle({ type: 'move', sourceId: 'p1', delta: -2, newDistance: 1, apCost: 1, apRemaining: 2 })
        const text = s.format({ p1: '甲', p2: '乙' }).join('\n')
        expect(text).toContain('伤害输出')
        expect(text).toContain('承伤')
        expect(text).toContain('资源与距离')
        expect(text).toContain('甲')
    })
})
