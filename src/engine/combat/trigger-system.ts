import type { Character } from '../entities/character'
import type { TriggerDefinition, TriggerEvent } from '../entities/trigger'

/** 触发上下文 */
export interface TriggerContext {
    event: TriggerEvent
    actor: Character // 触发者
    target: Character // 目标（对手）
    distance: number
}

/** 触发结果 */
export interface TriggerResult {
    triggered: TriggerDefinition
    log: string
}

/** 扫描并执行触发器 */
export function processTriggers(
    ctx: TriggerContext,
    equipped: TriggerDefinition[],
    useCount: Map<string, number>,
): TriggerResult[] {
    const results: TriggerResult[] = []

    for (const t of equipped) {
        // 检查事件类型
        if (t.event !== ctx.event) continue

        // 检查额外条件
        if (t.condition?.hpBelow !== undefined) {
            const hpPct = (ctx.actor.hp / ctx.actor.maxHp) * 100
            if (hpPct > t.condition.hpBelow) continue
        }
        if (t.condition?.enemyDistance !== undefined) {
            if (ctx.distance !== t.condition.enemyDistance) continue
        }
        if (t.condition?.hasStatus !== undefined) {
            // TODO: 状态系统暂未实现
        }

        // 检查使用次数
        const used = useCount.get(t.id) ?? 0
        if (t.maxUses !== undefined && used >= t.maxUses) continue

        // 检查 AP
        if (t.apCost !== undefined) {
            ctx.actor.nextTurnApDebt = (ctx.actor.nextTurnApDebt ?? 0) + t.apCost
        }

        // 记录使用
        useCount.set(t.id, used + 1)

        // 生成日志
        results.push({
            triggered: t,
            log: t.description.split('，')[0],
        })
    }

    return results
}
