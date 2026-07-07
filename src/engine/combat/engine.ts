import { Character } from '../entities/character'
import { PositionSystem } from './position'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import { getWeapon } from '../data/weapons/weapons'
import {
    calcTurnInterval,
    calcSummonInterval,
    calcApRegen,
    calcApRegenPerSec,
    calcActionDurationMs,
} from '../calc/damage'
import { canExecuteAction } from '../calc/action-executor'
import { getAction } from '../data/actions'
import { getBuff } from '../data/buffs'
import { checkCondition } from '../entities/action-config'
import { getConditionPreset } from '../data/conditions'
import type { ActionDefinition } from '../entities/action'
import type { TriggerEvent } from '../entities/trigger'
import { matchCondition } from './trigger-system'
import { reduceBleedOnHeal } from './utils/buff-layer'
import { processActionEffect, processHitCheck, processBuffEnd } from './effects'
import { tickEngine } from './tick-engine'
import type {
    ActionCommand,
    ActionResult,
    BattleState,
    EventPlan,
    BattleSnapshot,
    TurnEntry,
    BuffLayer,
    ActiveBuffSnapshot,
} from './types'
import type { SummonDef, SummonInstance } from '../entities/summon'
import type { LogEvent } from './log-events'
import { isPreHitEffect } from './effects/action'
import { MAX_CHAN } from '../constants'

// ── LogEvent 监听器类型 ──
type LogListener = (event: LogEvent) => void

export class BattleEngine {
    state!: BattleState
    #summons = new Map<string, SummonInstance>()
    #logListeners: LogListener[] = []
    #deferredEmits: { event: TriggerEvent; self: Character; enemy: Character; buffId?: string; indent: number }[] = []

    constructor(p: Character, o: Character, d = 4) {
        this.init(p, o, d)
    }

    /** 战斗开始 */
    init(p: Character, o: Character, d = 4): void {
        p.resetAp()
        o.resetAp()
        const log = new BattleLog()
        const tm = new TurnManager()
        const halfDist = d / 2
        // 初始起手延迟由身法决定：身法越高，起手越快
        tm.addCharacter(p, Math.round(calcTurnInterval(p.attrs.get('agility')) * 0.4))
        tm.addCharacter(o, Math.round(calcTurnInterval(o.attrs.get('agility')) * 0.4))
        this.state = {
            phase: 'fighting',
            characters: [p, o],
            position: new PositionSystem(p.id, -halfDist, o.id, halfDist),
            turn: tm,
            log,
            eventActorId: null,
            eventTime: 0,
            pendingBuffs: new Map(),
            actionCount: 0,
            lastActionExtraDelay: 0,
            lastActionExtraStun: 0,
            actionTimeOffset: 0,
            isEmitting: false,
            moveDelta: 0,
            triggeredThisChain: null,
        }
        log.logBattleStart(p.name, o.name, 0, this.getSnapshot())
        this.emit('battle_start', p, o)
        this.emit('battle_start', o, p)
        // 武器 on_equip 触发（初始装备）
        this.emit('on_equip', p, p)
        this.emit('on_equip', o, o)

        // 应用永久灼烧
        for (const c of [p, o]) {
            if (c.permanentBurn > 0) {
                const key = `permanent_burn::${c.id}`
                this.state.pendingBuffs.set(key, { restoreValue: c.permanentBurn })
                this.state.turn.scheduleSystemEventAt(`tick_buff_${key}`, 0, 'tick_buff')
            }
        }

        // 创建召唤物
        this.#initSummons(p)
        this.#initSummons(o)
    }

