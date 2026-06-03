import { BattleLog } from './combat/battle-log'

export function formatBattleLog(log: BattleLog): string[] {
    const all = log.getAll()
    const lines: string[] = []
    let lastTime = -1,
        lastActor = ''

    function t(ms: number) {
        return `t=${(ms / 1000).toFixed(2)}`
    }

    function checkNewEvent(
        ms: number,
        actor: string,
        ap: number,
        hpInfo?: string,
        dist?: number,
        actionCount?: number,
    ) {
        if (ms !== lastTime || actor !== lastActor) {
            if (lastTime >= 0) lines.push('')
            lastTime = ms
            lastActor = actor
            const hp = hpInfo ? ` ${hpInfo}` : ''
            const d = dist !== undefined ? ` [${dist.toFixed(1)}m]` : ''
            const ac = actionCount ? ` #${actionCount}` : ''
            if (ap > 0) {
                lines.push(`── 行动 ${t(ms)}${ac} [${actor}] AP${ap}${hp}${d} ──`)
            } else {
                lines.push(`── 行动 ${t(ms)}${ac} [${actor}]${hp}${d} ──`)
            }
        }
    }

    let pending: {
        time: number
        actor: string
        text: string
        ap?: string
        startAp: number
        hpInfo?: string
        distance?: number
        actionCount?: number
    } | null = null

    function flush() {
        if (!pending) return
        checkNewEvent(
            pending.time,
            pending.actor,
            pending.startAp,
            pending.hpInfo,
            pending.distance,
            pending.actionCount,
        )
        lines.push(`  ${pending.text}${pending.ap ? ` ${pending.ap}` : ''}`)
        pending = null
    }

    for (const { timelineMs: ms, event: e } of all) {
        switch (e.type) {
            case 'battle_start':
                lines.push(`── ${e.actor} VS ${e.opponent} ──\n`)
                break

            case 'move': {
                flush()
                const oldDist = e.newDistance - e.delta
                const s = e.snapshot
                const h0 = Math.round(s.characters[0].hp * 10) / 10
                const h1 = Math.round(s.characters[1].hp * 10) / 10
                checkNewEvent(
                    ms,
                    e.actor,
                    e.apRemaining + e.apCost,
                    `HP${h0}/${s.characters[0].maxHp} VS HP${h1}/${s.characters[1].maxHp}`,
                    e.newDistance,
                    s.actionCount,
                )
                lines.push(`  #移动 ${oldDist.toFixed(1)}→${e.newDistance.toFixed(1)}m [AP${e.apRemaining}]`)
                break
            }

            case 'attack_start':
                flush()
                pending = {
                    time: ms,
                    actor: e.actor,
                    text: `#${e.actionName ?? e.weapon}（${e.apCost}AP）`,
                    ap: `[AP${e.apRemaining}]`,
                    startAp: e.apRemaining + e.apCost,
                    hpInfo: `HP${Math.round(e.snapshot.characters[0].hp * 10) / 10}/${e.snapshot.characters[0].maxHp} VS HP${Math.round(e.snapshot.characters[1].hp * 10) / 10}/${e.snapshot.characters[1].maxHp}`,
                    distance: e.snapshot.distance,
                    actionCount: e.snapshot.actionCount,
                }
                break

            case 'check_hit':
                if (pending) {
                    pending.text += ` [命${(e.hitChance * 100).toFixed(0)}% 骰${(e.roll * 100).toFixed(0)}%]`
                    if (!e.result) {
                        pending.text += ' → *未命中*'
                        flush()
                    }
                }
                break

            case 'dodge':
                if (pending) {
                    pending.text += ` → *${e.evader} 闪避*`
                    flush()
                }
                break

            case 'parry':
                if (pending) {
                    const parryInfo =
                        e.parryChance != null
                            ? ` [招${(e.parryChance * 100).toFixed(0)}% 骰${((e.roll ?? 0) * 100).toFixed(0)}%]`
                            : ''
                    pending.text += ` → *招架${parryInfo}`
                }
                break

            case 'check_crit':
                if (pending) {
                    pending.text += ` [暴${(e.critChance * 100).toFixed(0)}% 骰${(e.roll * 100).toFixed(0)}%]`
                }
                break

            case 'damage': {
                if (!pending) break
                const t = pending.text
                if (t.includes('闪避') || t.includes('未命中')) {
                    flush()
                    break
                }
                const critTag = e.isCrit ? ' [暴]' : ''
                if (t.includes('招架')) {
                    pending.text += `${critTag} ${e.final}*`
                } else {
                    pending.text += ` → *${e.target} ${e.final}${critTag}*`
                }
                flush()
                break
            }

            case 'defeat':
                flush()
                lines.push(`[败] ${e.loser} 败 — ${e.winner} 胜\n`)
                break

            case 'system':
                flush()
                // 携带 actor 的系统消息 → 作为独立事件分组
                if (e.actor) {
                    checkNewEvent(ms, e.actor, 0, undefined, undefined, e.snapshot?.actionCount)
                }
                lines.push(`  ${e.message}`)
                break
        }
    }
    flush()
    return lines
}
