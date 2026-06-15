import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import { getWeapon } from '../data/weapons'
import { BASE_PRE_DELAY, BASE_STUN_TIME, calcTurnInterval, calcSummonInterval } from '../calc/damage'
import { canExecuteAction } from '../calc/action-executor'
import { getAction } from '../data/actions'
import { getBuff } from '../data/buffs'
import type { ActionDefinition } from '../entities/action'
import type { TriggerEvent } from '../entities/trigger'
import { matchCondition } from './trigger-system'
import { processActionEffect, processStatusTick, processHitCheck, processBleedDamage, processBuffEnd } from './effects'
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
import type { SummonInstance } from '../entities/summon'
import type { LogEvent } from './log-events'

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
        // 初始起手延迟由身法决定：身法越高，起手越快
        tm.addCharacter(p, Math.round(calcTurnInterval(p.attrs.get('agility')) * 0.4))
        tm.addCharacter(o, Math.round(calcTurnInterval(o.attrs.get('agility')) * 0.4))
        this.state = {
            phase: 'fighting',
            characters: [p, o],
            distance: new DistanceSystem(d),
            turn: tm,
            log,
            eventActorId: null,
            eventTime: 0,
            triggerUses: new Map(),
            pendingBuffs: new Map(),
            actionCount: 0,
            lastActionExtraDelay: 0,
            lastActionExtraStun: 0,
            isEmitting: false,
            moveDelta: 0,
            triggeredThisChain: null,
        }
        log.logBattleStart(p.name, o.name, 0, this.getSnapshot())
        this.emit('battle_start', p, o)
        this.emit('battle_start', o, p)

        // 创建召唤物
        this.#initSummons(p)
        this.#initSummons(o)
    }

    /** 为角色创建召唤物（已存在则跳过） */
    #initSummons(self: Character): void {
        const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
        if (!weapon.summon) return
        const sd = weapon.summon
        const action = sd.action ?? getAction(sd.actionId)
        const preDelay = action?.extraPreDelay ?? 0
        for (let i = 0; i < sd.maxCount; i++) {
            const sid = `${sd.id}_${self.id}_${i}`
            if (this.state.turn.entries.some((e) => e.id === sid)) continue
            const inst: SummonInstance = {
                id: sid,
                ownerId: self.id,
                index: i,
            }
            this.#summons.set(sid, inst)
            this.state.turn.addSummon(sid, self.id, i * preDelay)
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
        const { characters, distance, turn, triggerUses, pendingBuffs, phase } = this.state
        return {
            time: turn.currentTime,
            phase,
            distance: distance.current,
            characters: [
                {
                    id: characters[0].id,
                    name: characters[0].name,
                    hp: characters[0].hp,
                    maxHp: characters[0].maxHp,
                    ap: characters[0].ap,
                    buffs: this.getBuffs(characters[0].id),
                },
                {
                    id: characters[1].id,
                    name: characters[1].name,
                    hp: characters[1].hp,
                    maxHp: characters[1].maxHp,
                    ap: characters[1].ap,
                    buffs: this.getBuffs(characters[1].id),
                },
            ],
            turn: { time: turn.currentTime, queue: [...turn.entries] },
            triggerUses: [...triggerUses.entries()],
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

        // 系统事件
        if (e.type === 'system') {
            this.#handleSystemEvent()
            this.state.turn.next()
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
        self.resetAp()
        enemy.resetAp()

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

        this.emit('turn_start', self, enemy)
        // 重建召唤物（法球等每回合重新入队）
        this.#initSummons(self)

        const cmds = planFn(self, enemy, this.state)
        for (const cmd of cmds) {
            if (self.ap <= 0 && cmd.type !== 'bonus') break
            this.execute(cmd, self, enemy)
        }

        // endEvent
        // 不二剑衰减
        if (self.critDamageMod > 0) {
            self.critDamageMod = Math.max(0, Math.round((self.critDamageMod - 0.05) * 100) / 100)
        }
        self.critChance = Math.max(0, Math.round((self.critChance - 0.05) * 100) / 100)
        self.dodgeMod = Math.min(0.2, Math.round((self.dodgeMod + 0.04) * 100) / 100)
        this.emit('turn_end', self, enemy)
        this.state.turn.next()
        const lastAction = this.state.lastActionExtraDelay ?? 0
        const extraStun = this.state.lastActionExtraStun ?? 0
        const preDelay = BASE_PRE_DELAY + lastAction
        const stunTime = BASE_STUN_TIME + extraStun
        this.state.lastActionExtraStun = 0
        this.state.turn.scheduleNext(
            { type: 'character', id: self.id, preDelay, stunTime, haste: self.haste },
            calcTurnInterval(self.attrs.get('agility'), lastAction, extraStun) - self.haste,
        )
        this.state.lastActionExtraDelay = 0
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
            this.state.log.indentDepth = d.indent
            this.state.isEmitting = true
            this.#processEmit(d.event, d.self, d.enemy, d.buffId)
            this.state.isEmitting = false
        }
        this.state.triggeredThisChain = null
        this.state.log.indentDepth = savedIndent
    }

    #processEmit(event: TriggerEvent, self: Character, enemy: Character, buffId?: string) {
        const { triggerUses, distance, moveDelta } = this.state
        for (const slot of self.triggers) {
            if (slot.condition.type !== event) continue
            if (slot.condition.buffId && slot.condition.buffId !== buffId) continue
            if (!matchCondition(slot.condition, { actor: self, distance: distance.current, moveDelta, engine: this }))
                continue

            if (slot.effects) {
                for (const eff of slot.effects) {
                    processActionEffect(eff, self, enemy, this, this.#tMs)
                }
                continue
            }
            if (!slot.actionId) continue
            const action = getAction(slot.actionId)
            if (!action) continue
            const used = triggerUses.get(slot.actionId) ?? 0
            if (action.maxUses !== undefined && used >= action.maxUses) continue
            triggerUses.set(slot.actionId, used + 1)

            if (action.target === 'self') {
                for (const eff of action.effects ?? []) {
                    processActionEffect(eff, self, enemy, this, this.#tMs, action)
                }
            } else {
                this.state.log.indentDepth++
                this.#executeAction(action, self, enemy, true)
                this.state.log.indentDepth--
                processBleedDamage(self, this.#tMs, this)
            }
        }
    }

    private execute(cmd: ActionCommand, self: Character, enemy: Character): ActionResult {
        switch (cmd.type) {
            case 'move':
                return this.#executeMove(cmd, self)
            case 'attack':
                return this.#executeAttack(cmd, self, enemy)
            case 'bonus':
                return this.#executeBonus(cmd, self)
        }
    }

    /** 快捷访问 */
    get #tMs(): number {
        return this.state.turn.peek()?.nextActionAt ?? 0
    }
    get #currentTime(): number {
        return this.state.turn.currentTime
    }
    get #buffs(): Map<string, BuffLayer> {
        return this.state.pendingBuffs
    }

    /** 注册日志监听器 */
    onLog(listener: LogListener): void {
        this.#logListeners.push(listener)
    }

    /** 发射日志事件（自动附加当前快照） */
    emitLog(event: LogEvent): void {
        const snap = this.getSnapshot()
        const tMs = this.state.eventTime
        const enriched = { ...event, snapshot: snap } as LogEvent & { snapshot: BattleSnapshot }
        this.state.log.handleLogEvent(enriched, snap, tMs)
        for (const l of this.#logListeners) l(enriched)
    }

    getCharacter(id: string): Character | undefined {
        return this.state.characters.find((c) => c.id === id)
    }

    getOpponent(id: string): Character | undefined {
        return this.state.characters.find((c) => c.id !== id)
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
        const { distance } = this.state
        const r: ActionResult = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
        }
        const { ap, delta } = DistanceSystem.calcMovement(
            cmd.bestDistance ?? 0,
            self.attrs.get('agility'),
            1 + self.moveEfficiency,
            this.state.pendingBuffs.has(`min_move_cost::${self.id}`),
        )
        if (!self.spendAp(ap)) {
            this.emitLog({ type: 'system', message: BattleLog.plain(self.name, 'AP不足 无法移动'), actorId: self.id })
            return r
        }
        const a = distance.move(delta)
        r.distanceDelta = a
        this.emitLog({
            type: 'move',
            sourceId: self.id,
            delta: a,
            newDistance: distance.current,
            apCost: ap,
            apRemaining: self.ap,
        })
        const enemy = this.getOpponent(self.id)!
        this.emit('on_move', self, enemy)
        this.state.moveDelta = a
        this.emit('on_opponent_move', enemy, self)
        this.state.moveDelta = 0
        processBleedDamage(self, this.#tMs, this)
        return r
    }

    #executeAttack(cmd: ActionCommand, self: Character, enemy: Character): ActionResult {
        const action = cmd.actionId ? getAction(cmd.actionId) : undefined
        if (!action) {
            this.emitLog({ type: 'system', message: BattleLog.plain(self.name, '没有可用招式'), actorId: self.id })
            return this.#emptyResult()
        }
        // 本体招式发出前事件（供对手反制，御物/触发招式不触发）
        this.state.lastActionExtraDelay = action.extraPreDelay ?? 0
        this.state.lastActionExtraStun = action.extraStunTime ?? 0
        this.emit('on_pre_action', enemy, self)
        const r = this.#executeAction(action, self, enemy)
        this.#tryBonus(self, 'after_main')
        processBleedDamage(self, this.#tMs, this)
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
        // 失心检查
        if (self.fumbleChance > 0 && Math.random() < self.fumbleChance) {
            this.emitLog({ type: 'fumble', sourceId: self.id })
            return r
        }
        // 验证
        const c = canExecuteAction(action, self, this.state)
        if (!c.ok) return r
        if (!self.spendAp(action.apCost)) {
            return r
        }
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
        // 移动/跳跃类效果先执行（不受战斗判定影响）
        for (const eff of action.effects ?? []) {
            if (eff.type === 'dash' || eff.type === 'knockback') {
                processActionEffect(eff, self, enemy, this, this.#tMs, action)
            }
        }
        // 战斗判定
        if (!processHitCheck(action, r, self, enemy, this)) return r
        // 效果应用
        this.#finalizeAttack(action, r, self, enemy)
        return r
    }

    /** 命中后效：触发/流血/状态/击败 */
    #finalizeAttack(action: ActionDefinition, r: ActionResult, self: Character, enemy: Character): void {
        const tMs = this.#tMs

        this.emit('on_hit', self, enemy)
        this.emit('on_was_hit', enemy, self)

        this.state.log.indentDepth++
        for (const eff of action.effects ?? []) {
            if ((eff.type === 'status' || eff.type === 'damage' || eff.type === 'fixed_damage') && r.hit && !r.dodged) {
                processActionEffect(eff, self, enemy, this, tMs, action)
            } else if (eff.type === 'remove_buff' || eff.type === 'add_buff' || eff.type === 'switch_weapon') {
                // 这些效果不受命中影响（丢刀、换武、清势等）
                processActionEffect(eff, self, enemy, this, tMs, action)
            } else if (r.hit && !r.dodged && eff.type !== 'dash' && eff.type !== 'knockback') {
                processActionEffect(eff, self, enemy, this, tMs, action)
            }
        }
        this.state.log.indentDepth--
        processBleedDamage(enemy, tMs, this)
        // HP 阈值触发检测
        this.emit('hp_below', self, enemy)
        this.emit('hp_below', enemy, self)
        if (!enemy.isAlive()) {
            this.emitLog({ type: 'defeat', loserId: enemy.name, winnerId: self.name })
            this.state.phase = 'finished'
            if (self.isAlive()) {
                this.state.lastWinner = self.name
            }
        }
    }

    #executeBonus(cmd: ActionCommand, self: Character): ActionResult {
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
        if (!inst || !inst.def.tags.includes('support') || !inst.canUse()) return r
        if (!self.spendAp(inst.apCost)) return r
        inst.use()
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
        if (!inst) return false

        const owner = this.getCharacter(e.ownerId)
        const enemy = this.getOpponent(e.ownerId)
        if (!owner || !enemy) return false

        const weapon = owner.weaponDef ?? getWeapon(owner.build.weapon)
        const summonAction = weapon.summon?.action ?? (weapon.summon ? getAction(weapon.summon.actionId) : undefined)
        if (!summonAction) return false

        this.#executeAction(summonAction, owner, enemy)
        this.state.turn.next()
        const interval = calcSummonInterval(
            owner.attrs.get('wisdom'),
            summonAction.extraPreDelay ?? 0,
            summonAction.extraStunTime ?? 0,
        )
        this.state.turn.scheduleNext({ type: 'summon', id: e.id, ownerId: e.ownerId }, interval)
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
                this.#handleStatusTick(eventId, e.systemEventType)
                break
            case 'stun_reset': {
                const charId = eventId.slice('stun_reset_'.length)
                this.#buffs.delete(`stun_track::${charId}`)
                break
            }
            case 'permanent_burn': {
                const charId = eventId.slice('permanent_burn_'.length)
                const char = this.getCharacter(charId)
                if (!char || this.state.pendingBuffs.has(`elemental_immunity::${char.id}`)) break
                const dmg = getBuff('permanent_burn')?.dotDamage ?? 1
                char.takeDamage(dmg)
                this.state.log.logSystem(
                    BattleLog.msg('过热', char.name, `受到 ${dmg.toFixed(1)} 点过热伤害`),
                    this.#currentTime,
                    this.getSnapshot(),
                )
                const bi = getBuff('permanent_burn')?.tickInterval ?? 3000
                this.state.turn.scheduleSystemEventAt(eventId, this.#currentTime + bi, 'permanent_burn')
                break
            }
            case 'tick_buff': {
                const key = eventId.slice('tick_buff_'.length)
                const [buffId, charId] = key.split('::')
                const buffDef = getBuff(buffId)
                const char = this.getCharacter(charId)
                if (!char || !char.isAlive() || !buffDef) break
                if (buffDef.dotDamage) {
                    char.takeDamage(buffDef.dotDamage)
                    this.emitLog({
                        type: 'damage_over_time',
                        sourceId: charId,
                        targetId: charId,
                        amount: buffDef.dotDamage,
                        status: buffDef.name,
                    })
                }
                if (buffDef.tickHeal) {
                    const amt = buffDef.tickHeal === 1 ? Math.round(char.maxHp * 0.01) : buffDef.tickHeal
                    char.heal(amt)
                    this.emitLog({ type: 'heal', sourceId: char.id, targetId: char.id, amount: amt })
                }
                if (this.state.pendingBuffs.has(`${buffId}::${charId}`)) {
                    this.state.turn.scheduleSystemEventAt(
                        eventId,
                        this.#currentTime + (buffDef.tickInterval ?? 1000),
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

    /** status tick（毒/灼烧） */
    #handleStatusTick(eventId: string, type: 'tick_poison' | 'tick_burn'): void {
        const { turn } = this.state
        const tMs = this.#currentTime
        const statusType = type === 'tick_poison' ? 'poison' : 'burn'
        const charId = eventId.slice(`tick_${statusType}_`.length)
        const char = this.getCharacter(charId)
        if (!char) return
        const entry = this.state.pendingBuffs.get(`${statusType}::${charId}`)
        if (!entry) return
        const { nextInterval } = processStatusTick(charId, char, this, tMs, statusType)
        if (nextInterval > 0) {
            turn.scheduleSystemEventAt(eventId, tMs + nextInterval, type)
        }
    }

    /** 辅招触发 */
    #tryBonus(self: Character, timing: TriggerEvent, mainAp = 0): boolean {
        let fired = false
        for (const inst of self.actions) {
            if (!inst.def.tags.includes('support') || inst.def.bonusTiming?.type !== timing) continue
            if (!inst.canUse()) continue
            if (inst.def.canUse && !inst.def.canUse(self, this.state)) continue
            if (self.ap < inst.apCost + mainAp) continue
            if (!inst.canUse()) continue
            if (inst.def.canUse && !inst.def.canUse(self, this.state)) continue
            if (self.ap < inst.apCost + mainAp) continue
            self.spendAp(inst.apCost)
            inst.use()
            if (timing === 'after_main' || timing === 'before_main') {
                this.state.log.indentDepth++
            }
            this.emitLog({
                type: 'attack_start',
                actionId: inst.id,
                actionName: inst.name,
                weapon: getWeapon(self.build.weapon).name,
                sourceId: self.id,
                targetId: self.id,
                apCost: inst.apCost,
                apRemaining: self.ap,
                triggered: true,
                bonus: true,
                indent: this.state.log.indentDepth,
            })
            for (const eff of inst.def.effects ?? []) {
                processActionEffect(eff, self, self, this, this.#tMs, inst.def)
            }
            if (timing === 'after_main' || timing === 'before_main') {
                this.state.log.indentDepth--
            }
            fired = true
        }
        return fired
    }
}
