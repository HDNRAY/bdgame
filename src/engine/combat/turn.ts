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
        })
        this.sort()
    }

    /** 调度一个系统事件 */
    scheduleSystemEvent(id: string, delayMs: number, type: SystemEventType): void {
        this.queue.push({
            type: 'system',
            id,
            nextActionAt: this.time + delayMs,
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
        })
        this.sort()
    }

    /** 获取当前行动者 */
    peek(): TurnEntry | undefined {
        return this.queue[0]
    }

    /** 推进到下一行动者 */
    next(): void {
        const current = this.queue.shift()
        if (!current) return
        this.time = current.nextActionAt
    }

    /** 行动后重新入队（插入硬直） */
    scheduleNext(template: TurnEntryTemplate, delay: number): void {
        const entry = this.queue.find((e) => e.id === template.id)
        if (entry) {
            entry.nextActionAt = this.time + delay
            if (template.type === 'character' && entry.type === 'character') {
                if (template.preDelay !== undefined) entry.preDelay = template.preDelay
                if (template.stunTime !== undefined) entry.stunTime = template.stunTime
            }
        } else {
            this.queue.push({ ...template, nextActionAt: this.time + delay } satisfies TurnEntry)
        }
        this.sort()
    }

    /** 身法变化时重新计算回合间隔 */
    recalcInterval(id: string, agility: number): void {
        const entry = this.queue.find((e) => e.id === id)
        if (!entry || entry.type !== 'character' || entry.preDelay === undefined) return
        const delay = calcTurnInterval(agility, entry.preDelay, entry.stunTime ?? 0)
        entry.nextActionAt = this.time + delay
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
