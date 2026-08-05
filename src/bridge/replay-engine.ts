/**
 * ReplayEngine — 战斗回放时间轴调度器
 * 输入 BattleEvent[]，输出逐帧状态 Frame
 *
 * 时间停止演出：命中(damage)处暂停时间轴播放攻击动画（主 0.5s / 触发 0.2s），
 * 纯演出不影响逻辑时间轴；seek 跳过冻结。
 */

import type { BattleEvent, CharacterSnapshot, BattleSnapshot } from '../engine/combat/types'

// ── 帧状态 ──
export interface Frame {
    time: number // 当前时间 ms（逻辑时间，冻结期间不前进）
    total: number // 总时长 ms
    chars: FrameChar[] // 两个角色
    currentAction?: string // 当前动作名（如 "居合斩"）
    currentEvent?: BattleEvent // 当前正在播放的事件
    eventIndex: number // 当前事件索引
    phase: 'idle' | 'fighting' | 'finished'
    /** 冻结演出进度 0~1（非冻结时为 undefined） */
    freezeProgress?: number
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
}

// ── 事件条目 ──
export interface LogEntry {
    id: number
    timelineMs: number
    event: BattleEvent
}

// ── 冻结演出时长（毫秒，1x 速度） ──
export const ATTACK_FREEZE_MS = 500
export const TRIGGER_FREEZE_MS = 200

type MoveEvent = Extract<BattleEvent, { type: 'move' }>
type AttackStartEvent = Extract<BattleEvent, { type: 'attack_start' }>

