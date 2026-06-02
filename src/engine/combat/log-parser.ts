import { BattleLog } from './battle-log'

/** 解析后的一条日志（右栏显示用） */
export interface ParsedLogEntry {
    id: string
    icon: string // ⚔ ◈ ◆ $
    summary: string
    details: string[]
}

/** 将结构化战斗事件解析为可读文本 */
export function parseBattleLog(log: BattleLog): ParsedLogEntry[] {
    const all = log.getAll()
    const result: ParsedLogEntry[] = []
    let combatLines: string[] = []

    function flush() {
        if (combatLines.length === 0) return
        result.push({
            id: `f_${result.length}`,
            icon: '⚔',
            summary: combatLines[0],
            details: [...combatLines],
        })
        combatLines = []
    }

    for (const { event: e } of all) {
        switch (e.type) {
            case 'battle_start':
                result.push({ id: `s`, icon: '⚔', summary: `⚔️ ${e.actor} vs ${e.opponent}`, details: [] })
                break

            case 'move':
                combatLines.push(`${e.actor} [移动] ${Math.abs(e.delta)}档 (→${e.newDistance}) [AP${e.apRemaining}]`)
                break

            case 'attack_start': {
                const name = e.actionName ? `[${e.actionName}]` : `[${e.weapon}]`
                combatLines.push(`${e.actor} ${name} → ${e.target} [AP${e.apRemaining}]`)
                break
            }

            case 'check_hit':
                if (!e.result) {
                    combatLines.push(`  (未命中 [${(e.hitChance * 100).toFixed(0)}% 骰${(e.roll * 100).toFixed(0)}%])`)
                }
                break

            case 'dodge':
                combatLines.push(`  (${e.evader} <闪避>)`)
                break

            case 'parry':
                combatLines.push(`  (${e.parrier} <招架>)`)
                break

            case 'damage': {
                const parts = [`  → ${e.final}伤害`]
                if (e.isCrit) parts.push('💥暴击')
                if (e.isParried) parts.push(`(招架-${e.blocked})`)
                combatLines.push(parts.join(' '))
                break
            }

            case 'defeat': {
                flush()
                result.push({ id: `e`, icon: '◆', summary: `🏆 ${e.loser} 败 — ${e.winner} 胜`, details: [] })
                break
            }

            case 'system':
                combatLines.push(`  ${e.message}`)
                break
        }
    }

    flush()
    return result
}
