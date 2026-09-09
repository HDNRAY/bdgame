// 把引擎产生的战斗回放原始日志组装成 BattlePanel 可播的 BattleData（复用大会模拟同款组装逻辑）
import { BattleLog } from '../../../engine/combat/battle-log'
import { formatBattleLog } from '../../../engine/format-log'
import type { LogEntry } from '../../../bridge/replay-engine'
import type { BattleData } from '../BattlePanel/BattlePanel'

export interface RawReplay {
    entries: { event: unknown; timelineMs: number }[]
}

export function buildBattleDataFromEntries(
    replay: RawReplay,
    aName: string,
    bName: string,
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
        charAInfo: { id: aName, name: aName, color: '#4ecdc4' },
        charBInfo: { id: bName, name: bName, color: '#ff6b6b' },
    }
}
