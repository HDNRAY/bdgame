import type { CharacterBuild } from './character-build'
import { MAX_POINTS_REWARDS } from './reward'

// ════════════════════════════════════════
//  效果（写入层，与条件求值分离）
//  一切副作用统一走 Effect：写 flag / 批量写 / 数值累加 / 给实体 / 修炼点 / 疗伤。
//  无函数钩子、无引擎特判。
// ════════════════════════════════════════

export type Effect =
    | { kind: 'set'; flag: string; to: boolean | string | number } // 单条写 flag
    | { kind: 'setMany'; flags: Record<string, boolean | string | number> } // 批量写 flag（如激活故事 + 初始状态）
    | { kind: 'add'; flag: string; n: number } // 数值累加（如计数）
    | { kind: 'grant'; type: 'weapon' | 'action' | 'passive' | 'artifact'; id: string; slot?: 'main' | 'offhand' } // 给实体
    | { kind: 'points'; n: number; count?: boolean } // 修炼点；count=true 计入 16 次预算（有上限），否则为额外奖励
    | { kind: 'heal'; n: number } // 疗伤

/** 效果执行的上下文（引擎的实时状态）。 */
export interface EffectContext {
    flags: Record<string, boolean | string | number>
    build: CharacterBuild
    unspentPoints: number
    injury: number
    nodeLog: string[]
}

/** 依次执行一组效果（就地修改 ctx）。 */
export function applyEffects(ctx: EffectContext, effects: Effect[] | undefined): void {
    if (!effects) return
    for (const e of effects) {
        switch (e.kind) {
            case 'set':
                ctx.flags[e.flag] = e.to
                break
            case 'setMany':
                Object.assign(ctx.flags, e.flags)
                break
            case 'add':
                ctx.flags[e.flag] = Number(ctx.flags[e.flag] ?? 0) + e.n
                break
            case 'grant': {
                ctx.build.rewards.push({
                    id: e.id,
                    name: e.id,
                    type: e.type,
                    description: '',
                    tags: [],
                })
                if (e.type === 'weapon') {
                    if (e.slot === 'offhand') {
                        ctx.build.offhand = e.id
                    } else {
                        ctx.build.weapon = e.id
                    }
                }
                ctx.nodeLog.push(`${e.type}: ${e.id}`)
                break
            }
            case 'points': {
                const granted = Number(ctx.flags['points_granted'] ?? 0)
                if (e.count && granted >= MAX_POINTS_REWARDS) {
                    ctx.nodeLog.push('已达修炼点上限')
                    break
                }
                ctx.unspentPoints += e.n
                if (e.count) {
                    ctx.flags['points_granted'] = granted + 1
                }
                ctx.nodeLog.push(`修炼点 +${e.n}`)
                break
            }
            case 'heal':
                ctx.injury = Math.max(0, ctx.injury - e.n)
                ctx.nodeLog.push(`恢复 ${e.n} 伤势`)
                break
        }
    }
}
