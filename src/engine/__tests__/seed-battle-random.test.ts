import { describe, it, expect, vi } from 'vitest'
import { Character } from '../entities/character'
import { gen, YIDAO, XUNXIANG } from '../../data/opponents/index'
import { runBattle } from '../battle-runner'
import { seedBattleRandom } from './seed-battle-random'

describe('统一播种助手', () => {
    it('同一颗种子跑两遍 → 同一场战斗（胜负与双方残血都一样）', () => {
        const run = () => {
            seedBattleRandom()
            const a = new Character(gen(YIDAO, 33))
            const b = new Character(gen(XUNXIANG, 33))
            const { engine, winner } = runBattle(a, b, undefined, 4, true)
            return { winner, hp: engine.state.characters.map((c) => c.hp) }
        }
        expect(run()).toEqual(run())
    })

    it('测试自己装的 Math.random spy 仍然说了算（播种只是默认值）', () => {
        seedBattleRandom()
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
        expect(Math.random()).toBe(0.5)
        spy.mockRestore()
    })
})
