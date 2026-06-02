import { describe, it, expect } from 'vitest'
import { BattleEngine } from '../systems/battle-engine'
import { Character } from '../entities/character'

describe('BattleEngine', () => {
    it('should simulate a fight and determine a winner', () => {
        const player = new Character('p1', '玩家', { strength: 14, vitality: 12, dexterity: 10, technique: 10, insight: 8, wisdom: 6 })
        const opponent = new Character('o1', '野怪', { strength: 8, vitality: 8, dexterity: 6, technique: 6, insight: 4, wisdom: 3 })

        const result = BattleEngine.simulate(player, opponent)

        expect(result.winner).toBe('玩家')
        expect(result.log.getAll().length).toBeGreaterThan(0)

        // 检查日志包含关键信息
        const texts = result.log.summarize().join(' ')
        expect(texts).toContain('VS')
        expect(texts).toContain('被击败')
    })

    it('should handle distance management', () => {
        const player = new Character('p1', '远程', { technique: 12, dexterity: 14, strength: 6, vitality: 8, insight: 6, wisdom: 10 })
        const opponent = new Character('o1', '近战', { strength: 14, vitality: 10, dexterity: 8, technique: 6, insight: 4, wisdom: 3 })

        const engine = new BattleEngine(player, opponent, 5)
        const result = engine.execute({ type: 'attack', weaponType: 'thrown', bestDistance: 4 })

        // 暗器射程 2-5，距离 5 在范围内
        expect(result.hit).toBeDefined()
    })

    it('should end when a character dies', () => {
        const weak = new Character('weak', '弱者', { strength: 3, vitality: 3, dexterity: 3, technique: 3, insight: 3, wisdom: 3 })
        const strong = new Character('strong', '强者', { strength: 18, vitality: 20, dexterity: 10, technique: 14, insight: 8, wisdom: 6 })

        const result = BattleEngine.simulate(weak, strong)
        expect(result.winner).toBe('强者')
    })

    it('should record battle log entries', () => {
        const a = new Character('a', 'A', { strength: 10, vitality: 10, dexterity: 10, technique: 10, insight: 6, wisdom: 5 })
        const b = new Character('b', 'B', { strength: 10, vitality: 10, dexterity: 10, technique: 10, insight: 6, wisdom: 5 })

        const engine = new BattleEngine(a, b)
        engine.execute({ type: 'attack', weaponType: 'fist', bestDistance: 1 })

        expect(engine.state.log.getAll().length).toBeGreaterThanOrEqual(2)  // 初始 log + 行动 log
    })
})
