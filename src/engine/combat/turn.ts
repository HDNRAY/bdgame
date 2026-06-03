import type { Character } from '../entities/character'
import type { TurnEntry, SystemEventType } from './types'

export const SYS_PREFIX = '__sys__'

/** 行动管理器（时间轴） */
export class TurnManager {
    private time = 0
    private queue: TurnEntry[] = []

    /** 将角色加入时间轴 */
    addCharacter(char: Character, delay = 0): void {
        this.queue.push({
            characterId: char.id,
            nextActionAt: this.time + delay,
        })
        this.sort()
    }

    /** 调度一个系统事件 */
    scheduleSystemEvent(id: string, delayMs: number, type: SystemEventType): void {
        this.queue.push({
            characterId: `${SYS_PREFIX}${id}`,
            nextActionAt: this.time + delayMs,
            systemEventType: type,
        })
        this.sort()
    }

    /** 在指定绝对时间调度系统事件 */
    scheduleSystemEventAt(id: string, targetTime: number, type: SystemEventType): void {
        this.queue.push({
            characterId: `${SYS_PREFIX}${id}`,
            nextActionAt: targetTime,
            systemEventType: type,
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
    scheduleNext(charId: string, delay: number): void {
        const entry = this.queue.find((e) => e.characterId === charId)
        if (entry) {
            // 已经在队列中 -> 更新
            entry.nextActionAt = this.time + delay
        } else {
            this.queue.push({
                characterId: charId,
                nextActionAt: this.time + delay,
            })
        }
        this.sort()
    }

    /** 修改角色的时间轴（stun=+ms, haste=-ms） */
    modifyTime(charId: string, deltaMs: number): void {
        for (const entry of this.queue) {
            if (entry.characterId === charId) {
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
