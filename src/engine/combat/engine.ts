import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager, SYS_PREFIX } from './turn'
import { BattleLog } from './battle-log'
import type { WeaponType } from '../calc/damage'
import {
    WEAPONS,
    calcHitChance,
    calcParryChance,
    calcDodgeChance,
    calcTurnInterval,
    calcCritChance,
    calcFinalDamage,
} from '../calc/damage'
import { resolveAction, canExecuteAction } from '../calc/action-executor'
import { getAction } from '../data/actions'
import type { TriggerEvent } from '../entities/trigger'
import { matchCondition } from './trigger-system'
import { processActionEffect, processStatusTick } from './effect-processor'
import { triggerBleed } from '../entities/status'
import type { BonusTriggerEffect } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import type { BattleSnapshot } from './battle-log'

export interface ActionCommand {
    type: 'attack' | 'move' | 'bonus' | 'defend' | 'wait'
    actionId?: string
    weaponType?: WeaponType
    bestDistance?: number
}
export interface ActionResult {
    damage: number
    hit: boolean
    parried: boolean
    dodged: boolean
    crit: boolean
    distanceDelta: number
}
export type BattlePhase = 'idle' | 'fighting' | 'finished'

export interface BattleState {
    phase: BattlePhase
    characters: [Character, Character]
    distance: DistanceSystem
    turn: TurnManager
    log: BattleLog
    eventActorId: string | null
    triggerUses: Map<string, number>
    pendingBuffs: Map<string, { restoreValue: number; stat: string }>
}

