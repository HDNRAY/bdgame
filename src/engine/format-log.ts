import { BattleLog } from './combat/battle-log'
import type { BattleSnapshot } from './combat/types'

/** 从快照构建 id→name 映射 */
function buildNameMap(snapshot: BattleSnapshot): Map<string, string> {
    const map = new Map<string, string>()
    for (const c of snapshot.characters) {
        map.set(c.id, c.name)
    }
    return map
}

export function formatBattleLog(log: BattleLog): string[] {
    const all = log.getAll()
    const lines: string[] = []
    let lastTime = -1,
        lastActor = ''
    // 从第一个事件快照构建名字映射
    const nameMap = all.length > 0 ? buildNameMap(all[0].event.snapshot) : new Map<string, string>()
    const nameOf = (id: string, snap?: BattleSnapshot): string => {
        if (snap) {
            for (const c of snap.characters) if (c.id === id) return c.name
        }
        return nameMap.get(id) ?? id
    }

    /** 根据 actor 的 id 在快照中定位，返回有序 HP 信息 */
    function hpInfo(actorId: string, s: BattleSnapshot): string {
        const c0 = s.characters[0]
        const c1 = s.characters[1]
        const [first, second] = c0.id === actorId ? [c0, c1] : [c1, c0]
        const h0 = Math.round(first.hp * 10) / 10
        const h1 = Math.round(second.hp * 10) / 10
        return `HP${h0}/${first.maxHp} VS HP${h1}/${second.maxHp}`
    }

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
        indent?: number,
    ) {
        if (indent && indent > 0) return // 触发招式不建新 header
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
        indent?: number
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
            pending.indent,
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
                checkNewEvent(
                    ms,
                    nameOf(e.actor),
                    e.apRemaining + e.apCost,
                    hpInfo(e.actor, e.snapshot),
                    e.newDistance,
                    e.snapshot.actionCount,
                )
                lines.push(`  #移动 ${oldDist.toFixed(1)}→${e.newDistance.toFixed(1)}m [AP${e.apRemaining}]`)
                break
            }

            case 'attack_start':
                flush()
                pending = {
                    time: ms,
                    actor: nameOf(e.actor),
                    text: `${'  '.repeat(e.indent ?? 0)}#${e.actionName ?? e.weapon}（${e.apCost}AP）→ ${nameOf(e.target, e.snapshot)}`,
                    ap: `[AP${e.apRemaining}]`,
                    startAp: e.apRemaining + e.apCost,
                    hpInfo: hpInfo(e.actor, e.snapshot),
                    distance: e.snapshot.distance,
                    actionCount: e.snapshot.actionCount,
                    indent: e.indent ?? 0,
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
                    pending.text += ` → *${nameOf(e.evader)} 闪避*`
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
                    pending.text += ` → *${nameOf(e.target)} ${e.final}${critTag}*`
                }
                flush()
                break
            }

            case 'defeat':
                flush()
                break

            case 'system':
                flush()
                // 携带 actor 的系统消息 → 作为独立事件分组
                if (e.actor) {
                    checkNewEvent(ms, nameOf(e.actor), 0, undefined, undefined, e.snapshot?.actionCount)
                }
                const indent = '  ' + '  '.repeat(Math.max(0, e.indent ?? 0))
                lines.push(`${indent}${e.message}`)
                break
        }
    }
    flush()
    return lines
}
