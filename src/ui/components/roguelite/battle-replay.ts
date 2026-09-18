// 把引擎产生的战斗回放原始日志组装成 BattlePanel 可播的 BattleData（复用大会模拟同款组装逻辑）
import { BattleLog } from '../../../engine/combat/battle-log'
import { formatBattleLog } from '../../../engine/format-log'
import type { LogEntry } from '../../../bridge/replay-engine'
import type { BattleData } from '../BattlePanel/BattlePanel'
import type { BattleStatsSnapshot } from '../../../engine/combat/battle-stats'

export interface RawReplay {
    entries: { event: unknown; timelineMs: number }[]
    /** 本场统计（肉鸽引擎结算时带出来的；缺省则回放底部不显示「统计」页签） */
    stats?: BattleStatsSnapshot
}

export function buildBattleDataFromEntries(
    replay: RawReplay,
    a: { id: string; name: string },
    b: { id: string; name: string },
): BattleData {
    const entries = replay.entries as LogEntry[]
    const log = new BattleLog()
    for (const e of entries) log.push(e.event, e.timelineMs)
    const snapshots = entries.map((e) => e.event.snapshot)
    const { lines, eventToLine } = formatBattleLog(log)
    return {
        entries,
        logLines: lines,
        eventToLine,
        snapshots,
        // id 必须传引擎里的角色 id（渲染器按 id 取精灵与武器图层），name 只用于显示
        charAInfo: { id: a.id, name: a.name, color: '#4ecdc4' },
        charBInfo: { id: b.id, name: b.name, color: '#ff6b6b' },
        stats: replay.stats,
    }
}