export type EventPlan = (self: Character, enemy: Character, state: BattleState) => ActionCommand[]

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

        // 跳过行动检查（如眩晕停止走表）
        const skipStatus = self.statuses.find((s) => s.skipTurn)
        if (skipStatus) {
            const reason = skipStatus.type === 'stun' ? '眩晕' : skipStatus.type
            this.state.log.logSystem(`${self.name} 被${reason}，停止走表`, e.nextActionAt, this.getSnapshot())
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
        const stats = WEAPONS.fist
        this.state.turn.scheduleNext(
            self.id,
            calcTurnInterval(self.attrs.get('dexterity'), stats.preDelay, stats.stunTime),
        )
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

            log.logSystem(`[${action.name}] ${action.name}`, tMs, this.getSnapshot())
            for (const eff of action.effects ?? []) {
                processActionEffect(eff, self, enemy, this, tMs)
            }
            if (action.triggerEffect) {
                this.#applyTriggerEffect(action.triggerEffect, self, action.name, action.id)
            }
        }
    }

    private execute(cmd: ActionCommand): ActionResult {
        const { characters, distance, turn, log } = this.state
        const actorId = this.state.eventActorId!
        const self = characters.find((c) => c.id === actorId)!
        const enemy = characters.find((c) => c.id !== actorId)!
        const tMs = turn.peek()?.nextActionAt ?? 0

        const r: ActionResult = { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }

        switch (cmd.type) {
            case 'move': {
                const ap = Math.abs(cmd.bestDistance ?? 0)
                const dir = Math.sign(cmd.bestDistance ?? -1)
                const perAp = DistanceSystem.apToRange(self.attrs.get('dexterity'))
                if (!self.spendAp(ap)) {
                    log.logSystem(`${self.name} AP不足 无法移动`, tMs, this.getSnapshot())
                    break
                }
                const moved = dir * perAp * ap
                const a = distance.move(moved)
                r.distanceDelta = a
                log.logMove(self.name, a, distance.current, ap, self.ap, tMs, this.getSnapshot())
                for (const s of self.statuses) {
                    if (s.type === 'bleed') {
                        const dmg = triggerBleed(s)
                        if (dmg > 0) {
                            self.takeDamage(dmg)
                            log.logSystem(`[流血] ${self.name} 受到 ${dmg} 流血伤害`, tMs, this.getSnapshot())
                        }
                    }
                }
                break
            }
            case 'attack': {
                const action = cmd.actionId ? getAction(cmd.actionId) : undefined
                if (!action) {
                    log.logSystem(`${self.name} 没有可用招式`, tMs, this.getSnapshot())
                    break
                }
                const weapon = action.weaponType
                const stats = WEAPONS[weapon]
                const c = canExecuteAction(action, self, distance.current)
                if (!c.ok) {
                    log.logSystem(`${self.name} ${c.reason}`, tMs, this.getSnapshot())
                    break
                }
                if (!self.spendAp(action.apCost)) {
                    log.logSystem(`${self.name} AP不足`, tMs, this.getSnapshot())
                    break
                }
                if (!distance.inRange(stats.range[0], stats.range[1])) {
                    log.logSystem(`${self.name} 距离不合适`, tMs, this.getSnapshot())
                    break
                }
                log.logAttack(
                    self.name,
                    enemy.name,
                    weapon,
                    action.apCost,
                    self.ap,
                    tMs,
                    this.getSnapshot(),
                    action.name,
                )

                // 自身流血：每次行动触发
                for (const s of self.statuses) {
                    if (s.type === 'bleed') {
                        const dmg = triggerBleed(s)
                        if (dmg > 0) {
                            self.takeDamage(dmg)
                            log.logSystem(`[流血] ${self.name} 受到 ${dmg} 流血伤害`, tMs, this.getSnapshot())
                        }
                    }
                }

                this.emit('on_attack', self, enemy, tMs)

                const hc = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                const hitRoll = Math.random()
                r.hit = hitRoll < hc
                log.logHitCheck(self.name, enemy.name, hc, hitRoll, r.hit, tMs, this.getSnapshot())
                if (!r.hit) {
                    this.emit('on_dodged', self, enemy, tMs)
                    break
                }

                // 麻痹降低闪避
                const paraPenalty = (enemy.statuses.find((s) => s.type === 'paralyze')?.stacks ?? 0) * 0.05
                const effectiveDex = enemy.attrs.get('dexterity') - Math.floor(paraPenalty * 10)
                r.dodged = Math.random() < calcDodgeChance(Math.max(0, effectiveDex))
                if (r.dodged) {
                    log.logDodge(self.name, enemy.name, tMs, this.getSnapshot())
                    this.emit('on_dodge', enemy, self, tMs)
                    break
                }

                const pc = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                const parryRoll = Math.random()
                r.parried = parryRoll < pc
                if (r.parried) {
                    log.logParry(self.name, enemy.name, tMs, this.getSnapshot(), pc, parryRoll)
                    this.emit('on_parry', enemy, self, tMs)
                } else {
                    this.emit('on_parried', self, enemy, tMs)
                }

                const resolved = resolveAction(action, self, enemy, distance.current)

                // 记录暴击掷骰
                const critChance = calcCritChance(self.attrs.get('technique'))
                const critRoll = Math.random()
                const isCrit = critRoll < critChance
                log.logCritCheck(self.name, critChance, critRoll, isCrit, tMs, this.getSnapshot())
                resolved.isCrit = isCrit
                resolved.final = calcFinalDamage(resolved.base + resolved.crippleBonus, resolved.distanceMult, isCrit)

                const finalDmg = r.parried ? Math.round(resolved.final * 0.4) : resolved.final
                enemy.takeDamage(finalDmg)
                r.damage = finalDmg
                r.crit = resolved.isCrit
                if (resolved.selfDamage > 0) self.takeDamage(resolved.selfDamage)
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
                    processActionEffect(
                        { type: 'knockback', distance: resolved.knockbackDistance },
                        self,
                        enemy,
                        this,
                        tMs,
                    )
                }

                this.emit('on_hit', self, enemy, tMs)
                this.emit('on_take_damage', enemy, self, tMs)
                this.#tryBonus(self, 'on_hit')
                this.#tryBonus(enemy, 'on_take_damage')

                // 受击触发流血
                for (const s of enemy.statuses) {
                    if (s.type === 'bleed') {
                        const d = triggerBleed(s)
                        if (d > 0) {
                            enemy.takeDamage(d)
                            log.logSystem(`[流血] ${enemy.name} 受到 ${d} 流血伤害`, tMs, this.getSnapshot())
                        }
                    }
                }

                // 招式附加状态
                if (action) {
                    for (const eff of action.effects ?? []) {
                        if (eff.type === 'status' && r.hit && !r.dodged) {
                            processActionEffect(eff, self, enemy, this, tMs)
                        }
                    }
                }

                if (!enemy.isAlive()) {
                    log.logDefeat(enemy.name, self.name, tMs, this.getSnapshot())
                    this.state.phase = 'finished'
                }
                break
            }
            case 'defend':
                log.logSystem(`${self.name} 防御`, tMs, this.getSnapshot())
                break
            case 'bonus': {
                if (!cmd.actionId) break
                const inst = self.moves.find((a) => a.id === cmd.actionId)
                if (!inst || !inst.def.bonus || !inst.canUse()) break
                if (!self.spendAp(inst.apCost)) break
                inst.use()
                this.#applyTriggerEffect(inst.def.triggerEffect, self, inst.name, inst.id)
                break
            }
            case 'wait':
                log.logSystem(`${self.name} 结束`, tMs, this.getSnapshot())
                break
        }
        return r
    }

    /** 处理系统事件（buff 到期、status tick 等） */
    #handleSystemEvent(): void {
        const eventId = this.state.eventActorId!.slice(SYS_PREFIX.length)

        if (eventId.startsWith('buff_end_')) {
            this.#handleBuffEnd(eventId)
        } else if (eventId.startsWith('tick_poison_') || eventId.startsWith('tick_burn_')) {
            this.#handleStatusTick(eventId)
        }
    }

    /** buff 到期恢复 */
    #handleBuffEnd(eventId: string): void {
        const prefix = 'buff_end_'
        const buffKey = eventId.slice(prefix.length)
        const data = this.state.pendingBuffs.get(buffKey)
        if (!data) return
        const sepIdx = buffKey.lastIndexOf('::')
        if (sepIdx === -1) return
        const charId = buffKey.slice(sepIdx + 2)
        const chars = this.state.characters
        const char = chars.find((c) => c.id === charId)
        if (!char) return
        const actionId = buffKey.slice(0, sepIdx)
        const action = getAction(actionId)
        this.#applyTriggerEffect(
            { type: 'stat_restore', stat: data.stat, value: data.restoreValue },
            char,
            action?.name ?? actionId,
        )
        this.state.pendingBuffs.delete(buffKey)
    }

    /** status tick（毒/灼烧） */
    #handleStatusTick(eventId: string): void {
        const { turn } = this.state
        const tMs = turn.currentTime
        if (eventId.startsWith('tick_poison_')) {
            const charId = eventId.slice('tick_poison_'.length)
            const char = this.state.characters.find((c) => c.id === charId)
            if (!char) return
            const poison = char.statuses.find((s) => s.type === 'poison')
            if (!poison) return
            const { nextInterval } = processStatusTick(poison, char, this, tMs)
            if (nextInterval > 0) {
                turn.scheduleSystemEventAt(eventId, tMs + nextInterval)
            }
        } else if (eventId.startsWith('tick_burn_')) {
            const charId = eventId.slice('tick_burn_'.length)
            const char = this.state.characters.find((c) => c.id === charId)
            if (!char) return
            const burn = char.statuses.find((s) => s.type === 'burn')
            if (!burn) return
            processStatusTick(burn, char, this, tMs)
            if (burn.remainingTicks && burn.remainingTicks > 0) {
                turn.scheduleSystemEventAt(eventId, tMs + 1000)
            }
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
        const tMs = this.state.turn.peek()?.nextActionAt ?? 0
        const actorName = self.name
        switch (e.type) {
            case 'stat_multiply': {
                const buffKey = `${actionId ?? 'buff'}::${self.id}`
                if (this.state.pendingBuffs.has(buffKey)) break
                const attr = e.stat as AttrName
                const old = self.attrs.get(attr)
                self.attrs.set(attr, old * e.multiplier)
                this.state.log.logSystem(
                    `[${tag}] ${self.name} ${e.stat} ${old}→${old * e.multiplier}!`,
                    tMs,
                    this.getSnapshot(),
                    actorName,
                )
                {
                    const attrVal = self.attrs.get(e.duration.attr)
                    const buffDuration = Math.round(attrVal * e.duration.multiplier)
                    this.state.pendingBuffs.set(buffKey, { restoreValue: old, stat: e.stat })
                    this.state.turn.scheduleSystemEventAt(
                        `buff_end_${buffKey}`,
                        this.state.turn.currentTime + buffDuration,
                    )
                }
                break
            }
            case 'stat_buff': {
                const entries = Object.entries(e.attrs) as [AttrName, number][]
                const desc = entries.map(([s, v]) => `${s}+${v}`).join(' ')
                for (const [attr, value] of entries) self.attrs.modify(attr, value)
                this.state.log.logSystem(`[${tag}] ${self.name} ${desc}`, tMs, this.getSnapshot(), actorName)
                break
            }
            case 'stat_restore': {
                const attr = e.stat as AttrName
                const old = self.attrs.get(attr)
                self.attrs.set(attr, e.value)
                this.state.log.logSystem(
                    `[${tag}] ${self.name} ${e.stat} ${old}→恢复${e.value}`,
                    tMs,
                    this.getSnapshot(),
                    actorName,
                )
                break
            }
            case 'heal': {
                const amount = e.value + (e.ratio ? Math.round(self.maxHp * e.ratio) : 0)
                self.heal(amount)
                this.state.log.logSystem(`[${tag}] ${self.name} 回复 ${amount} HP`, tMs, this.getSnapshot(), actorName)
                break
            }
        }
    }
}
