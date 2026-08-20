import { describe, it, expect } from 'vitest'
import { BattleLog } from '../combat/battle-log'
import { formatBattleLog } from '../format-log'
import type { BattleSnapshot, BattleEvent } from '../combat/types'

function mkSnap(distance = 4, posA = 0, posB = 4): BattleSnapshot {
    return {
        time: 0,
        phase: 'fighting',
        distance,
        characters: [
            {
                id: 'A', name: '方烈', hp: 100, maxHp: 100, ap: 7, maxAp: 7, chan: 0,
                pos: posA, weapon: 'long_spear', spriteId: 'a', attrs: {}, baseAttrs: {},
                buffs: [], attrBreakdown: { passives: {}, artifacts: {}, weapons: {} },
            },
            {
                id: 'B', name: '小花', hp: 100, maxHp: 100, ap: 7, maxAp: 7, chan: 0,
                pos: posB, weapon: 'iron_spear', spriteId: 'b', attrs: {}, baseAttrs: {},
                buffs: [], attrBreakdown: { passives: {}, artifacts: {}, weapons: {} },
            },
        ],
        turn: { time: 0, queue: [] },
        pendingBuffs: [],
        actionCount: 0,
    }
}

function pushEvt(log: BattleLog, evt: BattleEvent, ms: number) {
    log.push(evt, ms)
}

describe('formatBattleLog', () => {
    it('反应作用域内的 short_dash 靠近渲染为「前移」', () => {
        const log = new BattleLog()
        log.resetScope(38)
        log.beginMainAction()
        pushEvt(log, { type: 'attack_start', actor: 'B', target: 'A', weapon: 'long_spear', actionName: '点腕', apCost: 3, apRemaining: 4, snapshot: mkSnap() }, 53000)
        pushEvt(log, { type: 'check_hit', actor: 'B', target: 'A', hitChance: 0.7, roll: 0.1, result: true, snapshot: mkSnap() }, 53100)
        pushEvt(log, { type: 'damage', actor: 'B', target: 'A', actionId: 'dianwan', actionName: '点腕', base: 10, distanceMult: 1, isCrit: false, isParried: false, final: 10, blocked: 0, snapshot: mkSnap() }, 53200)
        // 小花闪避 → 进入反应作用域（scope = [38, 1, 1]）
        log.enterReaction()
        pushEvt(log, { type: 'dodge', actor: 'A', evader: 'A', snapshot: mkSnap() }, 53300)
        // 听风式：反应内 short_dash，向右移动 2（A 在对手左侧 → delta 为正也是靠近）
        pushEvt(log, { type: 'move', actor: 'A', delta: 2, newDistance: 2, apCost: 0, apRemaining: 0, kind: 'short_dash', snapshot: mkSnap(2, 2, 4) }, 53400)
        log.exitReaction()

        const { lines } = formatBattleLog(log)
        const joined = lines.join('\n')
        // 前移 必须出现（问题 2）
        expect(joined).toContain('前移')
        // 且不是「垫步」（问题 2 区分）
        expect(joined).not.toMatch(/@ 垫步/)
    })

    it('流血行不隔断后续主招（同一块内连续渲染）', () => {
        const log = new BattleLog()
        log.resetScope(40)
        // 主招 1
        log.beginMainAction()
        pushEvt(log, { type: 'attack_start', actor: 'B', target: 'A', weapon: 'long_spear', actionName: '点腕', apCost: 3, apRemaining: 4, snapshot: mkSnap() }, 42500)
        pushEvt(log, { type: 'check_hit', actor: 'B', target: 'A', hitChance: 0.7, roll: 0.1, result: true, snapshot: mkSnap() }, 42600)
        pushEvt(log, { type: 'damage', actor: 'B', target: 'A', actionId: 'dianwan', actionName: '点腕', base: 10, distanceMult: 1, isCrit: false, isParried: false, final: 10, blocked: 0, snapshot: mkSnap() }, 42700)
        // 流血 tick（系统事件前引擎会 resetScope，游离系统行）
        log.resetScope(40)
        pushEvt(log, { type: 'damage_over_time', actor: 'A', target: 'A', amount: 3, status: '流血', snapshot: mkSnap() }, 42800)
        // 主招 2（同回合）
        log.beginMainAction()
        pushEvt(log, { type: 'attack_start', actor: 'A', target: 'B', weapon: 'iron_spear', actionName: '回马枪', apCost: 2, apRemaining: 5, snapshot: mkSnap() }, 42900)
        pushEvt(log, { type: 'check_hit', actor: 'A', target: 'B', hitChance: 0.7, roll: 0.2, result: true, snapshot: mkSnap() }, 43000)
        pushEvt(log, { type: 'damage', actor: 'A', target: 'B', actionId: 'huima', actionName: '回马枪', base: 12, distanceMult: 1, isCrit: false, isParried: false, final: 12, blocked: 0, snapshot: mkSnap() }, 43100)

        const { lines } = formatBattleLog(log)
        const joined = lines.join('\n')
        // 流血行存在（问题 3 前缀保留）
        expect(joined).toContain('···')
        // 回马枪在主招 1 之后（不被流血隔到新块——验证它仍在同一回合块内）
        const i1 = joined.indexOf('点腕')
        const idot = joined.indexOf('···')
        const i2 = joined.indexOf('回马枪')
        expect(i1).toBeGreaterThanOrEqual(0)
        expect(idot).toBeGreaterThan(i1)
        expect(i2).toBeGreaterThan(idot)
    })
})
