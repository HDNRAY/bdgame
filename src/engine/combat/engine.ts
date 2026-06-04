import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import { getWeapon } from '../data/weapons'
import { BASE_PRE_DELAY, BASE_STUN_TIME, calcTurnInterval, calcSummonInterval } from '../calc/damage'
import { canExecuteAction } from '../calc/action-executor'
import { getAction } from '../data/actions'
import type { ActionDefinition } from '../entities/action'
import type { TriggerEvent } from '../entities/trigger'
import { matchCondition } from './trigger-system'
import {
    processActionEffect,
    processStatusTick,
    processCombatRolls,
    processBleedDamage,
    processBuffEnd,
} from './effect-processor'
import type { ActionCommand, ActionResult, BattleState, EventPlan, BattleSnapshot, TurnEntry } from './types'
import type { SummonInstance } from '../entities/summon'

export class BattleEngine {
    state!: BattleState
    #summons = new Map<string, SummonInstance>()

    constructor(p: Character, o: Character, d = 4) {
        this.init(p, o, d)
    }

    /** 战斗开始 */
    init(p: Character, o: Character, d = 4): void {
        p.resetAp()
        o.resetAp()
        const log = new BattleLog()
        const tm = new TurnManager()
        tm.addCharacter(p, 0)
        tm.addCharacter(o, 0)
        this.state = {
            phase: 'fighting',
            characters: [p, o],
            distance: new DistanceSystem(d),
            turn: tm,
            log,
            eventActorId: null,
            triggerUses: new Map(),
            pendingBuffs: new Map(),
            actionCount: 0,
            lastActionExtraDelay: 0,
            isEmitting: false,
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
        const weapon = getWeapon(self.build.weapon)
        if (!weapon.summon) return
        const sd = weapon.summon
        const action = getAction(sd.actionId)
        const preDelay = action?.extraPreDelay ?? 0
        for (let i = 0; i < sd.maxCount; i++) {
            const sid = `${sd.id}_${self.id}_${i}`
            if (this.state.turn.entries.some((e) => e.id === sid)) continue
            const inst: SummonInstance = {
                id: sid,
                ownerId: self.id,
                actionId: sd.actionId,
                index: i,
            }
            this.#summons.set(sid, inst)
            this.state.turn.addSummon(sid, self.id, i * preDelay)
        }
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
                    hp: characters[0].hp,
                    maxHp: characters[0].maxHp,
                    ap: characters[0].ap,
                },
                {
                    hp: characters[1].hp,
                    maxHp: characters[1].maxHp,
                    ap: characters[1].ap,
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

        // 系统事件
        if (e.type === 'system') {
            this.#handleSystemEvent()
            this.state.turn.next()
            this.state.eventActorId = null
            return true
        }

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
        this.state.actionCount++

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

        // 跳过行动检查（如眩晕停止走表）
        const stunEntry = this.state.pendingBuffs.get(`stun::${self.id}`)
        if (stunEntry?.extra?.skipTurn) {
            this.#log.logSystem(`${self.name} 被眩晕，停止走表`, e.nextActionAt, this.getSnapshot())
            this.state.pendingBuffs.delete(`stun::${self.id}`)
            const delay = (stunEntry.extra.rescheduleDelay as number) ?? 2000
            this.state.turn.next()
            this.state.turn.scheduleNext({ type: 'character', id: self.id }, delay)
            this.state.eventActorId = null
            return true
        }

        this.emit('turn_start', self, enemy)
        this.#tryBonus(self, 'turn_start')
        // 重建召唤物（法球等每回合重新入队）
        this.#initSummons(self)

        const cmds = planFn(self, enemy, this.state)
        for (const cmd of cmds) {
            if (self.ap <= 0 && cmd.type !== 'bonus') break
            this.execute(cmd, self, enemy)
        }

        // endEvent
        this.#tryBonus(self, 'before_turn_end')
        this.emit('turn_end', self, enemy)
        this.state.turn.next()
        const lastAction = this.state.lastActionExtraDelay ?? 0
        const preDelay = BASE_PRE_DELAY + lastAction
        const stunTime = BASE_STUN_TIME
        this.state.turn.scheduleNext(
            { type: 'character', id: self.id, preDelay, stunTime },
            calcTurnInterval(self.attrs.get('agility'), lastAction),
        )
        this.state.lastActionExtraDelay = 0
        this.state.eventActorId = null
        return true
    }

    /** 触发检测 */
    emit(event: TriggerEvent, self: Character, enemy: Character) {
        const { log, triggerUses, distance } = this.state
        if (this.state.isEmitting) return // 防止递归触发
        this.state.isEmitting = true
        for (const slot of self.triggers) {
            if (slot.condition.type !== event) continue
            if (!matchCondition(slot.condition, { actor: self, distance: distance.current })) continue

            const action = getAction(slot.actionId)
            if (!action) continue
            const used = triggerUses.get(slot.actionId) ?? 0
            if (action.maxUses !== undefined && used >= action.maxUses) continue
            triggerUses.set(slot.actionId, used + 1)

            log.indentDepth++
            if (action.target === 'self') {
                for (const eff of action.effects ?? []) {
                    processActionEffect(eff, self, enemy, this, this.#tMs, action.name, action.id)
                }
            } else {
                this.#executeAction(action, self, enemy, true)
            }
            log.indentDepth--
        }
        this.state.isEmitting = false
    }

    private execute(cmd: ActionCommand, self: Character, enemy: Character): ActionResult {
        switch (cmd.type) {
            case 'move':
                return this.#executeMove(cmd, self)
            case 'attack':
                return this.#executeAttack(cmd, self, enemy)
            case 'defend':
                return this.#executeDefend(self)
            case 'bonus':
                return this.#executeBonus(cmd, self)
            case 'wait':
                return this.#executeWait(self)
        }
    }

    /** 快捷访问 */
    get #tMs(): number {
        return this.state.turn.peek()?.nextActionAt ?? 0
    }
    get #currentTime(): number {
        return this.state.turn.currentTime
    }
    get #buffs(): Map<string, { restoreValue: number; stat: string }> {
        return this.state.pendingBuffs
    }
    get #log(): BattleLog {
        return this.state.log
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
            knockbackDistance: 0,
        }
    }

    #executeMove(cmd: ActionCommand, self: Character): ActionResult {
        const { distance, log } = this.state
        const r: ActionResult = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
            knockbackDistance: 0,
        }
        const { ap, delta } = DistanceSystem.calcMovement(cmd.bestDistance ?? 0, self.attrs.get('agility'))
        if (!self.spendAp(ap)) {
            log.logSystem(`${self.name} AP不足 无法移动`, this.#tMs, this.getSnapshot())
            return r
        }
        const a = distance.move(delta)
        r.distanceDelta = a
        log.logMove(self.name, a, distance.current, ap, self.ap, this.#tMs, this.getSnapshot())
        processBleedDamage(self, this.#tMs, this)
        const enemy = this.getOpponent(self.id)!
        this.emit('on_move', self, enemy)
        this.emit('on_move', enemy, self)
        return r
    }

    #executeAttack(cmd: ActionCommand, self: Character, enemy: Character): ActionResult {
        const action = cmd.actionId ? getAction(cmd.actionId) : undefined
        if (!action) {
            this.#log.logSystem(`${self.name} 没有可用招式`, this.#tMs, this.getSnapshot())
            return this.#emptyResult()
        }
        return this.#executeAction(action, self, enemy)
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
            knockbackDistance: 0,
        }
        // 验证
        const c = canExecuteAction(action, self, this.state.distance.current)
        if (!c.ok) return r
        if (!self.spendAp(action.apCost)) {
            return r
        }
        const weapon = getWeapon(self.build.weapon)
        this.state.log.logAttack(
            self.name,
            enemy.name,
            weapon.name,
            action.apCost,
            self.ap,
            this.#tMs,
            this.getSnapshot(),
            triggered ? `[触发]${action.name}` : action.name,
            this.state.log.indentDepth,
        )
        this.state.lastActionExtraDelay = action.extraPreDelay ?? 0
        // 攻击者自身流血
        processBleedDamage(self, this.#tMs, this)
        // 战斗判定
        if (!processCombatRolls(action, r, self, enemy, this.#tMs, this)) return r
        // 效果应用
        this.#finalizeAttack(action, r, self, enemy)
        return r
    }

    /** 命中后效：触发/流血/状态/击败 */
    #finalizeAttack(action: ActionDefinition, r: ActionResult, self: Character, enemy: Character): void {
        const log = this.state.log
        const tMs = this.#tMs

        this.emit('on_hit', self, enemy)
        this.emit('on_take_damage', enemy, self)
        this.#tryBonus(self, 'on_hit')
        this.#tryBonus(enemy, 'on_take_damage')

        this.state.log.indentDepth++
        for (const eff of action.effects ?? []) {
            if ((eff.type === 'status' || eff.type === 'damage' || eff.type === 'fixed_damage') && r.hit && !r.dodged) {
                processActionEffect(eff, self, enemy, this, tMs, action.name, action.id)
            } else if (r.hit && !r.dodged) {
                processActionEffect(eff, self, enemy, this, tMs, action.name, action.id)
            }
        }
        this.state.log.indentDepth--
        processBleedDamage(enemy, tMs, this)
        if (r.knockbackDistance > 0) {
            processActionEffect(
                { type: 'knockback', distance: r.knockbackDistance },
                self,
                enemy,
                this,
                tMs,
                action.name,
                action.id,
            )
        }
        if (!enemy.isAlive()) {
            log.logDefeat(enemy.name, self.name, tMs, this.getSnapshot())
            this.state.phase = 'finished'
            if (self.isAlive()) {
                this.state.lastWinner = self.name
            }
        }
    }

    #executeDefend(self: Character): ActionResult {
        this.#log.logSystem(`${self.name} 防御`, this.#tMs, this.getSnapshot())
        return {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
            knockbackDistance: 0,
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
        const inst = self.moves.find((a) => a.id === cmd.actionId)
        if (!inst || !inst.def.bonus || !inst.canUse()) return r
        if (!self.spendAp(inst.apCost)) return r
        inst.use()
        for (const eff of inst.def.effects ?? []) {
            processActionEffect(eff, self, self, this, this.#tMs, inst.name, inst.id)
        }
        return r
    }

    #executeWait(self: Character): ActionResult {
        this.#log.logSystem(`${self.name} 结束`, this.#tMs, this.getSnapshot())
        return {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
            knockbackDistance: 0,
        }
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

        const action = getAction(inst.actionId)
        if (!action) return false

        this.#executeAction(action, owner, enemy)
        this.state.turn.next()
        const interval = calcSummonInterval(
            owner.attrs.get('wisdom'),
            action.extraPreDelay ?? 0,
            action.extraStunTime ?? 0,
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
                this.#buffs.delete(`stun_track_${charId}`)
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
        for (const inst of self.moves) {
            if (!inst.def.bonus || inst.def.bonusTiming?.type !== timing) continue
            if (!inst.canUse()) continue
            if (self.ap < inst.apCost + mainAp) continue
            self.spendAp(inst.apCost)
            inst.use()
            for (const eff of inst.def.effects ?? []) {
                processActionEffect(eff, self, self, this, this.#tMs, inst.name, inst.id)
            }
            fired = true
        }
        return fired
    }
}
