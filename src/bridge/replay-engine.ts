/**
 * ReplayEngine — 战斗回放调度器（Phase 6 回合驱动）
 * 输入 BattleEvent[]，输出逐帧状态 Frame
 *
 * 播放模型：
 * - 时间轴连续推进（等待期照播）；到达某回合（含招式/移动）边界 → 冻结逻辑时间，
 *   段内依次播放招式/移动/判定（每事件有播放时长），段末 TURN_END_HOLD_MS 停留，
 *   然后解除冻结继续推进（不跳段）。
 * - 手动 pause 停 RAF（连动画也停）；resume 从当前事件续播。
 * - progress = 逻辑时间 + 已累积的回合内演出时间；总时长 = 逻辑总时长 + Σ各回合演出时长。
 *
 * 实现：以「显示时间 displayMs」为唯一单调推进变量；通过时间轴单元数组
 * （advance=逻辑推进 / freeze=回合冻结演出）反推当前帧，天然支持 seek。
 */

import type { BattleEvent, CharacterSnapshot, BattleSnapshot } from '../engine/combat/types'

// ── 帧状态 ──
export interface Frame {
    time: number // 当前显示时间 ms（progress 基准）
    total: number // 总显示时长 ms
    chars: FrameChar[] // 两个角色
    currentAction?: string // 当前动作名（如 "居合斩"）
    currentEvent?: BattleEvent // 当前正在播放的事件
    eventIndex: number // 当前事件索引（全局）
    phase: 'idle' | 'fighting' | 'finished'
    /** 当前回合号（scope[0]） */
    turn?: number
    /** 冻结段演出进度 0~1（非冻结时为 undefined） */
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
    event: BattleEvent & { scope: number[] }
}

// ── 播放时长常量（毫秒，1x 速度） ──
/** 主招式每 1 AP 的播放时长 */
export const AP_PLAY_MS = 500
/** 触发招式固定播放时长 */
export const TRIGGER_PLAY_MS = 500
/** support（pre/post）最少播放时长 */
export const SUPPORT_MIN_MS = 500
/** 其他判定/buff 事件步长 */
export const SEGMENT_STEP_MS = 120
/** 回合结束停留 */
export const TURN_END_HOLD_MS = 200
/** 结尾缓冲 */
export const TAIL_MS = 3000

type MoveEvent = Extract<BattleEvent, { type: 'move' }>

/** 回合段：按 scope[0] 分组的一个行动回合（含其反应链） */
interface Segment {
    turn: number
    /** 段内事件（保持 id 序） */
    events: LogEntry[]
    /** 段首事件逻辑时间 */
    startMs: number
    /** 段内总演出时长 = Σ事件时长 + TURN_END_HOLD_MS */
    playDuration: number
    /** 段内每事件播放时长 */
    eventDurs: number[]
    /** 段内行动者（第一个 attack_start/move 的 actor；无行动段 undefined） */
    actor?: string
    /** 行动方该回合结束后剩余内息（段末快照 AP；蜡烛回复基准用） */
    apEnd?: number
}

/** 时间轴单元：advance=逻辑推进（等待期），freeze=回合冻结演出 */
interface PlayUnit {
    kind: 'advance' | 'freeze'
    displayStart: number
    displayDur: number
    /** advance 用：逻辑时间从 logicalStart 走到 logicalEnd */
    logicalStart?: number
    logicalEnd?: number
    /** freeze 用：指向 segments 索引 */
    segIndex?: number
}

/** 单事件播放时长（用户规则：主招 AP×500 / 触发 500 / support max(500,AP×500) / move durationMs / 其他 120） */
function eventPlayMs(evt: BattleEvent): number {
    switch (evt.type) {
        case 'attack_start':
            return evt.isTriggered ? TRIGGER_PLAY_MS : Math.max(SEGMENT_STEP_MS, evt.apCost * AP_PLAY_MS)
        case 'move':
            return evt.durationMs ?? SEGMENT_STEP_MS
        case 'system':
            // support（pre/post）招式：Phase B 引擎补 apCost；此处按 apCost 判断
            return 'apCost' in evt && typeof (evt as { apCost?: number }).apCost === 'number'
                ? Math.max(SUPPORT_MIN_MS, ((evt as { apCost: number }).apCost ?? 0) * AP_PLAY_MS)
                : SEGMENT_STEP_MS
        default:
            return SEGMENT_STEP_MS
    }
}

