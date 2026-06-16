/**
 * ReplayEngine — 战斗回放时间轴调度器
 * 输入 BattleEvent[]，输出逐帧状态 Frame
 */

import type { BattleEvent } from '../engine/combat/types'

// ── 帧状态 ──
export interface Frame {
    time: number // 当前时间 ms
    total: number // 总时长 ms
    chars: FrameChar[] // 两个角色
    currentAction?: string // 当前动作名（如 "居合斩"）
    currentEvent?: BattleEvent // 当前正在播放的事件
    eventIndex: number // 当前事件索引
    phase: 'idle' | 'fighting' | 'finished'
}

export interface FrameChar {
    id: string
    name: string
    pos: number // 横轴位置
    hp: number
    maxHp: number
    ap: number
    maxAp: number
    weaponId: string
    spriteId: string
    pose: 'idle' | 'attack' | 'hit' | 'move'
}

// ── 事件条目 ──
export interface LogEntry {
    id: number
    timelineMs: number
    event: BattleEvent
}

// ── ReplayEngine ──
export class ReplayEngine {
    private events: LogEntry[]
    private duration = 0
    private playing = false
    private speed = 1
    private currentTime = 0
    private onFrame?: (frame: Frame) => void
    private rafId = 0
    private lastTick = 0

    constructor(entries: LogEntry[]) {
        this.events = entries
        this.duration = entries.length > 0 ? entries[entries.length - 1].timelineMs + 3000 : 0
    }

    /** 总时长 ms */
    get totalDuration(): number {
        return this.duration
    }

    /** 获取某一时刻的帧状态 */
    getFrameAt(time: number): Frame {
        const t = Math.max(0, Math.min(time, this.duration))
        const idx = this.findEventIndex(t)

        // 当前事件及其前后的快照
        const cur = this.events[idx]
        const prev = idx > 0 ? this.events[idx - 1] : undefined
        const next = idx < this.events.length - 1 ? this.events[idx + 1] : undefined

        const snapshot = cur?.event.snapshot ?? prev?.event.snapshot
        const nextSnapshot = next?.event.snapshot ?? snapshot

        if (!snapshot) {
            return this.emptyFrame(t)
        }

        // 在两个事件之间插值
        const ratio = next && cur ? (t - cur.timelineMs) / Math.max(1, next.timelineMs - cur.timelineMs) : 0

        const chars: FrameChar[] = snapshot.characters.map((c, i) => {
            const nextChar = nextSnapshot?.characters[i]
            const hpLerp = nextChar ? this.lerp(c.hp, nextChar.hp, ratio) : c.hp
            const apLerp = nextChar ? this.lerp(c.ap, nextChar.ap, ratio) : c.ap
            // 位置用 ease-in-out 缓动，移动更自然
            const eased = this.ease(ratio)
            const posLerp = nextChar ? this.lerp(c.pos, nextChar.pos, eased) : c.pos
            return {
                id: c.id,
                name: c.name,
                pos: posLerp,
                hp: Math.round(hpLerp),
                maxHp: c.maxHp,
                ap: apLerp,
                maxAp: c.maxAp,
                weaponId: c.weapon,
                spriteId: c.spriteId,
                pose: this.resolvePose(c.id, cur?.event, next?.event, ratio),
            }
        })

        const phase = snapshot.phase

        // 当前显示的动作名
        let currentAction: string | undefined
        if (cur?.event.type === 'attack_start') {
            currentAction = cur.event.actionName
        } else if (cur?.event.type === 'damage') {
            currentAction = cur.event.actionName
        }

        return {
            time: t,
            total: this.duration,
            chars,
            currentAction,
            currentEvent: cur?.event,
            eventIndex: idx,
            phase,
        }
    }

    // ── 播放控制 ──

    play(speed = 1): void {
        if (this.playing) return
        this.speed = speed
        this.playing = true
        this.lastTick = performance.now()
        this.tick()
    }

    pause(): void {
        this.playing = false
        cancelAnimationFrame(this.rafId)
    }

    seek(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration))
        this.emitFrame()
    }

    setSpeed(speed: number): void {
        this.speed = speed
    }

    get isPlaying(): boolean {
        return this.playing
    }

    get time(): number {
        return this.currentTime
    }

    onFrameCallback(cb: (frame: Frame) => void): void {
        this.onFrame = cb
    }

    destroy(): void {
        this.pause()
        this.onFrame = undefined
    }

    // ── 内部 ──

    private tick = (): void => {
        if (!this.playing) return
        const now = performance.now()
        // 限制每帧最大时间步长，防止帧延迟/高倍速时位置跳跃
        const rawDt = (now - this.lastTick) * this.speed
        const dt = Math.min(rawDt, 100) // 不超过 100ms
        this.lastTick = now
        this.currentTime = Math.min(this.currentTime + dt, this.duration)
        this.emitFrame()
        if (this.currentTime >= this.duration) {
            this.playing = false
            return
        }
        this.rafId = requestAnimationFrame(this.tick)
    }

    private emitFrame(): void {
        this.onFrame?.(this.getFrameAt(this.currentTime))
    }

    /** 二分查找当前事件索引 */
    private findEventIndex(time: number): number {
        let lo = 0
        let hi = this.events.length - 1
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1
            if (this.events[mid].timelineMs <= time) lo = mid
            else hi = mid - 1
        }
        return lo
    }

    /** 判断角色的姿势 —— 只在事件瞬间闪现，前后摇保持 idle */
    private resolvePose(
        charId: string,
        cur?: BattleEvent,
        _next?: BattleEvent,
        ratio: number = 1,
    ): 'idle' | 'attack' | 'hit' | 'move' {
        if (!cur) return 'idle'

        const isActor = 'actor' in cur && cur.actor === charId
        const isTarget = 'target' in cur && cur.target === charId

        switch (cur.type) {
            case 'attack_start':
                if (isActor && ratio < 0.15) return 'attack'
                return 'idle'

            case 'damage':
                if (isTarget && ratio < 0.25) return 'hit'
                if (isActor && ratio < 0.15) return 'attack'
                return 'idle'

            case 'dodge':
                if ('evader' in cur && cur.evader === charId && ratio < 0.25) return 'hit'
                return 'idle'

            case 'parry':
                if ('parrier' in cur && cur.parrier === charId && ratio < 0.25) return 'hit'
                return 'idle'

            case 'move':
                if (isActor && ratio < 0.15) return 'move'
                return 'idle'

            default:
                return 'idle'
        }
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t
    }

    /** smoothstep 缓动 — 起停缓慢，中间加速 */
    private ease(t: number): number {
        return t * t * (3 - 2 * t)
    }

    private emptyFrame(time: number): Frame {
        return {
            time,
            total: this.duration,
            chars: [],
            eventIndex: 0,
            phase: 'idle',
        }
    }
}
