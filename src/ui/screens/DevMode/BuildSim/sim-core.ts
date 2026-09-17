// ════════════════════════════════════════
//  构筑试炼 · 批量对局核心（worker 与主线程降级共用）
//  复用 runBattle（自动 clone，连打 N 场不污染）；quiet 模式不构建日志提速。
// ════════════════════════════════════════
import { Character } from '../../../../engine/entities/character'
import { runBattle } from '../../../../engine/battle-runner'
import { BattleStats, type BattleStatsSnapshot } from '../../../../engine/combat/battle-stats'
import { gen, getOpponentDef } from '../../../../data/opponents/index'
import type { CharacterBuild } from '../../../../game/entities/character-build'

/** 试炼统计等级：2 = 完整（含资源、距离、状态）——调条件时这些正是要看的 */
const STATS_LEVEL = 2 as const

export interface SeriesJob {
    opponentId: string
    n: number
    /** 对手等级（统一 33，与斗炁大会同档） */
    level: number
}

export interface SeriesResult {
    opponentId: string
    /** 实际完成场数（abort 时 < n） */
    done: number
    wins: number
    /** 我方平均残血比例（0-1；含负场） */
    avgHpPct: number
    /** N 场合并后的战斗统计（纯数据；等级 2）。done = 0 时缺省 */
    stats?: BattleStatsSnapshot
}

export interface AbortFlag {
    get aborted(): boolean
}

/** 构筑 build vs 单个对手连打 n 场 */
export function runSeries(build: CharacterBuild, job: SeriesJob, abort?: AbortFlag): SeriesResult {
    const def = getOpponentDef(job.opponentId)
    if (!def) return { opponentId: job.opponentId, done: 0, wins: 0, avgHpPct: 0 }

    // 模板角色：runBattle 内部 cloneForBattle，可安全复用
    const player = new Character(build)
    const opp = new Character(gen(def, job.level))
    let wins = 0
    let hpSum = 0
    let done = 0
    // 一场一个 BattleStats（引擎产出），每场结束 merge 进累计器 —— 与 demo 脚本同一套聚合口径
    const stats = BattleStats.accumulator(STATS_LEVEL)
    for (let i = 0; i < job.n; i++) {
        if (abort?.aborted) break
        const { winner, engine } = runBattle(player, opp, undefined, 4, true, { statsLevel: STATS_LEVEL })
        done++
        if (winner === build.id) wins++
        if (engine.stats) stats.merge(engine.stats)
        const [self] = engine.state.characters
        hpSum += self ? self.hp / self.maxHp : 0
    }
    return {
        opponentId: job.opponentId,
        done,
        wins,
        avgHpPct: done > 0 ? hpSum / done : 0,
        stats: stats.snapshot(),
    }
}
