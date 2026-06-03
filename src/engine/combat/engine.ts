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
import type { TriggerEvent, TriggerDefinition } from '../entities/trigger'
import { getTriggerByEvent } from '../data/triggers'
import { processTriggers } from './trigger-system'
import { processActionEffect } from './effect-processor'
import { triggerBleed } from '../entities/status'
import type { BonusTiming, BonusTriggerEffect } from '../entities/action'
import type { AttrName } from '../entities/attributes'

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
    pendingBuffs: Map<string, { restoreValue: number }>
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
        log.logBattleStart(p.name, o.name, 0)
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
    private emit(event: TriggerEvent, self: Character, enemy: Character, tMs: number) {
        const { log, triggerUses, distance } = this.state
        const pairs: { trigger: TriggerDefinition; actionId: string }[] = []
        for (const slot of self.triggerSlots) {
            if (slot.event !== event) continue
            const t = getTriggerByEvent(slot.event)
            if (!t) continue
            pairs.push({ trigger: t, actionId: slot.actionId })
        }
        const results = processTriggers(
            { event, actor: self, target: enemy, distance: distance.current },
            pairs.map((p) => p.trigger),
            triggerUses,
        )
        for (const r of results) {
            const pair = pairs.find((p) => p.trigger.id === r.triggered.id)
            if (!pair) continue
            log.logSystem(`[${r.triggered.name}] ${r.log}`, tMs)
            const action = getAction(pair.actionId)
            if (!action) continue
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
                    log.logSystem(`${self.name} AP不足 无法移动`, tMs)
                    break
                }
                const moved = dir * perAp * ap
                const a = distance.move(moved)
                r.distanceDelta = a
                log.logMove(self.name, a, distance.current, ap, self.ap, tMs) // 移动触发流血
                for (const s of self.statuses) {
                    if (s.type === 'bleed') {
                        const dmg = triggerBleed(s)
                        if (dmg > 0) {
                            self.takeDamage(dmg)
                            log.logSystem(`[流血] ${self.name} 受到 ${dmg} 流血伤害`, tMs)
                        }
                    }
                }
                break
            }
            case 'attack': {
                const action = cmd.actionId ? getAction(cmd.actionId) : undefined
                if (!action) {
                    log.logSystem(`${self.name} 没有可用招式`, tMs)
                    break
                }
                const weapon = action.weaponType
                const stats = WEAPONS[weapon]
                const c = canExecuteAction(action, self, distance.current)
                if (!c.ok) {
                    log.logSystem(`${self.name} ${c.reason}`, tMs)
                    break
                }
                if (!self.spendAp(action.apCost)) {
                    log.logSystem(`${self.name} AP不足`, tMs)
                    break
                }
                if (!distance.inRange(stats.range[0], stats.range[1])) {
                    log.logSystem(`${self.name} 距离不合适`, tMs)
                    break
                }
                log.logAttack(self.name, enemy.name, weapon, action.apCost, self.ap, tMs, action.name)

                // 自身流血：每次行动触发
                for (const s of self.statuses) {
                    if (s.type === 'bleed') {
                        const dmg = triggerBleed(s)
                        if (dmg > 0) {
                            self.takeDamage(dmg)
                            log.logSystem(`[流血] ${self.name} 受到 ${dmg} 流血伤害`, tMs)
                        }
                    }
                }

                this.emit('on_attack', self, enemy, tMs)

                const hc = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                const hitRoll = Math.random()
                r.hit = hitRoll < hc
                log.logHitCheck(self.name, enemy.name, hc, hitRoll, r.hit, tMs)
                if (!r.hit) {
                    this.emit('on_dodged', self, enemy, tMs)
                    break
                }

                r.dodged = Math.random() < calcDodgeChance(enemy.attrs.get('dexterity'))
                if (r.dodged) {
                    log.logDodge(self.name, enemy.name, tMs)
                    this.emit('on_dodge', enemy, self, tMs)
                    break
                }

                const pc = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                const parryRoll = Math.random()
                r.parried = parryRoll < pc
                if (r.parried) {
                    log.logParry(self.name, enemy.name, tMs, pc, parryRoll)
                    this.emit('on_parry', enemy, self, tMs)
                } else {
                    this.emit('on_parried', self, enemy, tMs)
                }

                const resolved = resolveAction(action, self, enemy, distance.current)

                // 记录暴击掷骰
                const critChance = calcCritChance(self.attrs.get('technique'))
                const critRoll = Math.random()
                const isCrit = critRoll < critChance
                log.logCritCheck(self.name, critChance, critRoll, isCrit, tMs)
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
                            log.logSystem(`[流血] ${enemy.name} 受到 ${d} 流血伤害`, tMs)
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
                    log.logDefeat(enemy.name, self.name, tMs)
                    this.state.phase = 'finished'
                }
                break
            }
            case 'defend':
                log.logSystem(`${self.name} 防御`, tMs)
                break
            case 'bonus': {
                if (!cmd.actionId) break
                const inst = self.actionInstances.find((a) => a.id === cmd.actionId)
                if (!inst || !inst.def.bonus || !inst.canUse()) break
                if (!self.spendAp(inst.apCost)) break
                inst.use()
                this.#applyTriggerEffect(inst.def.triggerEffect, self, inst.name, inst.id)
                break
            }
            case 'wait':
                log.logSystem(`${self.name} 结束`, tMs)
                break
        }
        return r
    }

    /** 处理系统事件（buff 到期等） */
    #handleSystemEvent(): void {
        const eventId = this.state.eventActorId!.slice(SYS_PREFIX.length)
        const prefix = 'buff_end_'
        if (!eventId.startsWith(prefix)) return
        const buffKey = eventId.slice(prefix.length)
        const data = this.state.pendingBuffs.get(buffKey)
        if (data) {
            // buffKey = `${actionId}::${charId}`
            const sepIdx = buffKey.lastIndexOf('::')
            if (sepIdx === -1) return
            const charId = buffKey.slice(sepIdx + 2)
            const chars = this.state.characters
            const char = chars.find((c) => c.id === charId)
            if (!char) return
            const actionId = buffKey.slice(0, sepIdx)
            const action = getAction(actionId)
            this.#applyTriggerEffect(
                { type: 'stat_restore', stat: 'strength', value: data.restoreValue },
                char,
                action?.name ?? actionId,
            )
            this.state.pendingBuffs.delete(buffKey)
        }
    }

    /** 辅招触发 */
    #tryBonus(self: Character, timing: BonusTiming, mainAp = 0): boolean {
        let fired = false
        for (const inst of self.actionInstances) {
            if (!inst.def.bonus || inst.def.bonusTiming !== timing) continue
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
                    actorName,
                )
                {
                    const attrVal = self.attrs.get(e.duration.attr)
                    const buffDuration = Math.round(attrVal * e.duration.multiplier)
                    this.state.pendingBuffs.set(buffKey, { restoreValue: old })
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
                this.state.log.logSystem(`[${tag}] ${self.name} ${desc}`, tMs, actorName)
                break
            }
            case 'stat_restore': {
                const attr = e.stat as AttrName
                const old = self.attrs.get(attr)
                self.attrs.set(attr, e.value)
                this.state.log.logSystem(`[${tag}] ${self.name} ${e.stat} ${old}→恢复${e.value}`, tMs, actorName)
                break
            }
            case 'heal': {
                const amount = e.value + (e.ratio ? Math.round(self.maxHp * e.ratio) : 0)
                self.heal(amount)
                this.state.log.logSystem(`[${tag}] ${self.name} 回复 ${amount} HP`, tMs, actorName)
                break
            }
        }
    }
}
