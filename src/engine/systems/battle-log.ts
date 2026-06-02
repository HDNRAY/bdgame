export type LogEntryType = 'combat' | 'system' | 'status' | 'move'

export interface LogEntry {
    timestamp: number
    type: LogEntryType
    text: string
    color?: string
    indent?: number
}

/** 战斗日志 */
export class BattleLog {
    private entries: LogEntry[] = []

    add(text: string, type: LogEntryType = 'system', color?: string, indent = 0): void {
        this.entries.push({
            timestamp: Date.now(),
            type,
            text,
            color,
            indent,
        })
    }

    getAll(): LogEntry[] {
        return [...this.entries]
    }

    getByType(type: LogEntryType): LogEntry[] {
        return this.entries.filter(e => e.type === type)
    }

    last(n: number): LogEntry[] {
        return this.entries.slice(-n)
    }

    clear(): void {
        this.entries = []
    }

    summarize(): string[] {
        return this.entries.map(e => e.text)
    }
}
