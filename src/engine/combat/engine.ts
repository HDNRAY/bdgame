import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager, SYS_PREFIX } from './turn'
import { BattleLog } from './battle-log'
import {
    WEAPONS,
    calcHitChance,
    calcParryChance,
    calcTurnInterval,
    calcCritChance,
    calcFinalDamage,
    calcParriedDamage,
    calcDodgeChanceWithParalyze,
    calcParalyzeAttrRestore,
    calcHealAmount,
    calcBuffDuration,
} from '../calc/damage'
import { encodeBuffKey, decodeBuffKey } from '../util/buff-utils'
import { resolveAction, canExecuteAction } from '../calc/action-executor'
import { getAction } from '../data/actions'
import type { ActionDefinition } from '../entities/action'
import type { TriggerEvent } from '../entities/trigger'
import { matchCondition } from './trigger-system'
import { processActionEffect, processStatusTick } from './effect-processor'
import { triggerBleed } from '../entities/status'
import type { BonusTriggerEffect } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import type { ActionCommand, ActionResult, BattleState, EventPlan, BattleSnapshot } from './types'

export class BattleEngine {
    state!: BattleState
    #snapCache: { ver: number; snap: BattleSnapshot } | null = null

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
            _snapVer: 0,
        }
        log.logBattleStart(p.name, o.name, 0, this.getSnapshot())
        this.emit('battle_start', p, o, 0)
        this.emit('battle_start', o, p, 0)
    }

    /** 构建当前战斗快照（带版本缓存） */
    getSnapshot(): BattleSnapshot {
        const ver = this.state._snapVer
        if (this.#snapCache?.ver === ver) return this.#snapCache.snap
        const { characters, distance, turn, triggerUses, pendingBuffs, phase } = this.state
        const snap: BattleSnapshot = {
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
        }
        this.#snapCache = { ver, snap }
        return snap
    }

    /** 标记状态变更，快照缓存失效 */
    #markDirty(): void {
        this.state._snapVer++
        this.#snapCache = null
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
            this.#markDirty()
            this.state.eventActorId = null
            return true
        }

        // 角色事件
        const chars = this.state.characters
        const self = chars.find((c) => c.id === e.characterId)!
        const enemy = chars.find((c) => c.id !== e.characterId)!
        self.resetAp()
        enemy.resetAp()

        // 跳过行动检查（如眩晕停止走表）
        const skipStatus = self.statuses.find((s) => s.skipTurn)
        if (skipStatus) {
            const reason = skipStatus.type === 'stun' ? '眩晕' : skipStatus.type
            this.#log.logSystem(`${self.name} 被${reason}，停止走表`, e.nextActionAt, this.getSnapshot())
            self.statuses = self.statuses.filter((s) => s !== skipStatus)
            this.#markDirty()
            const delay = skipStatus.rescheduleDelay ?? 2000
            this.state.turn.next()
            this.state.turn.scheduleNext(self.id, delay)
            this.#markDirty()
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
        const stats = WEAPONS.fist
        this.state.turn.scheduleNext(
            self.id,
            calcTurnInterval(self.attrs.get('dexterity'), stats.preDelay, stats.stunTime),
        )
        this.#markDirty()
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
            this.#markDirty()

            log.logSystem(`[${action.name}] ${action.name}`, tMs, this.getSnapshot())
            for (const eff of action.effects ?? []) {
                processActionEffect(eff, self, enemy, this, tMs)
                this.#markDirty()
            }
            if (action.triggerEffect) {
                this.#applyTriggerEffect(action.triggerEffect, self, action.name, action.id)
            }
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
        const self = this.#self
        const tMs = this.#tMs
        const r: ActionResult = { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }
        const ap = Math.abs(cmd.bestDistance ?? 0)
        const dir = Math.sign(cmd.bestDistance ?? -1)
        const perAp = DistanceSystem.apToRange(self.attrs.get('dexterity'))
        if (!self.spendAp(ap)) {
            log.logSystem(`${self.name} AP不足 无法移动`, tMs, this.getSnapshot())
            return r
        }
        const moved = dir * perAp * ap
        const a = distance.move(moved)
        this.#markDirty()
        r.distanceDelta = a
        log.logMove(self.name, a, distance.current, ap, self.ap, tMs, this.getSnapshot())
        this.#applyBleedDamage(self, tMs)
        return r
    }

    #executeAttack(cmd: ActionCommand): ActionResult {
        const r: ActionResult = { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }
        const action = this.#validateAttack(cmd)
        if (!action) return r
        this.#processSelfBleed()
        if (!this.#resolveCombatRolls(action, r)) return r
        this.#resolveAndApplyDamage(action, r)
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
        this.#markDirty()
        const stats = WEAPONS[action.weaponType]
        if (!distance.inRange(stats.range[0], stats.range[1])) {
            log.logSystem(`${self.name} 距离不合适`, tMs, this.getSnapshot())
            return null
        }
        log.logAttack(
            self.name,
            this.#enemy.name,
            action.weaponType,
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
        this.#applyBleedDamage(this.#self, this.#tMs)
    }

    /** 命中/闪避/招架判定，返回 false 则攻击终止 */
    #resolveCombatRolls(action: ActionDefinition, r: ActionResult): boolean {
        const log = this.state.log
        const self = this.#self
        const enemy = this.#enemy
        const tMs = this.#tMs
        const stats = WEAPONS[action.weaponType]

        this.emit('on_attack', self, enemy, tMs)
        const hc = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
        const hitRoll = Math.random()
        r.hit = hitRoll < hc
        log.logHitCheck(self.name, enemy.name, hc, hitRoll, r.hit, tMs, this.getSnapshot())
        if (!r.hit) {
            this.emit('on_dodged', self, enemy, tMs)
            return false
        }

        const paraStacks = enemy.getStatus('paralyze')?.stacks ?? 0
        r.dodged = Math.random() < calcDodgeChanceWithParalyze(enemy.attrs.get('dexterity'), paraStacks)
        if (r.dodged) {
            log.logDodge(self.name, enemy.name, tMs, this.getSnapshot())
            this.emit('on_dodge', enemy, self, tMs)
            return false
        }

        const pc = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
        const parryRoll = Math.random()
        r.parried = parryRoll < pc
        if (r.parried) log.logParry(self.name, enemy.name, tMs, this.getSnapshot(), pc, parryRoll)
        else this.emit('on_parried', self, enemy, tMs)
        return true
    }

    /** 伤害结算与应用 */
    #resolveAndApplyDamage(action: ActionDefinition, r: ActionResult): void {
        const { distance, log } = this.state
        const self = this.#self
        const enemy = this.#enemy
        const tMs = this.#tMs

        const resolved = resolveAction(action, self, enemy, distance.current)
        const critChance = calcCritChance(self.attrs.get('technique'))
        const critRoll = Math.random()
        const isCrit = critRoll < critChance
        log.logCritCheck(self.name, critChance, critRoll, isCrit, tMs, this.getSnapshot())
        resolved.isCrit = isCrit
        resolved.final = calcFinalDamage(resolved.base + resolved.crippleBonus, resolved.distanceMult, isCrit)

        const finalDmg = r.parried ? calcParriedDamage(resolved.final) : resolved.final
        enemy.takeDamage(finalDmg)
        this.#markDirty()
        r.damage = finalDmg
        r.crit = resolved.isCrit
        if (resolved.selfDamage > 0) {
            self.takeDamage(resolved.selfDamage)
            this.#markDirty()
        }
        log.logDamage(
            self.name,
            enemy.name,
            resolved.base,
            resolved.distanceMult,
            resolved.isCrit,
            r.parried,
            finalDmg,
            resolved.final - finalDmg,
            tMs,
            this.getSnapshot(),
        )
        if (resolved.knockbackDistance > 0) {
            processActionEffect({ type: 'knockback', distance: resolved.knockbackDistance }, self, enemy, this, tMs)
            this.#markDirty()
        }
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

        this.#applyBleedDamage(enemy, tMs)
        for (const eff of action.effects ?? []) {
            if (eff.type === 'status' && r.hit && !r.dodged) {
                processActionEffect(eff, self, enemy, this, tMs)
                this.#markDirty()
            }
        }
        if (!enemy.isAlive()) {
            log.logDefeat(enemy.name, self.name, tMs, this.getSnapshot())
            this.state.phase = 'finished'
            this.#markDirty()
        }
    }

    /** 对目标执行流血伤害 */
    #applyBleedDamage(owner: Character, tMs: number): void {
        for (const s of owner.statuses) {
            if (s.type === 'bleed') {
                const dmg = triggerBleed(s)
                if (dmg > 0) {
                    owner.takeDamage(dmg)
                    this.#markDirty()
                    this.#log.logSystem(`[流血] ${owner.name} 受到 ${dmg} 流血伤害`, tMs, this.getSnapshot())
                }
            }
        }
    }

    #executeDefend(): ActionResult {
        this.#log.logSystem(`${this.#self.name} 防御`, this.#tMs, this.getSnapshot())
        return { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }
    }

    #executeBonus(cmd: ActionCommand): ActionResult {
        const self = this.#self
        const r = { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }
        if (!cmd.actionId) return r
        const inst = self.moves.find((a) => a.id === cmd.actionId)
        if (!inst || !inst.def.bonus || !inst.canUse()) return r
        if (!self.spendAp(inst.apCost)) return r
        this.#markDirty()
        inst.use()
        this.#applyTriggerEffect(inst.def.triggerEffect, self, inst.name, inst.id)
        return r
    }

    #executeWait(): ActionResult {
        this.#log.logSystem(`${this.#self.name} 结束`, this.#tMs, this.getSnapshot())
        return { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }
    }

    /** 处理系统事件（buff 到期、status tick 等） */
    #handleSystemEvent(): void {
        const eventId = this.state.eventActorId!.slice(SYS_PREFIX.length)

        if (eventId.startsWith('buff_end_')) {
            this.#handleBuffEnd(eventId)
        } else if (eventId.startsWith('tick_poison_') || eventId.startsWith('tick_burn_')) {
            this.#handleStatusTick(eventId)
        } else if (eventId.startsWith('paralyze_end_')) {
            this.#handleParalyzeEnd(eventId)
        } else if (eventId.startsWith('stun_reset_')) {
            const charId = eventId.slice('stun_reset_'.length)
            this.#buffs.delete(`stun_track_${charId}`)
            this.#markDirty()
        }
    }

    /** buff 到期恢复 */
    #handleBuffEnd(eventId: string): void {
        const buffKey = eventId.slice('buff_end_'.length)
        const data = this.#buffs.get(buffKey)
        if (!data) return
        const decoded = decodeBuffKey(buffKey)
        if (!decoded) return
        const char = this.#getCharacter(decoded.characterId)
        if (!char) return
        const action = getAction(decoded.actionId)
        const buffName = action?.name ?? (decoded.actionId.startsWith('paralyze') ? '麻痹' : decoded.actionId)
        this.#applyTriggerEffect({ type: 'stat_restore', stat: data.stat, value: data.restoreValue }, char, buffName)
        this.#buffs.delete(buffKey)
        this.#markDirty()
    }

    /** status tick（毒/灼烧） */
    #handleStatusTick(eventId: string): void {
        const { turn } = this.state
        const tMs = this.#currentTime
        if (eventId.startsWith('tick_poison_')) {
            const charId = eventId.slice('tick_poison_'.length)
            const char = this.#getCharacter(charId)
            if (!char) return
            const poison = char.getStatus('poison')
            if (!poison) return
            const { nextInterval } = processStatusTick(poison, char, this, tMs)
            if (nextInterval > 0) {
                turn.scheduleSystemEventAt(eventId, tMs + nextInterval)
            }
            this.#markDirty()
        } else if (eventId.startsWith('tick_burn_')) {
            const charId = eventId.slice('tick_burn_'.length)
            const char = this.#getCharacter(charId)
            if (!char) return
            const burn = char.getStatus('burn')
            if (!burn) return
            processStatusTick(burn, char, this, tMs)
            this.#markDirty()
            if (burn.remainingTicks && burn.remainingTicks > 0) {
                turn.scheduleSystemEventAt(eventId, tMs + 1000)
            }
        }
    }

    /** 麻痹单层到期 */
    #handleParalyzeEnd(eventId: string): void {
        const appId = eventId.slice('paralyze_end_'.length)
        const data = this.#buffs.get(`para_${appId}`)
        if (!data || data.stat !== 'paralyze') return
        const stacks = data.restoreValue
        this.#buffs.delete(`para_${appId}`)

        const chars = this.state.characters
        for (const char of chars) {
            const entry = char.getStatus('paralyze')
            if (!entry) continue
            const restore = calcParalyzeAttrRestore(stacks)
            entry.stacks -= stacks
            char.attrs.modify('dexterity', restore.dexterity)
            char.attrs.modify('insight', restore.insight)
            this.#markDirty()
            this.#log.logSystem(`[麻痹] ${char.name} 恢复${stacks}层`, this.#currentTime, this.getSnapshot())
            if (entry.stacks <= 0) {
                char.statuses = char.statuses.filter((s) => s !== entry)
                this.#markDirty()
            }
            return
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
            this.#markDirty()
            inst.use()
            this.#applyTriggerEffect(inst.def.triggerEffect, self, inst.name, inst.id)
            fired = true
        }
        return fired
    }

    /** 应用 triggerEffect */
    #applyTriggerEffect(
        e: BonusTriggerEffect | BonusTriggerEffect[] | undefined,
        self: Character,
        actionName?: string,
        actionId?: string,
    ): void {
        if (!e) return
        if (Array.isArray(e)) {
            for (const eff of e) this.#applyTriggerEffect(eff, self, actionName, actionId)
            return
        }
        const tag = actionName ?? '功法'
        const tMs = this.#tMs
        const actorName = self.name
        switch (e.type) {
            case 'stat_multiply': {
                const buffKey = encodeBuffKey(actionId ?? 'buff', self.id)
                if (this.#buffs.has(buffKey)) break
                const attr = e.stat as AttrName
                const old = self.attrs.get(attr)
                self.attrs.set(attr, old * e.multiplier)
                this.#markDirty()
                this.#log.logSystem(
                    `[${tag}] ${self.name} ${e.stat} ${old}→${old * e.multiplier}!`,
                    tMs,
                    this.getSnapshot(),
                    actorName,
                )
                {
                    const attrVal = self.attrs.get(e.duration.attr)
                    const buffDuration = calcBuffDuration(attrVal, e.duration.multiplier)
                    this.#buffs.set(buffKey, { restoreValue: old, stat: e.stat })
                    this.#markDirty()
                    this.state.turn.scheduleSystemEventAt(`buff_end_${buffKey}`, this.#currentTime + buffDuration)
                }
                break
            }
            case 'stat_buff': {
                const entries = Object.entries(e.attrs) as [AttrName, number][]
                const desc = entries.map(([s, v]) => `${s}+${v}`).join(' ')
                for (const [attr, value] of entries) {
                    self.attrs.modify(attr, value)
                    this.#markDirty()
                }
                this.#log.logSystem(`[${tag}] ${self.name} ${desc}`, tMs, this.getSnapshot(), actorName)
                break
            }
            case 'stat_restore': {
                const attr = e.stat as AttrName
                const old = self.attrs.get(attr)
                self.attrs.set(attr, e.value)
                this.#markDirty()
                this.#log.logSystem(
                    `[${tag}] ${self.name} ${e.stat} ${old}→恢复${e.value}`,
                    tMs,
                    this.getSnapshot(),
                    actorName,
                )
                break
            }
            case 'heal': {
                const amount = calcHealAmount(e.value, self.maxHp, e.ratio)
                self.heal(amount)
                this.#markDirty()
                this.#log.logSystem(`[${tag}] ${self.name} 回复 ${amount} HP`, tMs, this.getSnapshot(), actorName)
                break
            }
        }
    }
}
