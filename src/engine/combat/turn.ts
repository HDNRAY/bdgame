import type { Character } from '../entities/character'
import type { TurnEntry, TurnEntryTemplate, SystemEventType } from './types'

/** 行动管理器（时间轴） */
export class TurnManager {
    private time = 0
    private queue: TurnEntry[] = []

    /** 将角色加入时间轴 */
    addCharacter(_char: Character, delay = 0): void {
        this.queue.push({
            type: 'character',
            id: _char.id,
            nextActionAt: this.time + delay,
            scheduledAt: this.time,
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

    /**
     * 推进到下一行动者：移除当前事件条目（按 id）并把时间推进到它的行动时刻。
     * 必须传 id 精确移除——若只按"队首第一个 character/summon"移除，
     * 当前事件执行期间其他角色被提前重排到队首时，会错吃别人的回合导致其永久消失。
     */
    next(id?: string): void {
        const idx = id
            ? this.queue.findIndex((e) => e.id === id)
            : this.queue.findIndex((e) => e.type === 'character' || e.type === 'summon')
        if (idx === -1) return
        const current = this.queue.splice(idx, 1)[0]
        this.time = current.nextActionAt
    }

    /** 移除指定 entry（用于系统事件） */
    removeEntry(id: string): void {
        const idx = this.queue.findIndex((e) => e.id === id)
        if (idx === -1) return
        this.queue.splice(idx, 1)
    }

    /** 行动后重新入队（原子回合：delay 即 AP 回复耗时） */
    scheduleNext(template: TurnEntryTemplate, delay: number): void {
        const entry = this.queue.find((e) => e.id === template.id)
        if (entry) {
            entry.nextActionAt = this.time + delay
            entry.scheduledAt = this.time
        } else {
            this.queue.push({
                ...template,
                nextActionAt: this.time + delay,
                scheduledAt: this.time,
            } satisfies TurnEntry)
        }
        this.sort()
    }

    /**
     * AP 回复率变化 → 重算 pending 下次行动时间（原子回合：纯回复耗时）。
     * 队首或非 character 条目跳过。
     */
    recalcRegenDelay(id: string, regenPerSec: number, ap: number, maxAp: number): void {
        const entry = this.queue.find((e) => e.id === id && e.type === 'character')
        if (!entry || entry === this.queue[0]) return
        const deficit = Math.max(0, maxAp - ap)
        const regenMs = Math.ceil((deficit / Math.max(0.001, regenPerSec)) * 1000)
        entry.nextActionAt = this.time + regenMs
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

    /** 将时间游标同步到当前事件时刻（runEvent 开头调用，保证处理中 currentTime 不陈旧） */
    setTime(t: number): void {
        this.time = t
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
