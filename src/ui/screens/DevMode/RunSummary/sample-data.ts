import { TANGROU, gen } from '../../../../data/opponents'
import { getAction } from '../../../../data/actions'
import { ENDING_NAMES } from '../../../../data/story-intros'
import { BattleStats, type BattleStatsSnapshot } from '../../../../engine/combat/battle-stats'
import type { LogEvent } from '../../../../engine/combat/log-events'
import type { CharacterBuild } from '../../../../game/entities/character-build'
import type { RunBattleRecord } from '../../../../game/entities/state'

/**
 * DevMode「结算页」用的确定性样例数据。
 *
 * 没有真局时用它渲染，好让「结算页」随时看得见效果。数据按**真类型**造：
 *  - 构筑走 `gen(TANGROU, 33)`（无随机的生成器，与真局最终构筑同一种结构）；
 *  - 战绩是 `RunBattleRecord`；统计是往真 `BattleStats` 里喂真 `LogEvent` 再取快照
 *    （合并两场 → 面板显示「2 场合计」），不手写快照字面量，字段增删由类型兜住。
 */

/** 样例里我方角色的 id：结算页只展示 `id === 'player'` 的那一栏 */
const PLAYER = 'player'
/** 样例里对手角色 id */
const ENEMY = 'chixiao'

export interface RunSummarySample {
    title: string
    build: CharacterBuild
    injury: number
    battles: RunBattleRecord
    stats: BattleStatsSnapshot
}

/** 最终构筑：用真生成器造一份满级构筑，只把身份换成玩家 */
function sampleBuild(): CharacterBuild {
    return { ...gen(TANGROU, 33), id: PLAYER, name: '样例侠客' }
}

/** 一场战斗的事件流水（我方 + 对手各出手一次，带走位与资源消耗） */
function sampleEvents(): LogEvent[] {
    const yinZhen = getAction('yin_zhen')?.name ?? '银针'
    const pushHand = getAction('push_hand')?.name ?? '推手'
    return [
        { type: 'battle_start', actorId: PLAYER, opponentId: ENEMY },
        // 我方：银针命中并暴击，接一段持续伤害
        {
            type: 'attack_start',
            actionId: 'yin_zhen',
            actionName: yinZhen,
            weapon: 'bare_hands',
            sourceId: PLAYER,
            targetId: ENEMY,
            apCost: 1,
            apRemaining: 9,
            triggered: false,
        },
        { type: 'check_hit', sourceId: PLAYER, targetId: ENEMY, hitChance: 0.86, roll: 0.2, result: true },
        { type: 'check_crit', sourceId: PLAYER, critChance: 0.24, roll: 0.1, result: true },
        {
            type: 'damage',
            actionId: 'yin_zhen',
            actionName: yinZhen,
            sourceId: PLAYER,
            targetId: ENEMY,
            base: 11,
            final: 18.4,
            blocked: 0,
            isCrit: true,
            isParried: false,
            tags: [],
        },
        {
            type: 'damage_over_time',
            actionId: 'yin_zhen',
            actionName: yinZhen,
            sourceId: PLAYER,
            targetId: ENEMY,
            status: 'poison',
            amount: 6.5,
        },
        // 我方：触发式推手，落空
        {
            type: 'attack_start',
            actionId: 'push_hand',
            actionName: pushHand,
            weapon: 'bare_hands',
            sourceId: PLAYER,
            targetId: ENEMY,
            apCost: 0,
            apRemaining: 9,
            triggered: true,
        },
        { type: 'check_hit', sourceId: PLAYER, targetId: ENEMY, hitChance: 0.71, roll: 0.93, result: false },
        // 我方：位移到贴身（距离采样）
        { type: 'move', sourceId: PLAYER, delta: -2, newDistance: 1, apCost: 1, apRemaining: 8 },
        // 对手：劈砍命中我方（承伤来源）
        {
            type: 'attack_start',
            actionId: 'chop',
            actionName: '劈砍',
            weapon: 'taomu_jian',
            sourceId: ENEMY,
            targetId: PLAYER,
            apCost: 1,
            apRemaining: 9,
            triggered: false,
        },
        { type: 'check_hit', sourceId: ENEMY, targetId: PLAYER, hitChance: 0.6, roll: 0.3, result: true },
        {
            type: 'damage',
            actionId: 'chop',
            actionName: '劈砍',
            sourceId: ENEMY,
            targetId: PLAYER,
            base: 12,
            final: 9.5,
            blocked: 2.5,
            isCrit: false,
            isParried: false,
            tags: [],
        },
    ]
}

/** 造一份样例结算数据（每次调用都是新对象，但数字完全确定） */
export function createSampleRunSummary(): RunSummarySample {
    const stats = new BattleStats(2)
    for (const e of sampleEvents()) stats.handle(e)
    stats.setResources(PLAYER, {
        apSpent: 21,
        apDrained: 3,
        apGained: 27,
        apWasted: 2,
        chanGained: 6,
        chanSpent: 4,
        chanOverflow: 1,
    })
    stats.setResources(ENEMY, {
        apSpent: 16,
        apDrained: 0,
        apGained: 18,
        apWasted: 1,
        chanGained: 2,
        chanSpent: 3,
        chanOverflow: 0,
    })
    // 同一场合并两次 → 「2 场合计」，与真局 `runStats` 的合并口径一致
    const merged = BattleStats.mergeSnapshots([stats.snapshot(), stats.snapshot()])

    return {
        title: ENDING_NAMES.loop,
        build: sampleBuild(),
        injury: 42,
        battles: { total: 12, wins: 10, losses: 2 },
        stats: merged.snapshot(),
    }
}
