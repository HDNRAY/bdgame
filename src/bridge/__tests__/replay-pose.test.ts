import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from '../../engine/__tests__/seed-battle-random'
import { Character } from '../../engine/entities/character'
import { runBattle } from '../../engine/battle-runner'
import { gen, OPPONENTS } from '../../data/opponents/index'
import { BattleLog } from '../../engine/combat/battle-log'
import { ReplayEngine, isBuffMove } from '../replay-engine'
import type { BattleEvent, BattleSnapshot } from '../../engine/combat/types'

/**
 * 「加状态」姿势（buff）的判定与回放。
 *
 * 判定不新增标签，只按招式定义推导（见 isBuffMove 注释）；这里同时锁住正例
 * （喝酒/运功/护盾类辅助招）与反例（带伤害的叠劲攻击、纯位移招、普通攻击招）。
 */
describe('isBuffMove', () => {
    it('辅助招（无伤害、挂 buff、非位移）判为加状态', () => {
        for (const id of ['guard', 'dao_ma_dan', 'condense_shield', 'santou_liubi', 'wind_hear']) {
            expect(isBuffMove(id), id).toBe(true)
        }
    })

    it('攻击招 / 位移招 / 不存在的 id 都不是加状态', () => {
        for (const id of ['light_slash', 'yunv_sword', 'heavy_slash', 'yun_bu', 'not_a_real_action']) {
            expect(isBuffMove(id), id).toBe(false)
        }
    })
})

function mkSnap(ap = 7): BattleSnapshot {
    return {
        time: 0,
        phase: 'fighting',
        distance: 4,
        characters: [
            {
                id: 'A',
                name: '甲',
                hp: 100,
                maxHp: 100,
                ap,
                maxAp: 7,
                chan: 0,
                pos: 0,
                weapon: 'bare_hands',
                spriteId: 'default',
                attrs: {},
                baseAttrs: {},
                buffs: [],
                attrBreakdown: { passives: {}, artifacts: {}, weapons: {} },
            },
            {
                id: 'B',
                name: '乙',
                hp: 100,
                maxHp: 100,
                ap: 7,
                maxAp: 7,
                chan: 0,
                pos: 4,
                weapon: 'bare_hands',
                spriteId: 'default',
                attrs: {},
                baseAttrs: {},
                buffs: [],
                attrBreakdown: { passives: {}, artifacts: {}, weapons: {} },
            },
        ],
        turn: { time: 0, queue: [] },
        pendingBuffs: [],
        actionCount: 0,
    }
}

/** 造一段「A 使用辅助招」的回放日志 */
function buffLog(actionId: string) {
    const log = new BattleLog()
    log.resetScope(1)
    const events: [BattleEvent, number][] = [
        [
            { type: 'battle_start', actor: 'A', opponent: 'B', snapshot: mkSnap() },
            0,
        ],
        [
            {
                type: 'support',
                actor: 'A',
                target: 'A',
                actionId,
                actionName: actionId,
                apCost: 2,
                snapshot: mkSnap(5),
            },
            1000,
        ],
    ]
    for (const [evt, ms] of events) {
        log.beginMainAction()
        log.push(evt, ms)
    }
    return log.getAll()
}

describe('ReplayEngine buff 姿势', () => {
    it('辅助招演出窗口内行动方为 buff 姿势，非行动方保持 idle', () => {
        const engine = new ReplayEngine(buffLog('guard'))
        let sawBuff = false
        for (let t = 0; t <= engine.totalDuration; t += 100) {
            const frame = engine.getFrameAt(t)
            for (const c of frame.chars) {
                if (c.id === 'A' && c.pose === 'buff') sawBuff = true
                if (c.id === 'B' && c.pose === 'buff') throw new Error('非行动方不应为 buff 姿势')
            }
        }
        expect(sawBuff).toBe(true)
        engine.destroy()
    })

    it('普通攻击招不会出现 buff 姿势', () => {
        const engine = new ReplayEngine(buffLog('light_slash'))
        let sawBuff = false
        for (let t = 0; t <= engine.totalDuration; t += 50) {
            for (const c of engine.getFrameAt(t).chars) if (c.pose === 'buff') sawBuff = true
        }
        expect(sawBuff).toBe(false)
        engine.destroy()
    })
})

/**
 * 端到端：真打一场（引擎日志 → ReplayEngine），确认「实际放出的加状态招」会播出 buff 姿势。
 * 用「小花（听风式）」vs「一刀」这一对：小花 33 级的套牌里稳定会出加状态招。
 */
describe('真实战斗回放 · buff 姿势', () => {
    beforeEach(() => seedBattleRandom())

    it('战斗日志里的加状态招会在回放里出现 buff 姿势', () => {
        const xiaohua = OPPONENTS.find((o) => o.id === 'xiaohua')!
        const yidao = OPPONENTS.find((o) => o.id === 'yidao')!
        const { engine } = runBattle(new Character(gen(xiaohua, 33)), new Character(gen(yidao, 33)), undefined, 4, false)
        const entries = engine.state.log.getAll()
        const supports = entries.filter(
            (e): e is typeof e & { event: Extract<BattleEvent, { type: 'support' }> } => e.event.type === 'support',
        )
        const buffSupportIds = supports.filter((e) => isBuffMove(e.event.actionId)).map((e) => e.event.actionId)
        expect(new Set(buffSupportIds).size).toBeGreaterThan(0)

        const replay = new ReplayEngine(entries)
        const seen = new Set<string>()
        for (let t = 0; t <= replay.totalDuration; t += 100) {
            for (const c of replay.getFrameAt(t).chars) if (c.pose === 'buff') seen.add(c.id)
        }
        expect(seen.size).toBeGreaterThan(0)
        replay.destroy()
    })
})