    /** 为角色创建召唤物（已存在则跳过） */
    #initSummons(self: Character): void {
        const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
        this.#initSummonFromDef(weapon.summon, self)
        // 奇物召唤物
        for (const art of self.artifactDefs) {
            this.#initSummonFromDef(art.summon, self)
        }
    }

    #initSummonFromDef(sd: SummonDef | undefined, self: Character): void {
        if (!sd) return
        const action = sd.action ?? getAction(sd.actionId)
        const preDelay = action?.extraPreDelay ?? 0
        for (let i = 0; i < sd.maxCount(self.attrs.get('wisdom')); i++) {
            const sid = `${sd.id}_${self.id}_${i}`
            if (this.state.turn.entries.some((e) => e.id === sid)) continue
            const inst: SummonInstance = {
                id: sid,
                ownerId: self.id,
                index: i,
                actionId: sd.actionId,
            }
            this.#summons.set(sid, inst)
            this.state.turn.addSummon(sid, self.id, preDelay + i * preDelay)
        }
    }

    /** 获取角色当前活跃 buff 列表 */
    getBuffs(charId: string): ActiveBuffSnapshot[] {
        const result: ActiveBuffSnapshot[] = []
        const byBuffId = new Map<string, number>()
        for (const [key, layer] of this.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== charId) continue
            const buffId = parts[0]
            const def = getBuff(buffId)
            const name = def?.name ?? buffId
            if (buffId === 'stun_track') {
                const consecutive = (layer.extra?.consecutive as number) ?? 0
                result.push({ buffId, name, stacks: consecutive })
                continue
            }
            if (!byBuffId.has(buffId)) {
                byBuffId.set(buffId, 0)
            }
            // additive: restoreValue = total stacks; independent: each layer = +1
            const stacking = def?.stacking?.type
            if (stacking === 'additive') {
                byBuffId.set(buffId, (byBuffId.get(buffId) ?? 0) + layer.restoreValue)
            } else {
                // none / independent: count layers
                byBuffId.set(buffId, (byBuffId.get(buffId) ?? 0) + 1)
            }
        }
        for (const [buffId, stacks] of byBuffId) {
            result.push({ buffId, name: getBuff(buffId)?.name ?? buffId, stacks })
        }
        return result
    }

    /** 构建当前战斗快照 */
    getSnapshot(): BattleSnapshot {
        const { characters, turn, pendingBuffs, phase, position } = this.state
        return {
            time: turn.currentTime,
            phase,
            distance: position.distance(characters[0].id, characters[1].id),
            characters: [
                {
                    id: characters[0].id,
                    name: characters[0].name,
                    hp: characters[0].hp,
                    maxHp: characters[0].maxHp,
                    ap: characters[0].ap,
                    maxAp: characters[0].maxAp,
                    chan: characters[0].chan,
                    pos: position.get(characters[0].id),
                    weapon: characters[0].build.weapon,
                    spriteId: characters[0].build.spriteId ?? 'default',
                    buffs: this.getBuffs(characters[0].id),
                    attrs: characters[0].attrs.getAll(),
                    baseAttrs: {
                        ...characters[0].build.baseAttrs,
                    } as Record<string, number>,
                },
                {
                    id: characters[1].id,
                    name: characters[1].name,
                    hp: characters[1].hp,
                    maxHp: characters[1].maxHp,
                    ap: characters[1].ap,
                    maxAp: characters[1].maxAp,
                    chan: characters[1].chan,
                    pos: position.get(characters[1].id),
                    weapon: characters[1].build.weapon,
                    spriteId: characters[1].build.spriteId ?? 'default',
                    buffs: this.getBuffs(characters[1].id),
                    attrs: characters[1].attrs.getAll(),
                    baseAttrs: {
                        ...characters[1].build.baseAttrs,
                    } as Record<string, number>,
                },
            ],
            turn: { time: turn.currentTime, queue: [...turn.entries] },
            pendingBuffs: [...pendingBuffs.entries()],
            actionCount: this.state.actionCount,
        }
    }

    /** 公开入口：执行一个行动（角色行动或系统事件） */
    runEvent(planFn: EventPlan): boolean {
        const e = this.state.turn.peek()
        if (!e) return false
        this.state.eventActorId = e.type === 'character' ? e.id : null
        this.state.eventTime = e.nextActionAt
        this.state.actionTimeOffset = 0

        // 系统事件
        if (e.type === 'system') {
            this.#handleSystemEvent()
            this.state.turn.removeEntry(e.id)
            this.state.eventActorId = null
            return true
        }

        this.state.actionCount++

        // 召唤物行动
        if (e.type === 'summon') {
            return this.#handleSummonTurn(e)
        }

        // 角色事件
        const chars = this.state.characters
        const self = chars.find((c) => c.id === e.id)!
        const enemy = chars.find((c) => c.id !== e.id)!

        // 跳过死亡角色
        if (!self.isAlive()) {
            this.state.turn.next()
            this.state.eventActorId = null
            if (enemy.isAlive()) {
                this.state.log.logDefeat(self.name, enemy.name, this.state.turn.currentTime, this.getSnapshot())
                this.state.phase = 'finished'
                this.state.lastWinner = enemy.name
            } else if (!this.state.lastWinner) {
                this.state.phase = 'finished'
            }
            return true
        }

        // ── 1. AP 回复（距离上次行动/召唤消耗经过的时间） ──
        const lastRef = Math.max(self.lastActionEndMs, self.lastApUpdate)
        if (lastRef > 0) {
            const elapsedMs = e.nextActionAt - lastRef
            if (elapsedMs > 0) {
                self.ap = Math.min(self.maxAp, self.ap + calcApRegen(elapsedMs, self.attrs.get('wisdom')))
            }
        }
        self.capAp()

        // ── 2. AP 未满 → 等回复满了再行动 ──
        if (self.ap < self.maxAp) {
            const deficit = self.maxAp - self.ap
            const regenPerSec = calcApRegenPerSec(self.attrs.get('wisdom'))
            const waitMs = Math.ceil((deficit / regenPerSec) * 1000)
            this.state.turn.next()
            this.state.turn.scheduleNext(
                { type: 'character', id: self.id, preDelay: 0, stunTime: 0, haste: self.getHaste() },
                waitMs,
            )
            this.state.eventActorId = null
            return true
        }

        this.emit('turn_start', self, enemy)
        // 重建召唤物（法球等每回合重新入队）
        this.#initSummons(self)

        // ── 3. AI 决策 + 执行指令 ──
        const cmds = planFn(self, enemy, this.state)
        let totalActionDurationMs = 0
        let firstActionTime = 0
        for (const cmd of cmds) {
            if (self.ap <= 0 && cmd.type !== 'support') break
            // 用当前即时身法计算该指令耗时
            const agility = self.attrs.get('agility')
            const cost =
                cmd.type === 'move'
                    ? Math.abs(cmd.bestDistance ?? 0)
                    : cmd.actionId
                      ? (self.actions.find((a) => a.id === cmd.actionId)?.apCost ?? 0)
                      : 0
            if (firstActionTime === 0 && cost > 0) {
                firstActionTime = this.state.turn.currentTime + this.state.actionTimeOffset
            }
            const cmdDur = Math.max(1, calcActionDurationMs(cost, agility))
            totalActionDurationMs += cmdDur
            this.execute(cmd, self, enemy)
            this.state.actionTimeOffset += cmdDur
        }
        if (cmds.length === 0) {
            this.emitLog({ type: 'system', message: BattleLog.plain(self.name, '没有行动'), actorId: self.id })
        }

        // endEvent
        // ── Buff onTurnEnd 钩子（不依赖命中） ──
        for (const [key, layer] of this.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== self.id) continue
            const def = getBuff(parts[0])
            if (def?.onTurnEnd) {
                def.onTurnEnd({
                    final: 0,
                    raw: 0,
                    attacker: self,
                    target: enemy,
                    engine: this,
                    state: this.state,
                    layer,
                })
            }
        }
        this.emit('turn_end', self, enemy)
        this.state.turn.next()

        // ── 4. 计算下次行动的间隔 = 行动耗时 + AP 回复耗时 ──
        const remainingAp = self.ap
        const regenPerSec = calcApRegenPerSec(self.attrs.get('wisdom'))
        const regenMs = Math.ceil(((self.maxAp - remainingAp) / regenPerSec) * 1000)
        let totalDelay = totalActionDurationMs + regenMs
        // 没有执行任何指令时最低等待一个完整回复周期（防止死循环）
        if (totalActionDurationMs === 0) {
            totalDelay = Math.max(totalDelay, Math.ceil((self.maxAp / regenPerSec) * 1000))
        }

        self.lastActionEndMs =
            firstActionTime > 0 ? firstActionTime : this.state.turn.currentTime + totalActionDurationMs
        this.state.turn.scheduleNext(
            { type: 'character', id: self.id, preDelay: 0, stunTime: 0, haste: self.getHaste() },
            totalDelay,
        )
        this.state.eventActorId = null
        return true
    }

    /** 触发检测：同一事件链每人每事件最多触发一次，indentDepth 不受 emit 重置 */
    emit(event: TriggerEvent, self: Character, enemy: Character, buffId?: string) {
        if (!this.state.triggeredThisChain) this.state.triggeredThisChain = new Set()
        const key = `${self.id}:${event}`
        if (this.state.triggeredThisChain.has(key)) return
        if (this.state.isEmitting) {
            this.#deferredEmits.push({ event, self, enemy, buffId, indent: this.state.log.indentDepth })
            return
        }
        const savedIndent = this.state.log.indentDepth
        this.state.isEmitting = true
        this.state.triggeredThisChain.add(key)
        this.#processEmit(event, self, enemy, buffId)
        this.state.isEmitting = false

        while (this.#deferredEmits.length > 0) {
            const d = this.#deferredEmits.shift()!
            const dKey = `${d.self.id}:${d.event}`
            if (this.state.triggeredThisChain?.has(dKey)) continue
            this.state.triggeredThisChain?.add(dKey)
            this.state.log.indentDepth = d.indent
            this.state.isEmitting = true
            this.#processEmit(d.event, d.self, d.enemy, d.buffId)
            this.state.isEmitting = false
        }
        this.state.triggeredThisChain = null
        this.state.log.indentDepth = savedIndent
    }

    #processEmit(event: TriggerEvent, self: Character, enemy: Character, buffId?: string) {
        const { moveDelta, position } = this.state
        const isInitPhase = event === 'battle_start' || event === 'turn_start' || event === 'on_equip'
        for (const slot of self.triggers) {
            if (slot.condition.type !== event) continue
            if (slot.condition.buffId && slot.condition.buffId !== buffId) continue
            if (
                !matchCondition(slot.condition, {
                    actor: self,
                    distance: position.distance(self.id, enemy.id),
                    moveDelta,
                    engine: this,
                    buffId,
                })
            )
                continue

            if (slot.effects) {
                if (!isInitPhase) this.state.log.indentDepth++
                for (const eff of slot.effects) {
                    processActionEffect(eff, self, enemy, this, this.#tMs)
                }
                if (!isInitPhase) this.state.log.indentDepth--
                continue
            }
            if (!slot.actionId) continue
            const action = getAction(slot.actionId)
            if (!action) continue
            // 触发器招式 AP 上限（防止高消耗大招白嫖）
            if (action.apCost > 2) continue
            const inst = self.actions.find((a) => a.id === slot.actionId)
            if (!inst || !inst.canUse()) continue

            if (action.target === 'self') {
                if (!isInitPhase) this.state.log.indentDepth++
                for (const eff of action.effects ?? []) {
                    processActionEffect(eff, self, enemy, this, this.#tMs, action)
                }
                if (!isInitPhase) this.state.log.indentDepth--
                inst.use()
            } else {
                // 触发招式不消耗 AP（apCost 上限 2 已在前过滤），但仍需距离/标签/条件检测
                const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
                const range: [number, number] = action.getRange?.(weapon.range, self) ?? weapon.range
                const dist = this.state.position.distance(self.id, enemy.id)
                if (dist < range[0] || dist > range[1]) continue
                if (action.requiredTags.length > 0) {
                    const hasTag = action.requiredTags.some((tag) => weapon.tags.includes(tag))
                    if (!hasTag) continue
                }
                if (action.canUse && !action.canUse(self, this.state)) continue
                this.state.log.indentDepth++
                this.#executeAction(action, self, enemy, true)
                this.state.log.indentDepth--
                inst.use()
                this.emit('on_action_trigger', self, enemy)
                tickEngine.onBleedTrigger(self, this)
            }
        }
    }

    private execute(cmd: ActionCommand, self: Character, enemy: Character): ActionResult {
        switch (cmd.type) {
            case 'move':
                return this.#executeMove(cmd, self)
            case 'attack':
                return this.#executeAttack(cmd, self, enemy)
            case 'support':
                return this.#executeSupport(cmd, self)
            default:
                this.emitLog({
                    type: 'system',
                    message: BattleLog.plain(self.name, `未知指令: ${cmd.type}`),
                    actorId: self.id,
                })
                return this.#emptyResult()
        }
    }

    /** 快捷访问 */
    get #tMs(): number {
        return this.state.turn.peek()?.nextActionAt ?? 0
    }
    get #buffs(): Map<string, BuffLayer> {
        return this.state.pendingBuffs
    }

    /** 注册日志监听器 */
    onLog(listener: LogListener): void {
        this.#logListeners.push(listener)
    }

    /** 发射日志事件（自动附加当前快照和缩进，已按行动耗时偏移时间戳） */
    emitLog(event: LogEvent): void {
        const snap = this.getSnapshot()
        const tMs = this.state.eventTime + this.state.actionTimeOffset
        const enriched = { ...event, snapshot: snap, indent: this.state.log.indentDepth }
        this.state.log.handleLogEvent(enriched, snap, tMs)
        for (const l of this.#logListeners) l(enriched)
    }

    getCharacter(id: string): Character | undefined {
        return this.state.characters.find((c) => c.id === id)
    }

    getOpponent(id: string): Character | undefined {
        return this.state.characters.find((c) => c.id !== id)
    }

    /** 检查缠劲溢出，满30层加「周」buff，不满30层移除 */
    checkChanOverflow(charId: string): void {
        const char = this.getCharacter(charId)
        if (!char) return
        const curValue = char.chan
        const zhouKey = `zhou::${charId}`
        const hasZhou = this.state.pendingBuffs.has(zhouKey)

        if (curValue >= MAX_CHAN) {
            processActionEffect(
                { type: 'add_buff', buffId: 'zhou', stacks: 2 },
                char,
                char,
                this,
                this.state.turn.currentTime,
            )
            const enemy = this.getOpponent(charId)
            if (enemy) this.emit('chan_overflow', char, enemy)
        } else if (curValue >= 30 && curValue < MAX_CHAN && !hasZhou) {
            processActionEffect(
                { type: 'add_buff', buffId: 'zhou', stacks: 1 },
                char,
                char,
                this,
                this.state.turn.currentTime,
            )
        } else if (curValue < 30 && hasZhou) {
            processActionEffect({ type: 'remove_buff', buffId: 'zhou' }, char, char, this, this.state.turn.currentTime)
        }
    }

    #emptyResult(): ActionResult {
        return {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
        }
    }

    #executeMove(cmd: ActionCommand, self: Character): ActionResult {
        const p = this.state.position
        const enemy = this.getOpponent(self.id)!
        const r: ActionResult = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
        }
        const { ap, delta } = PositionSystem.calcMovement(
            cmd.bestDistance ?? 0,
            self.attrs.get('agility'),
            1 + self.moveEfficiency,
            this.state.pendingBuffs.has(`min_move_cost::${self.id}`),
        )
        if (!self.spendAp(ap)) {
            // this.emitLog({ type: 'system', message: BattleLog.plain(self.name, 'AP不足 无法移动'), actorId: self.id })
            return r
        }
        const actualDelta = p.moveToward(self.id, enemy.id, delta)
        r.distanceDelta = actualDelta
        this.emitLog({
            type: 'move',
            sourceId: self.id,
            delta: actualDelta,
            newDistance: p.distance(self.id, enemy.id),
            apCost: ap,
            apRemaining: self.ap,
        })
        if (delta < 0) {
            this.emit('on_move_closer', self, enemy)
            this.state.moveDelta = actualDelta
            this.emit('on_opponent_move_closer', enemy, self)
            this.state.moveDelta = 0
        } else if (delta > 0) {
            this.emit('on_move_away', self, enemy)
            this.state.moveDelta = actualDelta
            this.emit('on_opponent_move_away', enemy, self)
            this.state.moveDelta = 0
        }
        tickEngine.onBleedTrigger(self, this)
        return r
    }

    #executeAttack(cmd: ActionCommand, self: Character, enemy: Character): ActionResult {
        const inst = self.actions.find((a) => a.id === cmd.actionId)
        const action = inst?.def ?? (cmd.actionId ? getAction(cmd.actionId) : undefined)
        if (!action) {
            this.emitLog({ type: 'system', message: BattleLog.plain(self.name, '没有可用招式'), actorId: self.id })
            return this.#emptyResult()
        }
        // 本体招式发出前事件（供对手反制，御物/触发招式不触发）
        this.state.lastActionExtraDelay = action.extraPreDelay ?? 0
        this.state.lastActionExtraStun = action.extraStunTime ?? 0
        this.emit('on_pre_action', enemy, self)
        const r = this.#executeAction(action, self, enemy)
        tickEngine.onBleedTrigger(self, this)
        return r
    }

    /** 统一招式执行 */
    #executeAction(action: ActionDefinition, self: Character, enemy: Character, triggered = false): ActionResult {
        const r: ActionResult = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
        }
        // 失心检查（从 buff 读取）
        const fcKey = `fumble_chance::${self.id}`
        const fcLayer = this.state.pendingBuffs.get(fcKey)
        if (fcLayer && Math.random() < fcLayer.restoreValue * 0.05) {
            this.emitLog({ type: 'fumble', sourceId: self.id })
            return r
        }
        // 验证（触发招式已在 #processEmit 中通过距离/标签/条件检查，且不消耗 AP）
        if (!triggered) {
            const c = canExecuteAction(action, self, this.state, this)
            if (!c.ok) return r
        }
        if (!triggered) {
            let cost = action.apCost
            for (const [key, layer] of this.state.pendingBuffs) {
                const parts = key.split('::')
                if (parts.length < 2 || parts[1] !== self.id) continue
                const def = getBuff(parts[0])
                if (!def?.onActionCost) continue
                cost = Math.max(
                    1,
                    cost +
                        def.onActionCost({
                            final: 0,
                            raw: 0,
                            attacker: self,
                            target: enemy,
                            engine: this,
                            state: this.state,
                            layer,
                            source: action,
                        }),
                )
            }
            if (action.chanCost) self.spendChan(action.chanCost)
            if (!self.spendAp(cost)) return r
        }
        // 消耗限次招式
        const inst = self.actions.find((a) => a.id === action.id)
        if (inst && inst.def.maxUses !== undefined) inst.use()
        this.checkChanOverflow(self.id)
        const weapon = getWeapon(self.build.weapon)
        this.emitLog({
            type: 'attack_start',
            actionId: action.id,
            actionName: action.name,
            weapon: weapon.name,
            sourceId: self.id,
            targetId: enemy.id,
            apCost: action.apCost,
            apRemaining: self.ap,
            triggered,
            indent: this.state.log.indentDepth,
        })
        this.state.lastActionExtraDelay = action.extraPreDelay ?? 0
        // buff onAction 钩子（出招即触发，不受命中影响）
        for (const [key, layer] of this.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== self.id) continue
            const def = getBuff(parts[0])
            if (!def?.onAction) continue
            def.onAction({
                final: 0,
                raw: 0,
                target: enemy,
                attacker: self,
                engine: this,
                state: this.state,
                layer,
                source: action,
            })
        }
        // 不受命中影响的效果先执行（移动、换武、buff 等）
        for (const eff of action.effects ?? []) {
            if (isPreHitEffect(eff.type)) {
                processActionEffect(eff, self, enemy, this, this.#tMs, action)
            }
        }
        // 战斗判定
        if (!processHitCheck(action, r, self, enemy, this)) return r
        // 效果应用
        this.#finalizeAttack(action, r, self, enemy)
        // 天机消耗：非辅助招式执行后，消耗天机并重置玄机层数（放在 hooks 生效之后）
        if (
            this.state.pendingBuffs.has(`tianji_ready::${self.id}`) &&
            !action.tags.includes('pre_action') &&
            !action.tags.includes('post_action')
        ) {
            this.state.pendingBuffs.delete(`tianji_ready::${self.id}`)
            this.state.pendingBuffs.delete(`xuan_ji::${self.id}`)
            this.emitLog({
                type: 'system',
                message: BattleLog.plain(self.name, `天机已用（${action.name}），玄机重置`),
                actorId: self.id,
            })
        }
        return r
    }

    /** 命中后效：触发/流血/状态/击败 */
    #finalizeAttack(action: ActionDefinition, r: ActionResult, self: Character, enemy: Character): void {
        const tMs = this.#tMs

        this.emit('on_hit', self, enemy)
        this.emit('on_was_hit', enemy, self)

        // 按攻击方招式 tag 命中触发（发射给防守方，与 on_was_hit 对应）
        if (action.tags.includes('melee')) this.emit('on_melee', enemy, self)
        if (action.tags.includes('range')) this.emit('on_range', enemy, self)
        if (action.tags.includes('unarmed')) this.emit('on_unarmed', enemy, self)
        if (action.tags.includes('polearm')) this.emit('on_polearm', enemy, self)

        this.state.log.indentDepth++
        for (const eff of action.effects ?? []) {
            if (
                (eff.type === 'add_debuff' || eff.type === 'damage' || eff.type === 'fixed_damage') &&
                r.hit &&
                !r.dodged
            ) {
                processActionEffect(eff, self, enemy, this, tMs, action)
            } else if (r.hit && !r.dodged && !isPreHitEffect(eff.type)) {
                processActionEffect(eff, self, enemy, this, tMs, action)
            }
        }
        this.state.log.indentDepth--
        tickEngine.onBleedTrigger(enemy, this)
        // HP 阈值触发检测
        this.emit('hp_below', self, enemy)
        this.emit('hp_below', enemy, self)
        if (!enemy.isAlive()) {
            this.emitLog({ type: 'defeat', loserId: enemy.id, winnerId: self.id })
            this.state.phase = 'finished'
            if (self.isAlive()) {
                this.state.lastWinner = self.name
            }
        }
    }

    #executeSupport(cmd: ActionCommand, self: Character): ActionResult {
        const r = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
            knockbackDistance: 0,
        }
        if (!cmd.actionId) return r
        const inst = self.actions.find((a) => a.id === cmd.actionId)
        if (
            !inst ||
            (!inst.def.tags.includes('pre_action') && !inst.def.tags.includes('post_action')) ||
            !inst.canUse()
        )
            return r
        // 运行时验证（条件可能在前摇/主招后才满足）
        if (inst.def.canUse && !inst.def.canUse(self, this.state)) return r
        const config = self.getConfig(inst.id)
        if (config?.conditionId) {
            const cond = getConditionPreset(config.conditionId)
            if (cond && !checkCondition(cond, self, this.state)) return r
        }
        if (!self.spendAp(inst.apCost)) {
            return r
        }
        inst.use()
        if (inst.def.chanCost) self.spendChan(inst.def.chanCost)
        this.checkChanOverflow(self.id)
        this.emitLog({
            type: 'system',
            message: BattleLog.msg(inst.name, self.name, ''),
            actorId: self.id,
        })
        for (const eff of inst.def.effects ?? []) {
            processActionEffect(eff, self, self, this, this.#tMs, inst.def)
        }
        return r
    }

    /** 加速角色所有召唤物（直接修改下次行动时间） */
    speedUpSummons(ownerId: string, deltaMs: number): void {
        for (const [id, inst] of this.#summons) {
            if (inst.ownerId === ownerId) {
                this.state.turn.modifyTime(id, -deltaMs)
            }
        }
    }

    /** 处理召唤物回合 */
    #handleSummonTurn(e: TurnEntry & { type: 'summon' }): boolean {
        const inst = this.#summons.get(e.id)
        if (!inst) return true

        const owner = this.getCharacter(e.ownerId)
        const enemy = this.getOpponent(e.ownerId)
        if (!owner || !enemy) return true

        let summonAction: ActionDefinition | undefined
        // 先找武器召唤物 action
        const weapon = owner.weaponDef ?? getWeapon(owner.build.weapon)
        if (weapon.summon && weapon.summon.actionId === inst.actionId) {
            summonAction = weapon.summon.action ?? getAction(weapon.summon.actionId)
        }
        // 再找奇物召唤物 action
        if (!summonAction) {
            for (const art of owner.artifactDefs) {
                if (art.summon && art.summon.actionId === inst.actionId) {
                    summonAction = art.summon.action ?? getAction(art.summon.actionId)
                    break
                }
            }
        }
        if (!summonAction) {
            // 武器变更（被缴械等）导致召唤物失效
            this.state.turn.removeEvents(e.id)
            this.#summons.delete(e.id)
            return true
        }

        // 召唤物消耗主人 AP，按 AP 恢复速度决定下一击间隔
        let apRegenDelay = 0
        const t = this.state.turn.currentTime
        if (owner.lastApUpdate > 0 || owner.lastActionEndMs > 0) {
            const ref = owner.lastApUpdate > 0 ? owner.lastApUpdate : owner.lastActionEndMs
            if (t > ref) {
                owner.ap = Math.min(owner.maxAp, owner.ap + calcApRegen(t - ref, owner.attrs.get('wisdom')))
            }
        }
        owner.lastApUpdate = t
        if (owner.ap >= summonAction.apCost) {
            this.#executeAction(summonAction, owner, enemy)
            const regenPerSec = calcApRegenPerSec(owner.attrs.get('wisdom'))
            apRegenDelay = Math.ceil((summonAction.apCost / regenPerSec) * 1000)
        }
        this.state.turn.next()
        const interval = calcSummonInterval(
            owner.attrs.get('wisdom'),
            summonAction.extraPreDelay ?? 0,
            summonAction.extraStunTime ?? 0,
        )
        this.state.turn.scheduleNext({ type: 'summon', id: e.id, ownerId: e.ownerId }, Math.max(interval, apRegenDelay))
        return true
    }

    /** 处理系统事件（buff 到期、status tick 等） */
    #handleSystemEvent(): void {
        const e = this.state.turn.peek()! as TurnEntry & { type: 'system' }
        if (!e.systemEventType) return
        const eventId = e.id

        switch (e.systemEventType) {
            case 'buff_end':
                this.#handleBuffEnd(eventId)
                break
            case 'tick_poison':
            case 'tick_burn':
                this.#handleBuffTick(eventId, e.systemEventType, e.nextActionAt)
                break
            case 'stun_reset': {
                const charId = eventId.slice('stun_reset_'.length)
                this.#buffs.delete(`stun_track::${charId}`)
                break
            }
            case 'tick_buff': {
                const key = eventId.slice('tick_buff_'.length)
                const [buffId, charId] = key.split('::')
                const buffDef = getBuff(buffId)
                const char = this.getCharacter(charId)
                if (!char || !char.isAlive() || !buffDef) break
                if (buffDef.onTickDamage) {
                    const layer = this.state.pendingBuffs.get(key)
                    if (!layer) break
                    const dmg = buffDef.onTickDamage({
                        final: 0,
                        raw: 0,
                        target: char,
                        attacker: char,
                        engine: this,
                        state: this.state,
                        layer: layer!,
                        source: undefined!,
                    })
                    if (dmg > 0) {
                        char.takeDamage(dmg)
                        this.emitLog({
                            type: 'damage_over_time',
                            sourceId: charId,
                            targetId: charId,
                            amount: dmg,
                            status: buffDef.name,
                        })
                    }
                }
                if (buffDef.onTickHeal) {
                    const layer = this.state.pendingBuffs.get(key)
                    if (!layer) break
                    const amt = buffDef.onTickHeal({
                        final: 0,
                        raw: 0,
                        target: char,
                        attacker: char,
                        engine: this,
                        layer: layer!,
                        state: this.state,
                        source: undefined!,
                    })
                    if (amt > 0) {
                        char.heal(amt, this)
                        reduceBleedOnHeal(this, char.id, amt, 8)
                        this.emitLog({
                            type: 'heal',
                            actionId: buffDef.id,
                            actionName: buffDef.name,
                            sourceId: char.id,
                            targetId: char.id,
                            amount: amt,
                        })
                        // 通知所有 buff 持有者收到治疗
                        for (const [key, layer] of this.state.pendingBuffs) {
                            const [buffId, charId] = key.split('::')
                            if (charId !== char.id) continue
                            const def = getBuff(buffId)
                            if (def?.onReceiveHeal) {
                                def.onReceiveHeal({
                                    final: amt,
                                    raw: amt,
                                    target: char,
                                    attacker: char,
                                    engine: this,
                                    state: this.state,
                                    layer,
                                })
                            }
                        }
                    }
                }
                if (this.state.pendingBuffs.has(key)) {
                    this.state.turn.scheduleSystemEventAt(
                        eventId,
                        e.nextActionAt + (buffDef.tickInterval ?? 1000),
                        'tick_buff',
                    )
                }
                break
            }
        }
    }

    /** buff 到期恢复 */
    #handleBuffEnd(eventId: string): void {
        processBuffEnd(eventId.slice('buff_end_'.length), this)
    }

    /** buff tick（毒/灼烧） */
    #handleBuffTick(eventId: string, type: 'tick_poison' | 'tick_burn', eventTime: number): void {
        const { turn } = this.state
        const charId = eventId.slice(type === 'tick_poison' ? 'tick_poison_'.length : 'tick_burn_'.length)
        const char = this.getCharacter(charId)
        if (!char) return

        if (type === 'tick_poison') {
            const { nextInterval } = tickEngine.onPoisonTick(charId, this)
            if (nextInterval > 0) {
                turn.removeEvents(eventId)
                turn.scheduleSystemEventAt(eventId, eventTime + nextInterval, 'tick_poison')
            }
        } else {
            const { nextInterval } = tickEngine.onBurnTick(charId, this)
            if (nextInterval > 0) {
                turn.removeEvents(eventId)
                turn.scheduleSystemEventAt(eventId, eventTime + nextInterval, 'tick_burn')
            }
        }
    }
}