// ── ReplayEngine ──
export class ReplayEngine {
    private events: LogEntry[]
    /** 回合段（按 scope[0] 分组） */
    private segments: Segment[] = []
    /** 时间轴单元：advance（逻辑推进）/ freeze（回合冻结演出）交错 */
    private units: PlayUnit[] = []
    /** 每角色内息回复基准（trough）：{回合显示起点, 该回合结束后剩余内息}，升序；蜡烛 = 相对上一回合消耗的回复进度 */
    private charTroughs: Map<string, { start: number; value: number }[]> = new Map()
    /** 首回合前：battle_start 冻结段显示结束 ms */
    private battleStartEnd = 0
    /** 各角色开场内息（首回合前 trough 基准） */
    private baseApByChar: Map<string, number> = new Map()
    /** 总显示时长 ms = Σadvance 逻辑跨度 + Σfreeze 演出时长 + TAIL_MS */
    private totalDisplay = 0
    /** 纯逻辑总时长（最后一个事件 + TAIL_MS，供 advance 段 clamp） */
    private logicalTotal = 0
    private playing = false
    private speed = 1
    /** 显示时间（单调推进，progress 基准） */
    private displayMs = 0
    private onFrame?: (frame: Frame) => void
    private rafId = 0
    private lastTick = 0

    constructor(entries: LogEntry[]) {
        // 稳定排序：系统事件/buff tick 会与角色回合的动作时间戳交错（回合内部事件延伸到下一个调度时间之后），
        // 排序后保证时间轴单调，二分查找才正确；同时间戳保持执行顺序。
        this.events = [...entries].sort((a, b) => a.timelineMs - b.timelineMs)
        this.logicalTotal = this.events.length > 0 ? this.events[this.events.length - 1].timelineMs + TAIL_MS : 0
        this.buildSegments()
        this.buildUnits()
    }

    /** 按 scope[0] 分组为回合段（段内保持 id 序），并计算每事件播放时长 */
    private buildSegments(): void {
        this.segments = []
        let cur: Segment | null = null
        for (let i = 0; i < this.events.length; i++) {
            const e = this.events[i]
            const turn = e.event.scope?.[0] ?? 0
            if (!cur || cur.turn !== turn) {
                cur = { turn, events: [], startMs: e.timelineMs, playDuration: 0, eventDurs: [] }
                this.segments.push(cur)
            }
            cur.events.push(e)
            const d = eventPlayMs(e.event)
            cur.eventDurs.push(d)
            cur.playDuration += d
        }
        // 每段末尾 + 回合结束停留
        for (const seg of this.segments) {
            seg.playDuration += TURN_END_HOLD_MS
        }
        // 预计算段内行动者（第一个 attack_start/move 的 actor）
        for (const seg of this.segments) {
            for (const e of seg.events) {
                const evt = e.event
                if (evt.type === 'attack_start') {
                    seg.actor = evt.actor
                    break
                }
                if (evt.type === 'move') {
                    seg.actor = evt.actor
                    break
                }
            }
        }
        // 预计算行动方回合结束后剩余内息（apEnd）：段末快照里行动方的 AP（蜡烛回复基准）
        for (const seg of this.segments) {
            if (!seg.actor) continue
            const lastEvt = seg.events[seg.events.length - 1]
            const actorSnap = lastEvt?.event.snapshot?.characters.find((x) => x.id === seg.actor)
            if (actorSnap) seg.apEnd = actorSnap.ap
        }
    }

    /** 构建时间轴单元：advance（逻辑等待期）与 freeze（回合演出）交错 */
    private buildUnits(): void {
        this.units = []
        let display = 0
        let prevLogical = 0
        for (const seg of this.segments) {
            // 等待期：上一段末 → 本段首 的逻辑跨度（1:1 显示）
            if (seg.startMs > prevLogical) {
                this.units.push({
                    kind: 'advance',
                    displayStart: display,
                    displayDur: seg.startMs - prevLogical,
                    logicalStart: prevLogical,
                    logicalEnd: seg.startMs,
                })
                display += seg.startMs - prevLogical
            }
            // 本段 = freeze（演出时长）
            this.units.push({
                kind: 'freeze',
                displayStart: display,
                displayDur: seg.playDuration,
                segIndex: this.segments.indexOf(seg),
            })
            // 记录行动方回复基准（trough）：该回合结束后剩余内息 → 等待期蜡烛烧尽基准
            if (seg.actor && seg.apEnd != null) {
                const list = this.charTroughs.get(seg.actor) ?? []
                list.push({ start: display, value: seg.apEnd })
                this.charTroughs.set(seg.actor, list)
            }

            display += seg.playDuration
            prevLogical = seg.events[seg.events.length - 1].timelineMs
        }
        // 结尾尾巴
        this.units.push({
            kind: 'advance',
            displayStart: display,
            displayDur: Math.max(0, this.logicalTotal - prevLogical),
            logicalStart: prevLogical,
            logicalEnd: Math.max(prevLogical, this.logicalTotal),
        })
        display += Math.max(0, this.logicalTotal - prevLogical)
        this.totalDisplay = display
        // 首回合前模型：battle_start 冻结结束 / 各角色开场内息
        this.battleStartEnd = this.units[0]?.kind === 'freeze' ? this.units[0].displayDur : 0
        const bsSnap = this.events[this.findEventIndex(0)]?.event.snapshot
        if (bsSnap) {
            for (const c of bsSnap.characters) this.baseApByChar.set(c.id, c.ap)
        }
    }