/** 命中事件（触发冻结演出） */
function isDamageEvent(evt: BattleEvent | undefined): evt is Extract<BattleEvent, { type: 'damage' }> {
    return evt?.type === 'damage'
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
    /** 冻结演出状态（非空 = 正在冻结） */
    private freeze: { startAt: number; duration: number; hitIdx: number; attackIdx: number } | null = null
    /** 已触发冻结的命中事件索引（防止重复触发） */
    private lastFrozenHitIdx = -1
    /** 已冻结过的 attack_start 索引（每个招式只冻结一次） */
    private lastFrozenAttackIdx = -1

    constructor(entries: LogEntry[]) {
        // 稳定排序：系统事件/buff tick 会与角色回合的动作时间戳交错（回合内部事件延伸到下一个调度时间之后），
        // 排序后保证时间轴单调，二分查找才正确；同时间戳保持执行顺序。
        this.events = [...entries].sort((a, b) => a.timelineMs - b.timelineMs)
        this.duration = this.events.length > 0 ? this.events[this.events.length - 1].timelineMs + 3000 : 0
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
            this.buildFrameChar(c, i, snapshot, nextSnapshot, prev, cur, next, t, ratio),
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
        this.freeze = null
        cancelAnimationFrame(this.rafId)
    }

    seek(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration))
        this.lastTick = performance.now()
        // 拖动跳过冻结演出
        this.freeze = null
        this.lastFrozenHitIdx = -1
        this.lastFrozenAttackIdx = -1
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

        // 冻结演出中：逻辑时间轴暂停，只推进冻结进度
        if (this.freeze) {
            const elapsed = now - this.freeze.startAt
            if (elapsed >= this.freeze.duration) {
                this.freeze = null
                this.lastTick = now
            } else {
                this.emitFrame()
                this.rafId = requestAnimationFrame(this.tick)
                return
            }
        }

        const rawDt = (now - this.lastTick) * this.speed
        const dt = Math.min(rawDt, 200) // 限制最大步长防跳跃
        this.lastTick = now
        this.currentTime = Math.min(this.currentTime + dt, this.duration)
        this.emitFrame()

        // 命中检测 → 时间停止（冻结演出）
        const idx = this.findEventIndex(this.currentTime)
        const evt = this.events[idx]?.event
        if (evt && isDamageEvent(evt) && idx > this.lastFrozenHitIdx) {
            const attackIdx = this.findAttackStartIdx(idx)
            if (attackIdx >= 0 && attackIdx !== this.lastFrozenAttackIdx) {
                const attack = this.events[attackIdx].event as AttackStartEvent
                const base = attack.isTriggered ? TRIGGER_FREEZE_MS : ATTACK_FREEZE_MS
                this.lastFrozenHitIdx = idx
                this.lastFrozenAttackIdx = attackIdx
                this.freeze = { startAt: performance.now(), duration: base / this.speed, hitIdx: idx, attackIdx }
                this.emitFrame()
            }
        }

        if (this.currentTime >= this.duration) {
            this.playing = false
            return
        }
        this.rafId = requestAnimationFrame(this.tick)
    }

    private emitFrame(): void {
        if (this.freeze) {
            const progress = Math.min(1, (performance.now() - this.freeze.startAt) / this.freeze.duration)
            this.onFrame?.(this.getFreezeFrame(progress))
        } else {
            this.onFrame?.(this.getFrameAt(this.currentTime))
        }
    }

    /** 冻结演出帧：时间轴停在命中处，播放攻击动画（持 attack_start 命中前快照） */
    private getFreezeFrame(progress: number): Frame {
        const f = this.freeze
        if (!f) return this.getFrameAt(this.currentTime)
        const hit = this.events[f.hitIdx]
        const attack = this.events[f.attackIdx]
        const snapshot = attack?.event.snapshot ?? hit?.event.snapshot
        const t = hit?.timelineMs ?? this.currentTime
        if (!snapshot) return this.getFrameAt(this.currentTime)

        const attackEvt = attack?.event as AttackStartEvent | undefined
        const actorId = attackEvt?.actor

        const chars: FrameChar[] = snapshot.characters.map((c, i) => {
            const fc = this.buildFrameChar(c, i, snapshot, snapshot, undefined, attack, undefined, t, 0)
            fc.pose = actorId && c.id === actorId ? 'attack' : 'idle'
            fc.isActing = actorId === c.id
            return fc
        })

        return {
            time: t,
            total: this.duration,
            chars,
            currentAction: attackEvt?.actionName,
            currentEvent: attackEvt,
            eventIndex: f.hitIdx,
            phase: snapshot.phase,
            freezeProgress: progress,
        }
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

    /** 从命中事件向前找到所属的 attack_start（同动作内事件连续） */
    private findAttackStartIdx(fromIdx: number): number {
        for (let i = fromIdx; i >= 0; i--) {
            if (this.events[i].event.type === 'attack_start') return i
        }
        return -1
    }

    /** 构建单个角色的帧状态 */
    private buildFrameChar(
        c: CharacterSnapshot,
        i: number,
        snapshot: BattleSnapshot | undefined,
        nextSnapshot: BattleSnapshot | undefined,
        prev: LogEntry | undefined,
        cur: LogEntry | undefined,
        next: LogEntry | undefined,
        t: number,
        ratio: number,
    ): FrameChar {
        const nextChar = nextSnapshot?.characters[i]
        const prevChar = prev?.event.snapshot?.characters[i]
        const hpLerp = nextChar ? this.lerp(c.hp, nextChar.hp, ratio) : c.hp
        const apLerp = nextChar ? this.lerp(c.ap, nextChar.ap, ratio) : c.ap
        const eased = this.ease(ratio)
        const pos = this.resolvePos(c, prevChar, nextChar, cur, next, t, eased)

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

        // 姿势：移动窗口内为 move，其余用事件姿势
        let pose: FrameChar['pose']
        if (cur?.event.type === 'move' && cur.event.actor === c.id && !cur.event.blink) {
            const mv = cur.event
            const dur = mv.durationMs ?? Math.max(1, (next?.timelineMs ?? cur.timelineMs + 1000) - cur.timelineMs)
            pose = t < cur.timelineMs + dur ? 'move' : 'idle'
        } else {
            pose = this.resolvePose(c.id, cur?.event, next?.event, ratio)
        }

        return {
            id: c.id,
            name: c.name,
            pos,
            hp: Math.round(hpLerp),
            maxHp: c.maxHp,
            ap: apLerp,
            maxAp: c.maxAp,
            waitProgress,
            isActing,
            weaponId: c.weapon,
            spriteId: c.spriteId,
            pose,
        }
    }

    /** 位置插值：move 前保持 → [moveTime, moveTime+durationMs] 平滑 → 后保持；blink 瞬移直接跳 */
    private resolvePos(
        c: CharacterSnapshot,
        prevChar: CharacterSnapshot | undefined,
        nextChar: CharacterSnapshot | undefined,
        cur: LogEntry | undefined,
        next: LogEntry | undefined,
        t: number,
        eased: number,
    ): number {
        const curEvt = cur?.event
        const nextEvt = next?.event

        // 当前事件是移动
        if (curEvt?.type === 'move' && curEvt.actor === c.id) {
            const mv = curEvt as MoveEvent
            if (mv.blink) return c.pos // 瞬移：直接跳到目标位置
            const dur = mv.durationMs ?? Math.max(1, (next?.timelineMs ?? cur!.timelineMs + 1000) - cur!.timelineMs)
            const k = Math.min(1, Math.max(0, (t - cur!.timelineMs) / dur))
            const from = prevChar?.pos ?? c.pos
            return this.lerp(from, c.pos, this.ease(k))
        }
        // 下一事件是移动：移动还没开始，保持原位置（不提前滑动）
        if (nextEvt?.type === 'move' && nextEvt.actor === c.id) {
            return c.pos
        }
        // 默认：cur → next 平滑插值
        const nextPos = nextChar ? nextChar.pos : c.pos
        return this.lerp(c.pos, nextPos, eased)
    }

    /** 判断角色的姿势 —— 命中/闪避/招架瞬间闪现，前后摇保持 idle（攻击姿势由冻结演出播放） */
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
                // 前摇窗口：蓄力/待机，攻击姿势由命中冻结演出播放
                return 'idle'

            case 'damage':
                if (isTarget && ratio < 0.25) return 'hit'
                return 'idle'

            case 'dodge':
                if ('evader' in cur && cur.evader === charId && ratio < 0.25) return 'hit'
                if (isActor && ratio < 0.15) return 'attack'
                return 'idle'

            case 'parry':
                if ('parrier' in cur && cur.parrier === charId && ratio < 0.25) return 'hit'
                if (isActor && ratio < 0.15) return 'attack'
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
