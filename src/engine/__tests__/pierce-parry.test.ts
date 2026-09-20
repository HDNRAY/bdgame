import { describe, it, expect, beforeEach } from 'vitest'
import { seedBattleRandom } from './seed-battle-random'
import { Character } from '../entities/character'
import { runBattle } from '../battle-runner'
import type { LogEvent } from '../combat/log-events'

// 战斗测试统一播种（见 seed-battle-random.ts：走 Math.random spy，自己接管骰子的测试仍然说了算）
beforeEach(() => seedBattleRandom())

/** 银针 0.5 + 一点破晓 0.5 = 100% 穿透：普通段恒为 0 */
function makePierceAttacker(): Character {
    return new Character({
        id: 'A',
        name: '甲',
        weapon: 'peach_sword',
        baseAttrs: { strength: 12, vitality: 12, agility: 14, dexterity: 16, insight: 16, wisdom: 10 },
        battleStyle: 'melee' as const,
        rewards: [
            { type: 'action', id: 'yin_zhen', name: '银针', description: '', tags: [] },
            { type: 'passive', id: 'yi_dian_po_xiao', name: '一点破晓', description: '', tags: [] },
        ],
    })
}

describe('100% 穿透 · 招架边界', () => {
    it('普通段为 0 的一击不再掷招架、不算被招架、不消耗对手 on_parry 层', () => {
        const me = makePierceAttacker()
        const foe = new Character({
            id: 'B',
            name: '乙',
            weapon: 'peach_sword', // 带 parry 标签 → 可招架
            baseAttrs: { strength: 12, vitality: 12, agility: 14, dexterity: 16, insight: 16, wisdom: 10 },
            battleStyle: 'melee' as const,
            rewards: [],
        })
        const events: LogEvent[] = []
        runBattle(me, foe, (e) => events.push(e), 4, false)

        // 我方银针命中时：不应出现「被招架」判定，也不应把伤害事件标成 isParried
        const myParryRolls = events.filter((e) => e.type === 'check_parry' && e.sourceId === me.id)
        expect(myParryRolls.length).toBe(0)
        const myHits = events.filter((e) => e.type === 'damage' && e.sourceId === me.id)
        expect(myHits.length).toBeGreaterThan(0)
        for (const h of myHits) {
            if (h.type !== 'damage') continue
            expect(h.isParried).toBe(false)
            expect(h.blocked).toBe(0) // 全穿透：招架段本来就是 0
        }
    })
})