    /** 总显示时长 ms */
    get totalDuration(): number {
        return this.totalDisplay
    }

    /** 按显示时间取帧（唯一入口：seek/播放都用 displayMs） */
    getFrameAt(displayMs: number): Frame {
        const d = Math.max(0, Math.min(displayMs, this.totalDisplay))
        const unit = this.findUnit(d)
        if (!unit) return this.emptyFrame(d)

        if (unit.kind === 'advance') {
            const logical = Math.max(0, (unit.logicalStart ?? 0) + (d - unit.displayStart))
            return this.getLogicalFrame(logical, d, unit)
        }
        const seg = this.segments[unit.segIndex!]
        const elapsed = d - unit.displayStart
        return this.getSegmentFrame(seg, elapsed, d)
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
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.rafId)
    }

    /** seek 到指定显示时间（displayMs） */
    seek(displayMs: number): void {
        this.displayMs = Math.max(0, Math.min(displayMs, this.totalDisplay))
        this.lastTick = performance.now()
        this.emitFrame()
    }

    setSpeed(speed: number): void {
        this.speed = speed
    }

    get isPlaying(): boolean {
        return this.playing
    }

    get time(): number {
        return this.displayMs
    }

    /** 当前回合号（所在 freeze 段的 turn；advance 段取最近一段） */
    getCurrentTurn(): number {
        const unit = this.findUnit(this.displayMs)
        if (!unit) return 0
        if (unit.kind === 'freeze') return this.segments[unit.segIndex!].turn
        // advance：找该逻辑时间之前最近的 freeze 段
        for (let i = unit.segIndex ?? this.segments.length - 1; i >= 0; i--) {
            // advance 单元不记录 segIndex，回退遍历逻辑：用二分找最近段
        }
        const logical = (unit.logicalStart ?? 0) + (this.displayMs - unit.displayStart)
        let lo = 0
        let hi = this.segments.length - 1
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1
            if (this.segments[mid].startMs <= logical) lo = mid
            else hi = mid - 1
        }
        return this.segments[lo]?.turn ?? 0
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
        this.displayMs = Math.min(this.displayMs + dt, this.totalDisplay)
        this.emitFrame()

        if (this.displayMs >= this.totalDisplay) {
            this.playing = false
            return
        }
        if (typeof requestAnimationFrame === 'function') {
            this.rafId = requestAnimationFrame(this.tick)
        } else {
            // 非浏览器环境（node 脚本验证）：直接同步推进一轮后停
            this.playing = false
        }
    }

    private emitFrame(): void {
        this.onFrame?.(this.getFrameAt(this.displayMs))
    }

    /** 二分查找 displayMs 所在单元 */
    private findUnit(displayMs: number): PlayUnit | undefined {
        if (this.units.length === 0) return undefined
        let lo = 0
        let hi = this.units.length - 1
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1
            if (this.units[mid].displayStart <= displayMs) lo = mid
            else hi = mid - 1
        }
        return this.units[lo]
    }

    /** 逻辑推进帧（advance 单元）：按逻辑时间插值 */
    private getLogicalFrame(logicalTime: number, displayMs: number, unit?: PlayUnit): Frame {
        const t = Math.max(0, Math.min(logicalTime, this.logicalTotal))
        const idx = this.findEventIndex(t)

        const cur = this.events[idx]
        const prev = idx > 0 ? this.events[idx - 1] : undefined
        const next = idx < this.events.length - 1 ? this.events[idx + 1] : undefined

        const snapshot = cur?.event.snapshot ?? prev?.event.snapshot
        const nextSnapshot = next?.event.snapshot ?? snapshot

        if (!snapshot) {
            return this.emptyFrame(displayMs)
        }

        const rawRatio = next && cur ? (t - cur.timelineMs) / Math.max(1, next.timelineMs - cur.timelineMs) : 0
        const ratio = Math.min(1, Math.max(0, rawRatio))
        // 等待期显示进度（advance 单元内 0→1）：保证回合边界内息恰达目标值（无「瞬间补全」跳变）
        const dispRatio = unit
            ? Math.min(1, Math.max(0, (displayMs - (unit.displayStart ?? 0)) / Math.max(1, unit.displayDur ?? 1)))
            : ratio
        // 等待期起点/终点快照（unit 边界）→ 内息全程匀速（忽略中间系统事件，避免折点/跳变）
        let baseSnap = snapshot
        let endSnap = nextSnapshot
        let endActorId: string | undefined
        if (unit) {
            const startIdx = this.findEventIndex(unit.logicalStart ?? 0)
            const endIdx = this.findEventIndex(unit.logicalEnd ?? this.logicalTotal)
            const endEvt = this.events[Math.max(startIdx, endIdx)]
            baseSnap = this.events[startIdx]?.event.snapshot ?? snapshot
            endSnap = endEvt?.event.snapshot ?? snapshot
            const endTurn = endEvt?.event.scope?.[0]
            if (endTurn != null) endActorId = this.segments.find((s) => s.turn === endTurn)?.actor
        }
        const chars: FrameChar[] = snapshot.characters.map((c, i) => {
            const fc = this.buildFrameChar(c, i, snapshot, nextSnapshot, prev, cur, next, t, ratio)
            const endChar = endSnap?.characters[i]
            const baseChar = baseSnap?.characters[i]
            const targetAp = c.id === endActorId || !endChar ? c.maxAp : endChar.ap
            const baseAp = baseChar?.ap ?? c.ap
            fc.ap = baseAp + (targetAp - baseAp) * dispRatio
            // 蜡烛 = 相对上一回合消耗的回复进度：回合末(apNow=trough)=满、回合开始(apNow=maxAp)=尽、等待期与内息同步
            const trough = this.troughOf(c.id, displayMs)
            fc.waitProgress = this.progressOf(fc.ap, c.maxAp, trough)
            return fc
        })

        const phase = snapshot.phase
        let currentAction: string | undefined
        if (cur?.event.type === 'attack_start') {
            currentAction = cur.event.actionName
        } else if (cur?.event.type === 'damage') {
            currentAction = cur.event.actionName
        }

        return {
            time: displayMs,
            total: this.totalDisplay,
            chars,
            currentAction,
            currentEvent: cur?.event,
            eventIndex: idx,
            phase,
        }
    }

    /** 回合冻结帧（freeze 单元）：段内按事件播放时长依次推进 */
    private getSegmentFrame(seg: Segment, elapsed: number, displayMs: number): Frame {
        // 定位段内当前事件（按累积播放时长）
        let cursor = 0
        let acc = 0
        while (cursor < seg.eventDurs.length && acc + seg.eventDurs[cursor] < elapsed) {
            acc += seg.eventDurs[cursor]
            cursor++
        }
        if (cursor >= seg.events.length) cursor = seg.events.length - 1

        const cur = seg.events[cursor]
        const prev = cursor > 0 ? seg.events[cursor - 1] : undefined
        const next = cursor < seg.events.length - 1 ? seg.events[cursor + 1] : undefined
        const snapshot = cur?.event.snapshot ?? prev?.event.snapshot
        const nextSnapshot = next?.event.snapshot ?? snapshot

        if (!snapshot) {
            return this.emptyFrame(displayMs)
        }

        // 段内当前事件窗口内进度（用于姿势/位置插值）
        const dur = seg.eventDurs[cursor] ?? SEGMENT_STEP_MS
        const local = Math.min(1, Math.max(0, (elapsed - acc) / Math.max(1, dur)))
        const t = cur?.timelineMs ?? seg.startMs
        const ratio = next ? (t - cur.timelineMs) / Math.max(1, next.timelineMs - cur.timelineMs) : 0

        // 段内行动者（buildSegments 预计算；battle_start 等无行动段为 undefined）
        const segActorId = seg.actor

        const chars: FrameChar[] = snapshot.characters.map((c, i) => {
            const fc = this.buildFrameChar(c, i, snapshot, nextSnapshot, prev, cur, next, t, ratio)
            // 冻结演出：当前事件决定姿势
            const evt = cur?.event
            if (evt?.type === 'attack_start') {
                const actorId = evt.actor
                fc.pose = actorId === c.id ? 'attack' : 'idle'
                fc.isActing = actorId === c.id
            } else if (evt?.type === 'damage' && 'target' in evt && evt.target === c.id && local < 0.3) {
                fc.pose = 'hit'
            } else if (evt?.type === 'move' && evt.actor === c.id) {
                fc.pose = 'move'
            }
            // 内息：回合演出段逻辑时间冻结。
            // 行动方：回合开始 = 满内息（已回满触发回合，maxAp 从快照拿）。
            //  每个动作窗口内 = 该动作「消耗前」的值；动作完成 → 瞬间扣到该动作快照值（动作里扣，含身法衰减）。
            // 蜡烛 = 相对上一回合消耗的回复进度：回合末(TURN_END_HOLD 显示最终剩余内息)=满、回合开始(满内息)=烧尽。
            // 非行动方 / 无行动段（battle_start 等）：内息 = 快照（冻结）。
            // 首回合前（battle_start 冻结段）：内息与蜡烛都冻结（内息=开场值，蜡烛=0），回合结束后才开始回复/燃烧
            if (displayMs < this.battleStartEnd) {
                fc.ap = this.baseApByChar.get(c.id) ?? fc.ap
                fc.waitProgress = 1
                return fc
            }
            if (segActorId === c.id) {
                const prevEvent = cursor > 0 ? seg.events[cursor - 1] : undefined
                // 回合结束停留（hold）：显示行动方最终剩余内息（蜡烛回满）
                if (elapsed >= seg.playDuration - TURN_END_HOLD_MS) {
                    fc.ap = seg.apEnd ?? c.maxAp
                } else {
                    fc.ap = cursor === 0 ? c.maxAp : (prevEvent?.event.snapshot?.characters[i]?.ap ?? c.maxAp)
                }
                // 回合内使用内息【不增加】等待条：蜡烛保持烧尽(0)；回合末 hold 才直接回满(100)
                fc.waitProgress = elapsed >= seg.playDuration - TURN_END_HOLD_MS ? 0 : 1
            } else {
                // 非行动方：整段冻结在段首快照（回合期间一切冻结；避免段末系统事件惰性回复造成微漂移）
                const firstSnap = seg.events[0]?.event.snapshot
                fc.ap = firstSnap?.characters[i]?.ap ?? c.ap
                const trough = this.troughOf(c.id, displayMs)
                fc.waitProgress = this.progressOf(fc.ap, c.maxAp, trough)
            }
            return fc
        })

        const phase = snapshot.phase
        const curEvt = cur?.event
        const currentAction =
            curEvt?.type === 'attack_start'
                ? curEvt.actionName
                : curEvt?.type === 'damage'
                  ? curEvt.actionName
                  : undefined

        return {
            time: displayMs,
            total: this.totalDisplay,
            chars,
            currentAction,
            currentEvent: curEvt,
            eventIndex: this.events.indexOf(cur!),
            phase,
            turn: seg.turn,
            freezeProgress: Math.min(1, elapsed / Math.max(1, seg.playDuration)),
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

    /** 内息回复基准（trough）：当前周期起点内息（上一回合结束后剩余）。首回合前 = 开场内息 */
    private troughOf(charId: string, displayMs: number): number {
        const base = this.baseApByChar.get(charId) ?? 0
        const list = this.charTroughs.get(charId)
        if (!list || list.length === 0) return base
        if (displayMs < list[0].start) return base
        // list 按 start 升序：二分取最后一个 start <= displayMs 的 value
        let lo = 0
        let hi = list.length - 1
        let trough = base
        while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (list[mid].start <= displayMs) {
                trough = list[mid].value
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return trough
    }

    /** 回复进度 waitProgress = 已回复/上一回合消耗量 = (apNow - trough)/(maxAp - trough)；
     *  回合末(apNow=trough)=0(满)、回合开始(apNow=maxAp)=1(尽)。消耗≈0（trough≥maxAp）时回合开始=尽。 */
    private progressOf(apNow: number, maxAp: number, trough: number): number {
        const denom = maxAp - trough
        if (denom > 0.0001) {
            return Math.min(1, Math.max(0, (apNow - trough) / denom))
        }
        return apNow >= maxAp - 0.0001 ? 1 : 0
    }

    /** 构建单个角色的帧状态 */
    private buildFrameChar(
        c: CharacterSnapshot,
        i: number,
        _snapshot: BattleSnapshot | undefined,
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

        // 等待进度 = 内息已回复比例（0=刚行动完，1=回满即将行动）
        // 与内息条同源（同一 AP 插值曲线），燃烧头 burn = 1 - waitProgress → 满=刚行动、尽=将行动
        const waitProgress = Math.min(1, Math.max(0, apLerp / Math.max(1, c.maxAp)))

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
            total: this.totalDisplay,
            chars: [],
            eventIndex: 0,
            phase: 'idle',
        }
    }
}
