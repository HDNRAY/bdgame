import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager, SYS_PREFIX } from './turn'
import { BattleLog } from './battle-log'
import { getWeapon } from '../data/weapons'
import {
    BASE_PRE_DELAY,
    BASE_STUN_TIME,
    calcTurnInterval,
    calcBaseDamage,
    calcParriedDamage,
    calcHitChance,
    calcRoll,
} from '../calc/damage'
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
    processTriggerEffect,
    processParalyzeEnd,
    processBuffEnd,
} from './effect-processor'
import type { ActionCommand, ActionResult, BattleState, EventPlan, BattleSnapshot } from './types'

export class BattleEngine {
    state!: BattleState

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
        }
        log.logBattleStart(p.name, o.name, 0, this.getSnapshot())
        this.emit('battle_start', p, o, 0)
        this.emit('battle_start', o, p, 0)
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
                    statuses: characters[0].statuses,
                },
                {
                    hp: characters[1].hp,
                    maxHp: characters[1].maxHp,
                    ap: characters[1].ap,
                    statuses: characters[1].statuses,
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
        this.state.eventActorId = e.characterId

        // 系统事件
        if (e.characterId.startsWith(SYS_PREFIX)) {
            this.#handleSystemEvent()
            this.state.turn.next()
            this.state.eventActorId = null
            return true
        }

        // 角色事件
        const chars = this.state.characters
        const self = chars.find((c) => c.id === e.characterId)!
        const enemy = chars.find((c) => c.id !== e.characterId)!
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
        const skipStatus = self.statuses.find((s) => s.skipTurn)
        if (skipStatus) {
            const reason = skipStatus.type === 'stun' ? '眩晕' : skipStatus.type
            this.#log.logSystem(`${self.name} 被${reason}，停止走表`, e.nextActionAt, this.getSnapshot())
            self.statuses = self.statuses.filter((s) => s !== skipStatus)
            const delay = skipStatus.rescheduleDelay ?? 2000
            this.state.turn.next()
            this.state.turn.scheduleNext(self.id, delay)
            this.state.eventActorId = null
            return true
        }

        this.emit('turn_start', self, enemy, e.nextActionAt)
        this.#tryBonus(self, 'turn_start')

        const cmds = planFn(self, enemy, this.state)
        for (const cmd of cmds) {
            if (self.ap <= 0 && cmd.type !== 'bonus') break
            this.execute(cmd)
        }

        // endEvent
        this.#tryBonus(self, 'before_turn_end')
        this.emit('turn_end', self, enemy, this.state.turn.peek()?.nextActionAt ?? 0)
        this.state.turn.next()
        const lastAction = this.state.lastActionExtraDelay ?? 0
        const preDelay = BASE_PRE_DELAY + lastAction
        const stunTime = BASE_STUN_TIME
        this.state.turn.scheduleNext(
            self.id,
            calcTurnInterval(self.attrs.get('dexterity'), lastAction),
            preDelay,
            stunTime,
        )
        this.state.lastActionExtraDelay = 0
        this.state.eventActorId = null
        return true
    }

    /** 触发检测 */
    emit(event: TriggerEvent, self: Character, enemy: Character, tMs: number) {
        const { log, triggerUses, distance } = this.state
        for (const slot of self.triggers) {
            if (slot.condition.type !== event) continue
            if (!matchCondition(slot.condition, { actor: self, distance: distance.current })) continue

            const action = getAction(slot.actionId)
            if (!action) continue
            const used = triggerUses.get(slot.actionId) ?? 0
            if (action.maxUses !== undefined && used >= action.maxUses) continue
            triggerUses.set(slot.actionId, used + 1)

            log.indentDepth++
            log.logSystem(`[${action.name}] ${action.name}`, tMs, this.getSnapshot())
            const hc = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
            const hitResult = calcRoll(hc)
            if (hitResult.success) {
                for (const eff of action.effects ?? []) {
                    processActionEffect(eff, self, enemy, this, tMs)
                }
                for (const eff of action.triggerEffect ?? []) {
                    processTriggerEffect(eff, self, this, action.name, action.id)
                }
            } else {
                log.logSystem(`→ 未命中`, tMs, this.getSnapshot())
            }
            log.indentDepth--
        }
    }

    private execute(cmd: ActionCommand): ActionResult {
        switch (cmd.type) {
            case 'move':
                return this.#executeMove(cmd)
            case 'attack':
                return this.#executeAttack(cmd)
            case 'defend':
                return this.#executeDefend()
            case 'bonus':
                return this.#executeBonus(cmd)
            case 'wait':
                return this.#executeWait()
        }
    }

    /** 快捷访问 */
    get #self(): Character {
        return this.state.characters.find((c) => c.id === this.state.eventActorId)!
    }
    get #enemy(): Character {
        return this.state.characters.find((c) => c.id !== this.state.eventActorId)!
    }
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
    #getCharacter(id: string): Character | undefined {
        return this.state.characters.find((c) => c.id === id)
    }

    #executeMove(cmd: ActionCommand): ActionResult {
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
        const { ap, delta } = DistanceSystem.calcMovement(cmd.bestDistance ?? 0, this.#self.attrs.get('dexterity'))
        if (!this.#self.spendAp(ap)) {
            log.logSystem(`${this.#self.name} AP不足 无法移动`, this.#tMs, this.getSnapshot())
            return r
        }
        const a = distance.move(delta)
        r.distanceDelta = a
        log.logMove(this.#self.name, a, distance.current, ap, this.#self.ap, this.#tMs, this.getSnapshot())
        processBleedDamage(this.#self, this.#tMs, this)
        this.emit('on_move', this.#self, this.#enemy, this.#tMs)
        this.emit('on_move', this.#enemy, this.#self, this.#tMs)
        return r
    }

    #executeAttack(cmd: ActionCommand): ActionResult {
        const r: ActionResult = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
            knockbackDistance: 0,
        }
        const action = this.#validateAttack(cmd)
        if (!action) return r
        this.state.lastActionExtraDelay = action.extraPreDelay ?? 0
        this.#processSelfBleed()
        if (!this.#resolveCombatRolls(action, r)) return r
        this.#finalizeAttack(action, r)
        return r
    }

    /** 验证攻击条件：招式存在性/消耗/距离 */
    #validateAttack(cmd: ActionCommand): ActionDefinition | null {
        const { distance, log } = this.state
        const self = this.#self
        const tMs = this.#tMs
        const action = cmd.actionId ? getAction(cmd.actionId) : undefined
        if (!action) {
            log.logSystem(`${self.name} 没有可用招式`, tMs, this.getSnapshot())
            return null
        }
        const c = canExecuteAction(action, self, distance.current)
        if (!c.ok) {
            log.logSystem(`${self.name} ${c.reason}`, tMs, this.getSnapshot())
            return null
        }
        if (!self.spendAp(action.apCost)) {
            log.logSystem(`${self.name} AP不足`, tMs, this.getSnapshot())
            return null
        }
        const weapon = getWeapon(self.build.weapon)
        if (!distance.inRange(weapon.range[0], weapon.range[1])) {
            log.logSystem(`${self.name} 距离不合适`, tMs, this.getSnapshot())
            return null
        }
        log.logAttack(
            self.name,
            this.#enemy.name,
            weapon.name,
            action.apCost,
            self.ap,
            tMs,
            this.getSnapshot(),
            action.name,
        )
        return action
    }

    /** 自身流血伤害处理 */
    #processSelfBleed(): void {
        processBleedDamage(this.#self, this.#tMs, this)
    }

    /** 命中/闪避/招架判定，返回 false 则攻击终止 */
    #resolveCombatRolls(action: ActionDefinition, r: ActionResult): boolean {
        return processCombatRolls(action, r, this.#self, this.#enemy, this.#tMs, this)
    }

    /** 命中后效：触发/流血/状态/击败 */
    #finalizeAttack(action: ActionDefinition, r: ActionResult): void {
        const log = this.state.log
        const self = this.#self
        const enemy = this.#enemy
        const tMs = this.#tMs

        this.emit('on_hit', self, enemy, tMs)
        this.emit('on_take_damage', enemy, self, tMs)
        this.#tryBonus(self, 'on_hit')
        this.#tryBonus(enemy, 'on_take_damage')

        processBleedDamage(enemy, tMs, this)
        this.state.log.indentDepth++
        for (const eff of action.effects ?? []) {
            if (eff.type === 'damage') {
                const base = calcBaseDamage(eff.scaling, self.attrs.getAll())
                const final = r.parried ? calcParriedDamage(base) : base
                enemy.takeDamage(final)
                log.logSystem(
                    `→ ${enemy.name} 受到 ${final} 点伤害${r.parried ? ' [挡]' : ''}`,
                    tMs,
                    this.getSnapshot(),
                )
            } else if (eff.type === 'fixed_damage') {
                const final = r.parried ? calcParriedDamage(eff.value) : eff.value
                enemy.takeDamage(final)
                log.logSystem(
                    `→ ${enemy.name} 受到 ${final} 点伤害${r.parried ? ' [挡]' : ''}`,
                    tMs,
                    this.getSnapshot(),
                )
            } else if (eff.type === 'status' && r.hit && !r.dodged) {
                processActionEffect(eff, self, enemy, this, tMs)
            } else if (r.hit && !r.dodged) {
                processActionEffect(eff, self, enemy, this, tMs)
            }
        }
        this.state.log.indentDepth--
        if (r.knockbackDistance > 0) {
            processActionEffect({ type: 'knockback', distance: r.knockbackDistance }, self, enemy, this, tMs)
        }
        if (!enemy.isAlive()) {
            log.logDefeat(enemy.name, self.name, tMs, this.getSnapshot())
            this.state.phase = 'finished'
            if (self.isAlive()) {
                this.state.lastWinner = self.name
            }
        }
    }

    #executeDefend(): ActionResult {
        this.#log.logSystem(`${this.#self.name} 防御`, this.#tMs, this.getSnapshot())
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

    #executeBonus(cmd: ActionCommand): ActionResult {
        const self = this.#self
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
        for (const eff of inst.def.triggerEffect ?? []) {
            processTriggerEffect(eff, self, this, inst.name, inst.id)
        }
        return r
    }

    #executeWait(): ActionResult {
        this.#log.logSystem(`${this.#self.name} 结束`, this.#tMs, this.getSnapshot())
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

    /** 处理系统事件（buff 到期、status tick 等） */
    #handleSystemEvent(): void {
        const e = this.state.turn.peek()!
        if (!e.systemEventType) return
        const eventId = e.characterId.slice(SYS_PREFIX.length)

        switch (e.systemEventType) {
            case 'buff_end':
                this.#handleBuffEnd(eventId)
                break
            case 'tick_poison':
            case 'tick_burn':
                this.#handleStatusTick(eventId, e.systemEventType)
                break
            case 'paralyze_end':
                this.#handleParalyzeEnd(eventId)
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
        if (type === 'tick_poison') {
            const charId = eventId.slice('tick_poison_'.length)
            const char = this.#getCharacter(charId)
            if (!char) return
            const poison = char.getStatus('poison')
            if (!poison) return
            const { nextInterval } = processStatusTick(poison, char, this, tMs)
            if (nextInterval > 0) {
                turn.scheduleSystemEventAt(eventId, tMs + nextInterval, 'tick_poison')
            }
        } else {
            const charId = eventId.slice('tick_burn_'.length)
            const char = this.#getCharacter(charId)
            if (!char) return
            const burn = char.getStatus('burn')
            if (!burn) return
            processStatusTick(burn, char, this, tMs)
            if (burn.remainingTicks && burn.remainingTicks > 0) {
                turn.scheduleSystemEventAt(eventId, tMs + 1000, 'tick_burn')
            }
        }
    }

    /** 麻痹单层到期 */
    #handleParalyzeEnd(eventId: string): void {
        processParalyzeEnd(eventId.slice('paralyze_end_'.length), this)
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
            for (const eff of inst.def.triggerEffect ?? []) {
                processTriggerEffect(eff, self, this, inst.name, inst.id)
            }
            fired = true
        }
        return fired
    }
}
