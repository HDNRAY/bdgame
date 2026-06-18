/**
 * ReplayEngine — 战斗回放时间轴调度器
 * 输入 BattleEvent[]，输出逐帧状态 Frame
 */

import type { BattleEvent, CharacterSnapshot, BattleSnapshot } from '../engine/combat/types'

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
    waitProgress: number // 0~1，等待下次行动进度
    isActing: boolean // 当前正在主动行动
    isTriggeredAction: boolean // 当前正在触发行动
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

        const chars: FrameChar[] = snapshot.characters.map((c, i) =>
            this.buildFrameChar(c, i, snapshot, nextSnapshot, cur, next, t, ratio),
        )

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
        const rawDt = (now - this.lastTick) * this.speed
        const dt = Math.min(rawDt, 200) // 限制最大步长防跳跃
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

    /** 构建单个角色的帧状态 */
    private buildFrameChar(
        c: CharacterSnapshot,
        i: number,
        snapshot: BattleSnapshot | undefined,
        nextSnapshot: BattleSnapshot | undefined,
        cur: LogEntry | undefined,
        next: LogEntry | undefined,
        t: number,
        ratio: number,
    ): FrameChar {
        const nextChar = nextSnapshot?.characters[i]
        const hpLerp = nextChar ? this.lerp(c.hp, nextChar.hp, ratio) : c.hp
        const apLerp = nextChar ? this.lerp(c.ap, nextChar.ap, ratio) : c.ap
        const eased = this.ease(ratio)
        const posLerp = nextChar ? this.lerp(c.pos, nextChar.pos, eased) : c.pos

        // 直接用最新快照的队列数据 + 当前播放时间 t 计算等待进度
        const curEntry = snapshot?.turn.queue.find((q) => q.type === 'character' && q.id === c.id)
        const nextEntry = nextSnapshot?.turn.queue.find((q) => q.type === 'character' && q.id === c.id)
        const bestEntry = nextEntry ?? curEntry
        let waitProgress: number
        if (bestEntry) {
            const span = bestEntry.nextActionAt - bestEntry.scheduledAt
            waitProgress = span > 0 ? Math.min(1, Math.max(0, (t - bestEntry.scheduledAt) / span)) : 1
        } else {
            waitProgress = c.ap / Math.max(1, c.maxAp)
        }

        // 判断当前帧的行动状态
        const nearEvent = cur && t - cur.timelineMs < 200
        const evt = cur?.event
        const isTriggered = evt?.type === 'attack_start' && !!evt.isTriggered
        const actorId = evt && 'actor' in evt ? (evt as Extract<BattleEvent, { actor: string }>).actor : undefined
        const isActing = !!(nearEvent && !isTriggered && !!actorId && actorId === c.id)
        const isTriggeredAction = !!(nearEvent && isTriggered && actorId === c.id)

        return {
            id: c.id,
            name: c.name,
            pos: posLerp,
            hp: Math.round(hpLerp),
            maxHp: c.maxHp,
            ap: apLerp,
            maxAp: c.maxAp,
            waitProgress,
            isActing,
            isTriggeredAction,
            weaponId: c.weapon,
            spriteId: c.spriteId,
            pose: this.resolvePose(c.id, cur?.event, next?.event, ratio),
        }
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
