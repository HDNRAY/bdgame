import { vi } from 'vitest'
import { lcg, rng } from '../util/rng'

/** 战斗测试统一用的种子：所有跑真实战斗的测试共用一颗，红了照这颗复现 */
export const BATTLE_TEST_SEED = 20240101

/**
 * 给「跑真实战斗」的测试统一播种。
 *
 * 为什么是 `Math.random` 的 spy，而不是 `rng.seedMain()`：
 * 有一批测试自己用 `vi.spyOn(Math, 'random')` 接管骰子（偷取概率、限制器掷骰、期望伤害对照等）。
 * `seedMain` 会把主战斗流整个换成内部 LCG，主流从此不再经过 `Math.random` —— 那些 spy 会静默失效
 * （测试还在跑，但已经不受它们控制了）。用 spy 播种的话，测试里后装的 spy 自然覆盖它，
 * 两种控制方式共存：没接管的就是可复现的战斗，接管了的仍然说了算。
 *
 * 与 `rng.seedMain` 同一颗种子给出同一串数（共用 `lcg`）。
 */
export function seedBattleRandom(seed: number = BATTLE_TEST_SEED): void {
    rng.resetMain() // 保证主流直通 Math.random，spy 才真的接管
    vi.spyOn(Math, 'random').mockImplementation(lcg(seed))
}
