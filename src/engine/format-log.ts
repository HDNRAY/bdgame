import { BattleLog } from './combat/battle-log'
import type { BattleSnapshot } from './combat/types'

/** 符号体系:
 *  「」 人名    # 主动行动    ↳ 触发招式    + 辅招
 *  ()  AP消耗   → 方向/目标   » 判定结果    · 率·骰分隔
 *  []  状态名   |  信息分隔
 */

/** 从快照构建 id→name 映射 */
function buildNameMap(snapshot: BattleSnapshot): Map<string, string> {
    const map = new Map<string, string>()
    for (const c of snapshot.characters) {
        map.set(c.id, c.name)
    }
    return map
}

export function formatBattleLog(log: BattleLog): { lines: string[]; eventToLine: number[] } {
    const all = log.getAll()
    const lines: string[] = []
    // eventToLine[i] = 事件 i 处理完后可见的最后一行索引（含）
    const eventToLine: number[] = []
    let lastActionKey = ''
    const nameMap = all.length > 0 ? buildNameMap(all[0].event.snapshot) : new Map<string, string>()
    const fmtName = (id: string, snap?: BattleSnapshot): string => {
        let name = id
        if (snap) {
            for (const c of snap.characters)
                if (c.id === id) {
                    name = c.name
                    break
                }
        } else {
            name = nameMap.get(id) ?? id
        }
        return `「${name}」`
    }

    function hpInfo(actorId: string, s: BattleSnapshot): string {
        const c0 = s.characters[0]
        const c1 = s.characters[1]
        const [first, second] = c0.id === actorId ? [c0, c1] : [c1, c0]
        const h0 = Math.round(first.hp * 10) / 10
        const h1 = Math.round(second.hp * 10) / 10
        let info = `HP${h0}/${first.maxHp} VS HP${h1}/${second.maxHp}`
        // 查 actor 的缠层数
        const actor = c0.id === actorId ? c0 : c1
        if (actor.chan > 0) info += ` 缠${actor.chan}`
        return info
    }

    function t(ms: number) {
        return `${(ms / 1000).toFixed(2)}s`
    }

    /** 率·骰 统一格式 */
    function roll(kind: string, rate: number, rollVal: number): string {
        return `${kind}${(rate * 100).toFixed(0)}%·${(rollVal * 100).toFixed(0)}%`
    }

    function checkNewEvent(
        ms: number,
        actor: string,
        ap: number,
        hpStr?: string,
        dist?: number,
        actionCount?: number,
        indent?: number,
    ) {
        if (indent && indent > 0) return
        // 每个招式输出独立标题行（不再按 actionCount 合并）
        const key = `${ms}_${actor}`
        if (key === lastActionKey) return
        if (lastActionKey !== '') lines.push('')
        lastActionKey = key
        const hp = hpStr ? ` ${hpStr}` : ''
        const d = dist !== undefined ? ` ${dist.toFixed(1)}m` : ''
        const num = (actionCount ?? 0) > 0 ? ` #${actionCount}` : ''
        if (ap > 0) {
            lines.push(`── ${t(ms)}${num} ${actor} AP${ap.toFixed(1)}${hp}${d} ──`)
        } else {
            lines.push(`── ${t(ms)}${num} ${actor}${hp}${d} ──`)
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
        /** 累积的判定文本（命中后追加） */
        extra?: string
    } | null = null
    /** 系统事件缓冲区：攻击判定期间的系统消息暂存到这里，与攻击行一同输出 */
    let pendingSystemLines: string[] = []

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
        let line = `  ${pending.text}`
        if (pending.extra) line += pending.extra
        if (pending.ap) line += `  | ${pending.ap}`
        // 先输出攻击行
        lines.push(line)
        // 再输出缓存的系统消息
        if (pendingSystemLines.length > 0) {
            for (const sl of pendingSystemLines) lines.push(sl)
            pendingSystemLines = []
        }
        pending = null
    }

    for (let eventIdx = 0; eventIdx < all.length; eventIdx++) {
        const { timelineMs: ms, event: e } = all[eventIdx]
        const before = lines.length
        switch (e.type) {
            case 'battle_start':
                lines.push(`── ${fmtName(e.actor)} VS ${fmtName(e.opponent)} ──\n`)
                break

            case 'move': {
                flush()
                const oldDist = e.newDistance - e.delta
                const actorName = fmtName(e.actor, e.snapshot)
                checkNewEvent(
                    ms,
                    actorName,
                    e.apRemaining + e.apCost,
                    hpInfo(e.actor, e.snapshot),
                    e.newDistance,
                    e.snapshot.actionCount,
                )
                lines.push(
                    `  # 移动  ${oldDist.toFixed(1)}→${e.newDistance.toFixed(1)}m  | AP${e.apRemaining.toFixed(1)}`,
                )
                break
            }

            case 'attack_start': {
                flush()
                const actorName = fmtName(e.actor, e.snapshot)
                const targetName = fmtName(e.target, e.snapshot)
                const apCost = e.apCost
                const prefix = e.isBonus ? '+' : e.isTriggered ? '↳' : '#'
                const indent = '  '.repeat(e.indent ?? 0)
                pending = {
                    time: ms,
                    actor: actorName,
                    text: `${indent}${prefix} ${e.actionName ?? e.weapon}(${apCost}AP) → ${targetName}`,
                    ap: `AP${e.apRemaining.toFixed(1)}`,
                    startAp: e.apRemaining + apCost,
                    hpInfo: hpInfo(e.actor, e.snapshot),
                    distance: e.snapshot.distance,
                    actionCount: e.snapshot.actionCount,
                    indent: e.indent ?? 0,
                }
                break
            }

            case 'check_hit':
                if (pending) {
                    pending.extra = `  ${roll('命中', e.hitChance, e.roll)}`
                    if (!e.result) {
                        pending.extra += '  » 未命中'
                        // 不 flush，让后续触发事件（弗思等）能缓存到 pendingSystemLines
                        pending.ap = undefined
                    }
                }
                break

            case 'dodge':
                if (pending) {
                    pending.extra = (pending.extra ?? '') + `  » ${fmtName(e.evader)} 闪避`
                    flush()
                }
                break

            case 'parry':
                if (pending && e.parryChance != null && e.roll != null) {
                    pending.extra = (pending.extra ?? '') + `  ${roll('招架', e.parryChance, e.roll)}`
                }
                break

            case 'check_crit':
                if (pending) {
                    pending.extra = (pending.extra ?? '') + `  ${roll('暴击', e.critChance, e.roll)}`
                }
                break

            case 'damage': {
                // 如果 pending 不是本体招式（被触发招式覆盖了），暂存到 pendingSystemLines
                if (!pending || !pending.text.includes(e.actionName)) {
                    let result = ''
                    if (e.isParried && e.blocked > 0) result += `格挡${e.blocked.toFixed(1)}  `
                    result += `造成${e.final.toFixed(1)}`
                    const label = e.actionName !== '未知' ? `[${e.actionName}] ` : ''
                    if (pending) {
                        pendingSystemLines.push(`    ↳ ${label}${result}`)
                    } else {
                        lines.push(`    ↳ ${label}${result}`)
                    }
                    break
                }
                if (
                    (pending!.text + (pending!.extra ?? '')).includes('未命中') ||
                    (pending!.text + (pending!.extra ?? '')).includes('闪避')
                ) {
                    flush()
                    break
                }
                let result = ''
                if (e.isParried && e.blocked > 0) {
                    result += `格挡${e.blocked.toFixed(1)}  `
                }
                result += `造成${e.final.toFixed(1)}`
                pending!.extra = (pending!.extra ?? '') + `  » ${result}`
                flush()
                break
            }

            case 'defeat':
                flush()
                // 从快照找出赢家
                const winnerName = e.snapshot?.characters.find((c) => c.id !== e.loser)?.name ?? e.winner
                lines.push(`\n🏆 ${winnerName} 获胜！`)
                break

            case 'system': {
                if (pending) {
                    // 攻击判定期间：缓存系统消息，等攻击行 flush 时一并输出
                    const indent = '  ' + '  '.repeat(Math.max(0, e.indent ?? 0))
                    const prefix = (e.indent ?? 0) > 0 ? '↳ ' : ''
                    pendingSystemLines.push(`${indent}${prefix}${e.message}`)
                    break
                }
                flush()
                if (e.actor) {
                    checkNewEvent(
                        ms,
                        fmtName(e.actor, e.snapshot),
                        0,
                        undefined,
                        undefined,
                        e.snapshot?.actionCount,
                        e.indent,
                    )
                }
                const indent = '  ' + '  '.repeat(Math.max(0, e.indent ?? 0))
                const prefix = (e.indent ?? 0) > 0 ? '↳ ' : e.message.startsWith('[') ? '· ' : ''
                lines.push(`${indent}${prefix}${e.message}`)
                break
            }
        }
        // 记录该事件处理完后可见的最后一行索引
        if (lines.length > before) {
            eventToLine[eventIdx] = lines.length - 1
        }
    }
    // 填充事件本身没加行的情况（沿用上一事件的结尾）
    for (let i = 0; i < all.length; i++) {
        if (eventToLine[i] === undefined) {
            eventToLine[i] = i > 0 ? eventToLine[i - 1] : -1
        }
    }
    flush()
    // 最后的 flush 可能加了行，更新最后一事件的映射
    eventToLine[all.length - 1] = lines.length - 1
    return { lines, eventToLine }
}
