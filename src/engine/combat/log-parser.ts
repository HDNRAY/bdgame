import { BattleLog } from './battle-log'

export function formatBattleLog(log: BattleLog): string[] {
    const all = log.getAll()
    const lines: string[] = []
    // 缓存当前行，等待后续事件补充
    let cur: { time: number; actor: string; text: string; ap?: string } | null = null

    function t(ms: number) { return `t=${(ms / 1000).toFixed(2)}` }

    function flush() {
        if (!cur) return
        lines.push(`${t(cur.time)} [${cur.actor}] ${cur.text}${cur.ap ? ` ${cur.ap}` : ''}`)
        cur = null
    }

    /** 尝试追加到当前行（同 actor 同时间），否则 flush 后新建 */
    function append(actor: string, time: number, fragment: string, ap?: string) {
        if (cur && cur.actor === actor && cur.time === time) {
            cur.text += ` ${fragment}`
            if (ap) cur.ap = ap
        } else {
            flush()
            cur = { time, actor, text: fragment, ap }
        }
    }

    for (const { timelineMs: ms, event: e } of all) {
        switch (e.type) {
            case 'battle_start':
                flush()
                lines.push(`── ⚔️ ${e.actor} VS ${e.opponent} ──`)
                break

            case 'move':
                append(e.actor, ms, `#移动（${e.apCost}AP）→${e.newDistance}m`, `[AP${e.apRemaining}]`)
                break

            case 'attack_start':
                append(e.actor, ms, `#${e.actionName ?? e.weapon}（${e.apCost}AP）`, `[AP${e.apRemaining}]`)
                break

            case 'check_hit':
                if (!e.result && cur) cur.text += ' → *未命中*'
                break

            case 'dodge':
                if (cur) cur.text += ` → *${e.evader} 闪避*`
                break

            case 'parry':
                if (cur) cur.text += ' → *招架'
                break

            case 'damage': {
                if (!cur) break
                const c = cur.text
                if (c.includes('闪避') || c.includes('未命中')) { /* 不追加 */ }
                else if (c.includes('招架')) {
                    cur.text += e.isCrit ? ` ${e.final}伤害 暴击!*` : ` ${e.final}伤害*`
                } else {
                    cur.text += e.isCrit ? ` → *${e.target} ${e.final}伤害 暴击!*` : ` → *${e.target} ${e.final}伤害*`
                }
                break
            }

            case 'defeat':
                flush()
                lines.push(`🏆 ${e.loser} 败 — ${e.winner} 胜`)
                break

            case 'system':
                flush()
                lines.push(e.message)
                break
        }
    }
    flush()
    return lines
}
