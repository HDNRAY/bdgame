import { BattleLog } from './battle-log'

/** 将结构化战斗事件格式化为可读日志行 */
export function formatBattleLog(log: BattleLog): string[] {
    const all = log.getAll()
    const lines: string[] = []

    for (const { event: e } of all) {
        switch (e.type) {
            case 'battle_start':
                lines.push(`── ⚔️ ${e.actor} VS ${e.opponent} ──`)
                break

            case 'round_start':
                lines.push(`\n── 回合 ${e.round} ──`)
                break

            case 'move':
                lines.push(`[${e.actor}] #移动（${e.apCost}AP） → ${e.newDistance}m [AP${e.apRemaining}]`)
                break

            case 'attack_start':
                // 暂存此行，等待补充命中/伤害信息
                lines.push(`[${e.actor}] #${e.actionName ?? e.weapon}（${e.apCost}AP） [AP${e.apRemaining}]`)
                break

            case 'check_hit':
                if (!e.result) {
                    // 替换上一行：追加未命中
                    const last = lines.pop() ?? ''
                    lines.push(`${last} → *${e.target} 未命中*`)
                }
                break

            case 'dodge': {
                const last = lines.pop() ?? ''
                lines.push(`${last} → *${e.evader} 闪避*`)
                break
            }

            case 'parry': {
                // 标记招架，等 damage 事件补伤害
                const last = lines.pop() ?? ''
                lines.push(`${last} → *${e.parrier} 招架`)
                break
            }

            case 'damage': {
                const last = lines.pop() ?? ''
                if (last.includes('闪避')) {
                    lines.push(last)  // 闪避了，不追加伤害
                } else if (last.includes('招架')) {
                    // 关闭招架行
                    const suffix = e.isCrit ? ` ${e.final}伤害 暴击!*` : ` ${e.final}伤害*`
                    lines.push(`${last}${suffix}`)
                } else if (last.includes('未命中')) {
                    lines.push(last)  // 未命中，不追加伤害
                } else {
                    // 正常命中
                    const suffix = e.isCrit ? ` → *${e.target} ${e.final}伤害 暴击!*` : ` → *${e.target} ${e.final}伤害*`
                    lines.push(`${last}${suffix}`)
                }
                break
            }

            case 'defeat':
                lines.push(`\n🏆 ${e.loser} 败 — ${e.winner} 胜`)
                break

            case 'system':
                lines.push(`  ${e.message}`)
                break
        }
    }

    return lines
}
