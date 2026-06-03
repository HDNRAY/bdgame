import { BattleLog } from './battle-log'

export function formatBattleLog(log: BattleLog): string[] {
    const all = log.getAll()
    const lines: string[] = []

    // 追踪当前 event
    let lastTime = -1
    let lastActor = ''

    function t(ms: number) { return `t=${(ms / 1000).toFixed(2)}` }

    function eventHeader(ms: number, actor: string, ap: number) {
        return `── Event ${t(ms)} [${actor}] AP${ap} ──`
    }

    /** 检测是否进入新 event，是则输出 header */
    function checkNewEvent(ms: number, actor: string, ap: number) {
        if (ms !== lastTime || actor !== lastActor) {
            lastTime = ms
            lastActor = actor
            lines.push(eventHeader(ms, actor, ap))
        }
    }

    // 缓存攻击行，等待补充结果
    let pending: { indent: string; text: string } | null = null

    function flushPending() {
        if (!pending) return
        lines.push(pending.text)
        pending = null
    }

    for (const { timelineMs: ms, event: e } of all) {
        switch (e.type) {
            case 'battle_start':
                lines.push(`── ⚔️ ${e.actor} VS ${e.opponent} ──`)
                lastTime = -1
                lastActor = ''
                break

            case 'move':
                flushPending()
                checkNewEvent(ms, e.actor, e.apRemaining + 0)
                lines.push(`  #移动→${e.newDistance}m [AP${e.apRemaining}]`)
                break

            case 'attack_start':
                flushPending()
                checkNewEvent(ms, e.actor, e.apRemaining + (e.apCost ?? 0))
                pending = { indent: '  ', text: `  #${e.actionName ?? e.weapon}（${e.apCost}AP）[AP${e.apRemaining}]` }
                break

            case 'check_hit':
                if (!e.result && pending) {
                    pending.text += ` → *未命中*`
                    flushPending()
                }
                break

            case 'dodge':
                if (pending) {
                    pending.text += ` → *${e.evader} 闪避*`
                    flushPending()
                }
                break

            case 'parry':
                if (pending) pending.text += ' → *招架'
                break

            case 'damage': {
                if (!pending) break
                const t = pending.text
                if (t.includes('闪避') || t.includes('未命中')) { flushPending(); break }
                if (t.includes('招架')) {
                    pending.text += e.isCrit ? ` ${e.final}伤害 暴击!*` : ` ${e.final}伤害*`
                } else {
                    pending.text += e.isCrit ? ` → *${e.target} ${e.final}伤害 暴击!*` : ` → *${e.target} ${e.final}伤害*`
                }
                flushPending()
                break
            }

            case 'defeat':
                flushPending()
                lines.push(`🏆 ${e.loser} 败 — ${e.winner} 胜`)
                break

            case 'system':
                flushPending()
                lines.push(`  ${e.message}`)
                break
        }
    }
    flushPending()
    return lines
}
