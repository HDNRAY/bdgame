import { BattleLog } from './battle-log'

/** 解析后的一条日志（右栏显示用） */
export interface ParsedLogEntry {
    id: string
    timestamp: number
    icon: string // ⚔ ◈ ◆ $
    summary: string // 一行摘要
    details: string[] // 可展开详情
}

/** 将结构化战斗事件解析为可读文本 */
export function parseBattleLog(log: BattleLog): ParsedLogEntry[] {
    const entries = log.getAll()
    const result: ParsedLogEntry[] = []
    let combatLines: string[] = []

    function flushCombat(): void {
        if (combatLines.length === 0) return
        result.push({
            id: `fight_${result.length}`,
            timestamp: Date.now(),
            icon: '⚔',
            summary: combatLines[0],
            details: [...combatLines],
        })
        combatLines = []
    }

    for (const entry of entries) {
        const e = entry.event

        switch (e.type) {
            case 'battle_start':
                result.push({
                    id: `start_${entry.id}`,
                    timestamp: entry.timestamp,
                    icon: '⚔',
                    summary: `⚔️ ${e.actor} VS ${e.opponent}`,
                    details: [],
                })
                break

            case 'move':
                combatLines.push(`${e.actor} 移动了 ${Math.abs(e.delta)} 档 (→${e.newDistance})`)
                break

            case 'attack_start':
                combatLines.push(`${e.actor} 使用 ${e.weapon} 攻击 ${e.target}`)
                break

            case 'check_hit': {
                const text = e.result
                    ? `${e.actor} 命中判定: ${(e.roll * 100).toFixed(0)}% ≤ ${(e.hitChance * 100).toFixed(0)}% ✅`
                    : `${e.actor} 攻击未命中! (需${(e.hitChance * 100).toFixed(0)}% 骰${(e.roll * 100).toFixed(0)}%)`
                combatLines.push(text)
                break
            }

            case 'dodge':
                combatLines.push(`${e.evader} 闪避了攻击!`)
                break

            case 'parry':
                combatLines.push(`${e.parrier} 招架了攻击!`)
                break

            case 'damage': {
                const parts = [`${e.actor} → ${e.target}`]
                if (e.isCrit) parts.push('💥暴击!')
                parts.push(`${e.final} 伤害`)
                if (e.isParried) parts.push(`(招架减伤 ${e.blocked})`)
                combatLines.push(parts.join(' '))
                break
            }

            case 'defeat': {
                flushCombat()
                result.push({
                    id: `end_${entry.id}`,
                    timestamp: entry.timestamp,
                    icon: '◆',
                    summary: `🏆 ${e.loser} 被击败! ${e.winner} 胜利`,
                    details: [],
                })
                break
            }

            case 'system':
                combatLines.push(e.message)
                break
        }
    }

    flushCombat()
    return result
}
