import { Character } from '../entities/character'
import { PositionSystem } from './position'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import { getWeapon } from '../../data/weapons/weapons'
import { calcSummonInterval, calcApRegen, calcActionDurationMs, MIN_TURN_DELAY_MS } from '../calc/damage'
import { canExecuteAction } from '../calc/action-executor'
import { calcEffectiveApRegenPerSec, calcExtraApRegenPerSec } from './utils/ap-regen'
import { calcEffectiveChanRegenPerSec } from './utils/chan-regen'
import { getAction as getBaseAction } from '../../data/actions'
import { getRuntimeAction } from '../../data/actions'
import { getBuff } from '../../data/buffs'
import { checkCondition } from '../../game/entities/action-config'
import { getConditionPreset } from '../../data/conditions'
import type { ActionDefinition, EffectDef } from '../entities/action'
import type { TriggerEvent } from '../entities/trigger'
import { matchCondition } from './trigger-system'
import { reduceBleedOnHeal } from './utils/buff-layer'
import { processActionEffect, processHitCheck, processBuffEnd } from './effects'
import { processOnEquipEffects, forEachBuffOf } from './utils'
import { tickEngine } from './tick-engine'
import type {
    ActionCommand,
    ActionResult,
    AttrSourceBreakdown,
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
    #quiet = false
    #deferredEmits: {
        event: TriggerEvent
        self: Character
        enemy: Character
        buffId?: string
        scope: number[]
    }[] = []

    constructor(p: Character, o: Character, d = 4, quiet = false) {
        this.#quiet = quiet
        this.init(p, o, d)
    }

    /** 战斗开始 */
    init(p: Character, o: Character, d = 4): void {
        // 半 AP 起手：双方从 50% AP 开始回复，谁先回复满谁先动（先手由推演决定）
        p.ap = p.maxAp * 0.5
        o.ap = o.maxAp * 0.5
        const log = new BattleLog()
        const tm = new TurnManager()
        const halfDist = d / 2
        tm.addCharacter(p, 0)
        tm.addCharacter(o, 0)
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
            isEmitting: false,
            moveDelta: 0,
            triggeredThisChain: null,
        }
        log.logBattleStart(p.name, o.name, 0, this.getSnapshot())
        this.emit('battle_start', p, o)
        this.emit('battle_start', o, p)
        // 触发所有 on_equip 效果（主手+奇物+副手）
        for (const ch of [p, o]) {
            const items = [getWeapon(ch.build.weapon), ...ch.artifactDefs]
            if (ch.build.offhand) items.push(getWeapon(ch.build.offhand))
            processOnEquipEffects(this, ch, items, 0)
        }
        // 广播武器变更事件（让被动如行云流水切换架势）
        this.emit('on_weapon_change', p, o)
        this.emit('on_weapon_change', o, p)

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

        // 统一资源回复 tick：AP 额外回复（apRegenPerSec）与缠劲回复（chanRegenPerSec）
        this.state.turn.scheduleSystemEventAt(`regen_tick_${p.id}`, 1000, 'regen_tick')
        this.state.turn.scheduleSystemEventAt(`regen_tick_${o.id}`, 1000, 'regen_tick')
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
        const action = sd.action ?? getBaseAction(sd.actionId)
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
    private sumAttrMods(effects: EffectDef[]): Record<string, number> {
        const mods: Record<string, number> = {}
        for (const e of effects) {
            if (e.type === 'stat_buff' && e.attrs) {
                for (const [attr, val] of Object.entries(e.attrs)) {
                    mods[attr] = (mods[attr] ?? 0) + val
                }
            }
        }
        return mods
    }

    private getAttrBreakdown(c: Character): AttrSourceBreakdown {
        return {
            passives: this.sumAttrMods(c.passiveDefs.flatMap((p) => p.effects ?? [])),
            artifacts: this.sumAttrMods(c.artifactDefs.flatMap((a) => a.effects ?? [])),
            weapons: this.sumAttrMods(c.weaponDef?.effects ?? []),
        }
    }

    /** 快照内息 = 已含「自上次恢复参考点以来」的回复（引擎惰性回复实时化，仅显示用，不改状态） */
    private snapshotAp(c: Character): number {
        const lastRef = Math.max(c.lastActionEndMs, c.lastApUpdate)
        const elapsedMs = Math.max(0, this.state.eventTime - lastRef)
        const recovered = c.ap + calcApRegen(elapsedMs, c.attrs.get('wisdom'))
        return Math.min(c.maxAp, recovered)
    }

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
                    ap: this.snapshotAp(characters[0]),
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
                    attrBreakdown: this.getAttrBreakdown(characters[0]),
                },
                {
                    id: characters[1].id,
                    name: characters[1].name,
                    hp: characters[1].hp,
                    maxHp: characters[1].maxHp,
                    ap: this.snapshotAp(characters[1]),
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
                    attrBreakdown: this.getAttrBreakdown(characters[1]),
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
        // 同步时间游标：处理期间 currentTime 即当前事件时刻（不陈旧）
        this.state.turn.setTime(e.nextActionAt)

        // 系统事件
        if (e.type === 'system') {
            // 系统事件（buff tick/到期等）：独立重置作用域，避免与上一个招式的反应链粘在一起
            this.state.log.resetScope(this.state.actionCount)
            this.#handleSystemEvent(e.systemEventType!, e.id, e.nextActionAt)
            if (e.systemEventType !== 'tick_poison' && e.systemEventType !== 'tick_burn') {
                this.state.turn.removeEntry(e.id)
            }
            this.state.eventActorId = null
            return true
        }

        // 召唤物行动：每次开火算一个行动回合
        if (e.type === 'summon') {
            this.state.actionCount++
            this.state.log.resetScope(this.state.actionCount)
            return this.#handleSummonTurn(e)
        }

        // 角色事件
        const chars = this.state.characters
        const self = chars.find((c) => c.id === e.id)!
        const enemy = chars.find((c) => c.id !== e.id)!

        // 跳过死亡角色
        if (!self.isAlive()) {
            this.state.turn.next(e.id)
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

        // ── 1. AP 回复（距离上次行动/召唤消耗经过的时间；起手 lastRef=0 也从 0 起计，支撑半 AP 起手） ──
        const lastRef = Math.max(self.lastActionEndMs, self.lastApUpdate)
        const elapsedMs = e.nextActionAt - lastRef
        if (elapsedMs > 0) {
            self.ap = Math.min(self.maxAp, self.ap + calcApRegen(elapsedMs, self.attrs.get('wisdom')))
        }
        self.capAp()
        // AP 已恢复至本回合时刻 → 更新恢复参考点（getSnapshot 叠加回复时不再对行动方双计）
        self.lastActionEndMs = e.nextActionAt
        self.lastApUpdate = e.nextActionAt

        // ── 2. AP 未满 → 等回复满了再行动 ──
        if (self.ap < self.maxAp) {
            const deficit = self.maxAp - self.ap
            const regenPerSec = calcEffectiveApRegenPerSec(this.state, self)
            const waitMs = Math.ceil((deficit / regenPerSec) * 1000)
            this.state.turn.next(self.id)
            this.state.turn.scheduleNext({ type: 'character', id: self.id }, waitMs)
            this.state.eventActorId = null
            return true
        }

        // 真正行动 → 连续回合号 +1（AP 未满 reschedule / 死亡跳过不计入）
        this.state.actionCount++
        this.state.log.resetScope(this.state.actionCount)

        this.emit('turn_start', self, enemy)
        // 重建召唤物（法球等每回合重新入队）
        this.#initSummons(self)

        // ── 3. AI 决策 + 执行指令（原子回合：回合内瞬间完成，招式不占调度时间） ──
        const cmds = planFn(self, enemy, this.state)
        for (const cmd of cmds) {
            if (self.ap <= 0 && cmd.type !== 'support') break
            this.execute(cmd, self, enemy)
        }
        if (cmds.length === 0) {
            this.emitLog({ type: 'system', message: BattleLog.plain(self.name, '没有行动'), actorId: self.id })
        }

        // endEvent
        // ── Buff onTurnEnd 钩子（不依赖命中） ──
        forEachBuffOf(this.state.pendingBuffs, self.id, (def, layer) => {
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
        })
        this.emit('turn_end', self, enemy)
        this.state.turn.next(self.id)

        // ── 4. 下次行动间隔 = AP 回复耗时（身法/haste 减 AP 消耗 → 回复更快 → 攻击频率更高） ──
        const remainingAp = self.ap
        const regenPerSec = calcEffectiveApRegenPerSec(this.state, self)
        const regenMs = Math.ceil(((self.maxAp - remainingAp) / regenPerSec) * 1000)
        // 下限 MIN_TURN_DELAY_MS：回合未消耗 AP（regenMs=0）时也保证正延迟，防止同刻无限重入队
        let totalDelay = Math.max(regenMs, MIN_TURN_DELAY_MS)
        // 没有执行任何指令时最低等待一个完整回复周期（防止死循环）
        if (cmds.length === 0) {
            totalDelay = Math.max(totalDelay, Math.ceil((self.maxAp / regenPerSec) * 1000))
        }

        // 原子回合：行动瞬间完成于本回合调度时刻
        self.lastActionEndMs = this.state.eventTime
        self.lastApUpdate = this.state.eventTime
        this.state.turn.scheduleNext({ type: 'character', id: self.id }, totalDelay)
        this.state.eventActorId = null
        return true
    }

    /** 触发检测：同一事件链每人每事件最多触发一次，scope 不受 emit 重置 */
    emit(event: TriggerEvent, self: Character, enemy: Character, buffId?: string) {
        if (!this.state.triggeredThisChain) this.state.triggeredThisChain = new Set()
        const key = `${self.id}:${event}`
        if (this.state.triggeredThisChain.has(key)) return
        if (this.state.isEmitting) {
            this.#deferredEmits.push({
                event,
                self,
                enemy,
                buffId,
                scope: [...this.state.log.scopePath],
            })
            return
        }
        const savedScope = [...this.state.log.scopePath]
        this.state.isEmitting = true
        this.state.triggeredThisChain.add(key)
        this.#processEmit(event, self, enemy, buffId)
        this.state.isEmitting = false

        while (this.#deferredEmits.length > 0) {
            const d = this.#deferredEmits.shift()!
            const dKey = `${d.self.id}:${d.event}`
            if (this.state.triggeredThisChain?.has(dKey)) continue
            this.state.triggeredThisChain?.add(dKey)
            this.state.log.restoreScope(d.scope)
            this.state.isEmitting = true
            this.#processEmit(d.event, d.self, d.enemy, d.buffId)
            this.state.isEmitting = false
        }
        this.state.triggeredThisChain = null
        this.state.log.restoreScope(savedScope)
    }

    #processEmit(event: TriggerEvent, self: Character, enemy: Character, buffId?: string) {
        const { moveDelta, position } = this.state
        const isInitPhase =
            event === 'battle_start' || event === 'turn_start' || event === 'on_equip' || event === 'turn_end'
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
                // 非招式触发效果：在招式自身作用域内处理（不新增 scope 层）
                for (const eff of slot.effects) {
                    processActionEffect(eff, { self, enemy, engine: this, tMs: this.#tMs })
                }
                continue
            }
            if (!slot.actionId) continue
            const action = getRuntimeAction(slot.actionId, self, this.state) ?? getBaseAction(slot.actionId)
            if (!action) continue
            // 触发器招式 AP 上限（防止高消耗大招白嫖）
            if (action.apCost > 2) continue
            const inst = self.actions.find((a) => a.id === slot.actionId)
            if (!inst || !inst.canUse()) continue

            if (action.target === 'self') {
                if (action.canUse && !action.canUse(self, this.state)) continue
                // 触发招式不扣 AP，但要扣缠劲（缠不足则本次触发作废）
                if (action.chanCost) {
                    if (self.chan < action.chanCost) continue
                    self.spendChan(action.chanCost)
                }
                if (!isInitPhase) this.state.log.enterReaction()
                for (const eff of action.effects ?? []) {
                    processActionEffect(eff, { self, enemy, engine: this, tMs: this.#tMs, action, triggered: true })
                }
                if (!isInitPhase) this.state.log.exitReaction()
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
                this.state.log.enterReaction()
                this.#executeAction(action, self, enemy, true)
                inst.use()
                this.emit('on_action_trigger', self, enemy)
                tickEngine.onBleedTrigger(self, this)
                this.state.log.exitReaction()
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
                return this.#executeSupport(cmd, self, enemy)
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

    /** 发射日志事件（自动附加当前快照；原子回合下回合内所有事件共享 eventTime，顺序由 scope 定） */
    emitLog(event: LogEvent): void {
        // 安静模式（批量模拟/比赛）：跳过快照与日志构建，大幅提速
        if (this.#quiet) return
        const snap = this.getSnapshot()
        const tMs = this.state.eventTime
        const enriched = { ...event, snapshot: snap }
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
                { self: char, enemy: char, engine: this, tMs: this.state.turn.currentTime },
            )
            const enemy = this.getOpponent(charId)
            if (enemy) this.emit('chan_overflow', char, enemy)
        } else if (curValue >= 30 && curValue < MAX_CHAN && !hasZhou) {
            processActionEffect(
                { type: 'add_buff', buffId: 'zhou', stacks: 1 },
                { self: char, enemy: char, engine: this, tMs: this.state.turn.currentTime },
            )
        } else if (curValue < 30 && hasZhou) {
            processActionEffect(
                { type: 'remove_buff', buffId: 'zhou' },
                { self: char, enemy: char, engine: this, tMs: this.state.turn.currentTime },
            )
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
        // 主移动也是主行动：需要独立 scope [回合,序号]（否则其反应 scope 长度=2 被 format-log 误判为主行动、开新块）
        this.state.log.beginMainAction()
        this.emitLog({
            type: 'move',
            sourceId: self.id,
            delta: actualDelta,
            newDistance: p.distance(self.id, enemy.id),
            apCost: ap,
            apRemaining: self.ap,
            durationMs: Math.max(1, calcActionDurationMs(Math.abs(cmd.bestDistance ?? 0))),
            kind: 'move',
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
        const action = inst?.def ?? (cmd.actionId ? getBaseAction(cmd.actionId) : undefined)
        if (!action) {
            this.emitLog({ type: 'system', message: BattleLog.plain(self.name, '没有可用招式'), actorId: self.id })
            return this.#emptyResult()
        }
        // 本体招式发出前事件（供对手反制，御物/触发招式不触发）
        this.emit('on_pre_action', enemy, self)
        const r = this.#executeAction(action, self, enemy)
        tickEngine.onBleedTrigger(self, this)
        return r
    }

    /** 统一招式执行（0 成本招式如御物召唤天然免费，不消耗 AP） */
    #executeAction(action: ActionDefinition, self: Character, enemy: Character, triggered = false): ActionResult {
        const r: ActionResult = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
        }
        // 验证（触发招式已在 #processEmit 中通过距离/标签/条件检查，且不消耗 AP）
        if (!triggered) {
            const c = canExecuteAction(action, self, this.state, this)
            if (!c.ok) return r
        }
        // 失心检查（不消耗 AP；失心 = 动作失败，本次出手作废）
        const fcKey = `fumble_chance_temp::${self.id}`
        const fcLayer = this.state.pendingBuffs.get(fcKey)
        if (fcLayer) {
            const fumbleRate = (fcLayer.extra?.fumbleRate as number | undefined) ?? fcLayer.restoreValue * 0.05
            if (Math.random() < fumbleRate) {
                this.emitLog({ type: 'fumble', sourceId: self.id })
                return r
            }
        }

        // 缠劲消耗独立于 AP 门槛：0 成本招式（restore_ap 等）与触发招式同样扣缠；缠不足则作废
        if (action.chanCost) {
            if (self.chan < action.chanCost) return r
            self.spendChan(action.chanCost)
        }
        let finalCost = action.apCost
        // 0 成本招式（御物召唤等）跳过 AP 消耗（onActionCost/身法减免/spendAp）
        if (!triggered && action.apCost > 0) {
            let cost = action.apCost
            forEachBuffOf(this.state.pendingBuffs, self.id, (def, layer) => {
                if (!def?.onActionCost) return
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
            })
            finalCost = self.actionApCost(cost)
            if (!self.spendAp(finalCost)) return r
        }
        // 消耗限次招式
        const inst = self.actions.find((a) => a.id === action.id)
        if (inst && inst.def.maxUses !== undefined) inst.use()
        this.checkChanOverflow(self.id)

        // 主招式（非触发）：开一个新的主招式作用域（level1 递增）
        if (!triggered) this.state.log.beginMainAction()
        const weapon = getWeapon(self.build.weapon)
        // 召唤物攻击的招式仍用招式名（一剑西来），summonName 仅用于让召唤物回合单独归块（不与主人动作粘一起）
        const isWeaponSummon = weapon.summon?.actionId === action.id
        const artSummon = self.artifactDefs.find((a) => a.summon?.actionId === action.id)
        const summonName = isWeaponSummon ? weapon.summon?.name : artSummon ? artSummon.summon?.name : undefined
        this.emitLog({
            type: 'attack_start',
            actionId: action.id,
            actionName: action.name,
            weapon: weapon.name,
            sourceId: self.id,
            targetId: enemy.id,
            apCost: finalCost,
            apRemaining: self.ap,
            triggered,
            summonName,
        })
        // buff onAction 钩子（出招即触发，不受命中影响）——前摇窗口内
        forEachBuffOf(this.state.pendingBuffs, self.id, (def, layer) => {
            if (!def?.onAction) return
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
        })
        // 不受命中影响的效果先执行（移动、换武、buff 等）——前摇窗口内（short_dash 冲刺占用前摇）
        for (const eff of action.effects ?? []) {
            if (isPreHitEffect(eff.type)) {
                processActionEffect(eff, { self, enemy, engine: this, tMs: this.#tMs, action, triggered })
            }
        }
        // 战斗判定
        if (!processHitCheck(action, r, self, enemy, this)) return r
        // 效果应用
        this.#finalizeAttack(action, r, self, enemy, triggered)
        // 天机消耗已由 tianji_ready 自身 onCritical 钩子处理（必中必暴→必然暴击→结算后自删+重置玄机）
        return r
    }

    /** 命中后效：触发/流血/状态/击败 */
    #finalizeAttack(
        action: ActionDefinition,
        r: ActionResult,
        self: Character,
        enemy: Character,
        triggered = false,
    ): void {
        const tMs = this.#tMs
        // 召唤物攻击不触发被命中反应（on_was_hit，如疾风迅雷的雷闪反击）
        // 以招式 summon tag 判定（所有召唤招式均带该 tag，覆盖武器/奇物/未来新增）
        const isSummonAttack = action.tags.includes('summon')

        // 效果在招式自身作用域处理（不新增 scope 层；渲染层按 scope 深度 +1 缩进效果行）
        const ignoresParry = action.effects?.some((e) => e.type === 'ignore_parry')
        for (const eff of action.effects ?? []) {
            if (
                (eff.type === 'add_debuff' || eff.type === 'damage' || eff.type === 'fixed_damage') &&
                r.hit &&
                (ignoresParry || !r.dodged)
            ) {
                processActionEffect(eff, { self, enemy, engine: this, tMs, action, triggered })
            } else if (r.hit && !r.dodged && !isPreHitEffect(eff.type)) {
                processActionEffect(eff, { self, enemy, engine: this, tMs, action, triggered })
            }
        }
        // 立即击败检测：先于所有触发器，防止死亡后继续触发
        if (!enemy.isAlive()) {
            this.emitLog({ type: 'defeat', loserId: enemy.id, winnerId: self.id })
            this.state.phase = 'finished'
            if (self.isAlive()) this.state.lastWinner = self.name
            return
        }
        if (!self.isAlive()) {
            this.emitLog({ type: 'defeat', loserId: self.id, winnerId: enemy.id })
            this.state.phase = 'finished'
            if (enemy.isAlive()) this.state.lastWinner = enemy.name
            return
        }

        this.emit('on_hit', self, enemy)
        // 召唤物攻击命中 → 专用触发事件（御物流专属，避免 on_hit 被玩家滥用太 op）
        if (isSummonAttack) this.emit('on_summon_hit', self, enemy)
        // 召唤物攻击不触发被命中反应
        if (!isSummonAttack) this.emit('on_was_hit', enemy, self)
        // 按攻击方招式 tag 命中触发
        if (action.tags.includes('melee')) this.emit('on_melee', enemy, self)
        if (action.tags.includes('range')) this.emit('on_range', enemy, self)
        if (action.tags.includes('unarmed')) this.emit('on_unarmed', enemy, self)
        if (action.tags.includes('polearm')) this.emit('on_polearm', enemy, self)
        tickEngine.onBleedTrigger(enemy, this)
        // HP 阈值触发检测
        this.emit('hp_below', self, enemy)
        this.emit('hp_below', enemy, self)
    }

    #executeSupport(cmd: ActionCommand, self: Character, enemy: Character): ActionResult {
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
        // 缠劲不足的辅助招不释放（不扣 AP、不扣缠劲）
        if (inst.def.chanCost && self.chan < inst.def.chanCost) return r
        if (!self.spendAp(self.actionApCost(inst.apCost))) {
            return r
        }
        inst.use()
        if (inst.def.chanCost) self.spendChan(inst.def.chanCost)
        this.checkChanOverflow(self.id)
        // 纯位移型 support（如虎跃）：本质是位移，不发 support 日志（由 dash effect 发 move(kind:'dash') 日志），
        // 也不建主招 scope（让 move 保持回合级块内行），format-log 渲染为 `@ 虎跃 旧→新m`
        const isDashOnly = (inst.def.effects ?? []).every((e) => e.type === 'dash')
        if (!isDashOnly) {
            // 辅助招式也算主招式作用域
            this.state.log.beginMainAction()
            this.emitLog({
                type: 'support',
                actionId: inst.id,
                actionName: inst.name,
                sourceId: self.id,
                targetId: self.id,
                apCost: self.actionApCost(inst.apCost),
            })
        }
        for (const eff of inst.def.effects ?? []) {
            processActionEffect(eff, { self, enemy, engine: this, tMs: this.#tMs, action: inst.def })
        }
        return r
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
            summonAction = weapon.summon.action ?? getBaseAction(weapon.summon.actionId)
        }
        // 再找奇物召唤物 action
        if (!summonAction) {
            for (const art of owner.artifactDefs) {
                if (art.summon && art.summon.actionId === inst.actionId) {
                    summonAction = art.summon.action ?? getBaseAction(art.summon.actionId)
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

        // 召唤物免费：apCost=0 不消耗主人 AP（御物武器已通过占用 AP 上限换取免费），纯按 calcSummonInterval 定时开火
        this.#executeAction(summonAction, owner, enemy)
        this.state.turn.next(e.id)
        // 御物加速：遍历主人 buff 的 onSummonInterval 钩子，累乘前后摇乘数（不硬编码 buff id）
        let hasteMult = 1
        forEachBuffOf(this.state.pendingBuffs, owner.id, (def, layer) => {
            if (!def?.onSummonInterval) return
            hasteMult *= def.onSummonInterval({
                final: 0,
                raw: 0,
                attacker: owner,
                target: enemy,
                engine: this,
                state: this.state,
                layer,
            })
        })
        const interval = calcSummonInterval(
            owner.attrs.get('wisdom'),
            summonAction.extraPreDelay ?? 0,
            summonAction.extraStunTime ?? 0,
            hasteMult,
        )
        this.state.turn.scheduleNext({ type: 'summon', id: e.id, ownerId: e.ownerId }, interval)
        return true
    }

    /** 处理系统事件（buff 到期、status tick 等） */
    #handleSystemEvent(systemEventType: string, eventId: string, nextActionAt: number): void {
        if (!systemEventType) return

        switch (systemEventType) {
            case 'buff_end':
                this.#handleBuffEnd(eventId)
                break
            case 'tick_poison':
            case 'tick_burn':
                this.#handleBuffTick(eventId, systemEventType as 'tick_poison' | 'tick_burn', nextActionAt)
                break
            case 'stun_reset': {
                const charId = eventId.slice('stun_reset_'.length)
                this.#buffs.delete(`stun_track::${charId}`)
                break
            }
            case 'fumble_reset': {
                const charId = eventId.slice('fumble_reset_'.length)
                this.#buffs.delete(`fumble_track::${charId}`)
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
                            type: 'heal_over_time',
                            actionId: buffDef.id,
                            actionName: buffDef.name,
                            sourceId: char.id,
                            targetId: char.id,
                            amount: amt,
                        })
                        // 通知所有 buff 持有者收到治疗
                        forEachBuffOf(this.state.pendingBuffs, char.id, (def, layer) => {
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
                        })
                    }
                }
                if (this.state.pendingBuffs.has(key)) {
                    this.state.turn.scheduleSystemEventAt(
                        eventId,
                        nextActionAt + (buffDef.tickInterval ?? 1000),
                        'tick_buff',
                    )
                }
                break
            }
            case 'regen_tick': {
                const charId = eventId.slice('regen_tick_'.length)
                const char = this.getCharacter(charId)
                if (!char || !char.isAlive()) break
                const extraAp = calcExtraApRegenPerSec(this.state, char)
                if (extraAp !== 0) {
                    char.ap = Math.max(0, Math.min(char.maxAp, char.ap + Math.round(extraAp * 10) / 10))
                    if (extraAp > 0) {
                        this.emitLog({
                            type: 'system',
                            message: `[内息回复] ${char.name} AP +${Math.round(extraAp * 10) / 10}`,
                            actorId: charId,
                        })
                    }
                }
                const chanRegen = calcEffectiveChanRegenPerSec(this.state, char)
                if (chanRegen > 0) {
                    char.addChan(chanRegen)
                    this.emitLog({
                        type: 'system',
                        message: `[缠劲回复] ${char.name} 缠劲+${Math.round(chanRegen * 10) / 10}（${char.chan}层）`,
                        actorId: charId,
                    })
                }
                if (this.state.phase === 'fighting') {
                    this.state.turn.scheduleSystemEventAt(eventId, nextActionAt + 1000, 'regen_tick')
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

        // 无论是否继续 tick，先清理残留事件
        turn.removeEvents(eventId)

        if (type === 'tick_poison') {
            const { nextInterval } = tickEngine.onPoisonTick(charId, this)
            if (nextInterval > 0) {
                turn.scheduleSystemEventAt(eventId, eventTime + nextInterval, 'tick_poison')
            }
        } else {
            const { nextInterval } = tickEngine.onBurnTick(charId, this)
            if (nextInterval > 0) {
                turn.scheduleSystemEventAt(eventId, eventTime + nextInterval, 'tick_burn')
            }
        }
    }
}
