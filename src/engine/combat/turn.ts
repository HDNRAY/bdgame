import type { Character } from '../entities/character'
import type { TurnEntry, TurnEntryTemplate, SystemEventType } from './types'
import { calcTurnInterval } from '../calc/damage'

/** 行动管理器（时间轴） */
export class TurnManager {
    private time = 0
    private queue: TurnEntry[] = []

    /** 将角色加入时间轴 */
    addCharacter(char: Character, delay = 0): void {
        this.queue.push({
            type: 'character',
            id: char.id,
            nextActionAt: this.time + delay,
            scheduledAt: this.time,
            lastAgility: char.attrs.get('agility'),
        })
        this.sort()
    }

    /** 调度一个系统事件 */
    scheduleSystemEvent(id: string, delayMs: number, type: SystemEventType): void {
        this.queue.push({
            type: 'system',
            id,
            nextActionAt: this.time + delayMs,
            scheduledAt: this.time,
            systemEventType: type,
        })
        this.sort()
    }

    /** 在指定绝对时间调度系统事件 */
    scheduleSystemEventAt(id: string, targetTime: number, type: SystemEventType): void {
        this.queue.push({
            type: 'system',
            id,
            nextActionAt: targetTime,
            scheduledAt: this.time,
            systemEventType: type,
        })
        this.sort()
    }

    /** 添加召唤物到时间轴 */
    addSummon(id: string, ownerId: string, delay = 0): void {
        this.queue.push({
            type: 'summon',
            id,
            ownerId,
            nextActionAt: this.time + delay,
            scheduledAt: this.time,
        })
        this.sort()
    }

    /** 获取当前行动者 */
    peek(): TurnEntry | undefined {
        return this.queue[0]
    }

    /** 推进到下一行动者 */
    next(): void {
        const idx = this.queue.findIndex((e) => e.type === 'character' || e.type === 'summon')
        if (idx === -1) return
        const current = this.queue.splice(idx, 1)[0]
        this.time = current.nextActionAt
    }

    /** 移除指定 entry（用于系统事件，避免 recalcInterval 打乱顺序后误删角色） */
    removeEntry(id: string): void {
        const idx = this.queue.findIndex((e) => e.id === id)
        if (idx === -1) return
        this.queue.splice(idx, 1)
    }

    /** 行动后重新入队（插入硬直） */
    scheduleNext(template: TurnEntryTemplate, delay: number): void {
        const entry = this.queue.find((e) => e.id === template.id)
        if (entry) {
            entry.nextActionAt = this.time + delay
            entry.scheduledAt = this.time
            if (template.type === 'character' && entry.type === 'character') {
                if (template.preDelay !== undefined) entry.preDelay = template.preDelay
                if (template.stunTime !== undefined) entry.stunTime = template.stunTime
                if (template.haste !== undefined) entry.haste = template.haste
            }
        } else {
            this.queue.push({
                ...template,
                nextActionAt: this.time + delay,
                scheduledAt: this.time,
            } satisfies TurnEntry)
        }
        this.sort()
    }

    /** 身法变化时按身法变化比例缩放剩余延迟 */
    recalcInterval(id: string, agility: number, haste?: number): void {
        const entry = this.queue.find((e) => e.id === id)
        if (!entry || entry.type !== 'character' || entry.preDelay === undefined) return
        if (entry === this.queue[0]) return

        const currentHaste = haste ?? entry.haste ?? 0
        const oldDelay = entry.nextActionAt - entry.scheduledAt
        const oldAgi = entry.lastAgility ?? agility
        const oldTi = calcTurnInterval(oldAgi, entry.preDelay, entry.stunTime ?? 0) - currentHaste
        const newTi = calcTurnInterval(agility, entry.preDelay, entry.stunTime ?? 0) - currentHaste
        // 按比例缩放，保留 AP 回复耗时部分
        const scaledDelay = Math.max(100, Math.round(oldDelay * (newTi / oldTi)))
        entry.nextActionAt = entry.scheduledAt + scaledDelay
        entry.lastAgility = agility
        entry.haste = currentHaste
        this.sort()
    }

    /** 修改角色的时间轴（stun=+ms, haste=-ms） */
    modifyTime(id: string, deltaMs: number): void {
        for (const entry of this.queue) {
            if (entry.id === id) {
                entry.nextActionAt = Math.max(this.time, entry.nextActionAt + deltaMs)
            }
        }
        this.sort()
    }

    /** 移除队列中指定 ID 的所有事件（用于重置 poison tick 等） */
    removeEvents(id: string): void {
        this.queue = this.queue.filter((e) => e.id !== id)
    }

    get currentTime(): number {
        return this.time
    }

    get entries(): ReadonlyArray<TurnEntry> {
        return this.queue
    }

    private sort(): void {
        this.queue.sort((a, b) => a.nextActionAt - b.nextActionAt)
    }

    reset(): void {
        this.time = 0
        this.queue = []
    }
}
