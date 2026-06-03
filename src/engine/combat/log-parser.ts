import { BattleLog } from './battle-log'

export interface ParsedLogEntry {
    id: string
    icon: string
    summary: string
    details: string[]
}

/** 将结构化战斗事件解析为可读文本 */
export function parseBattleLog(log: BattleLog): ParsedLogEntry[] {
    const all = log.getAll()
    const result: ParsedLogEntry[] = []
    let lines: string[] = []

    function flush() {
        if (lines.length === 0) return
        result.push({ id: `f${result.length}`, icon: '⚔', summary: lines[0], details: lines.slice(1) })
        lines = []
    }

    for (const { event: e } of all) {
        switch (e.type) {
            case 'move':
                lines.push(`${e.actor} [移动] ${Math.abs(e.delta)}档 →${e.newDistance} [AP${e.apRemaining}]`)
                break

            case 'attack_start': {
                const name = e.actionName ? `[${e.actionName}]` : `[${e.weapon}]`
                lines.push(`${e.actor} ${name}→${e.target} [AP${e.apRemaining}]`)
                break
            }

            case 'dodge':
                // 替换上一行的 → 为闪避符号
                if (lines.length > 0) {
                    lines[lines.length - 1] = lines[lines.length - 1].replace(/→.+/, '↭')
                }
                break

            case 'parry':
                // 标记上一行被招架
                if (lines.length > 0) {
                    lines[lines.length - 1] += ' ⛨'
                }
                break

            case 'damage': {
                // 追加到上一行
                const dmg = e.isCrit ? `${e.final}💥` : `${e.final}`
                if (lines.length > 0) {
                    const line = lines[lines.length - 1]
                    if (line.includes('↭') || line.includes('✗')) {
                        // 被闪避或未命中，不显示伤害
                    } else if (line.includes('⛨')) {
                        lines[lines.length - 1] = line.replace(' ⛨', ` ⛨${dmg}`)
                    } else {
                        lines[lines.length - 1] = line.replace(/\[AP\d+\]$/, `${dmg} $&`)
                    }
                }
                break
            }

            case 'check_hit':
                if (!e.result && lines.length > 0) {
                    lines[lines.length - 1] = lines[lines.length - 1].replace(/\[AP\d+\]$/, '✗ $&')
                }
                break

            case 'defeat': {
                flush()
                result.push({ id: `e`, icon: '◆', summary: `🏆 ${e.loser} 败`, details: [] })
                break
            }

            case 'system':
                lines.push(e.message)
                break
        }
    }

    flush()
    return result
}
