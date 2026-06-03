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
import { getTrigger } from '../data/triggers'
import { processTriggers } from './trigger-system'
import { createBleed, createPoison, triggerBleed } from '../entities/status'
import type { BonusTiming, BonusTriggerEffect, BuffDuration } from '../entities/action'
import type { AttrName } from '../entities/attributes'

export interface ActionCommand {
    type: 'attack' | 'move' | 'defend' | 'wait'
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
    player: Character
    opponent: Character
    distance: DistanceSystem
    turn: TurnManager
    log: BattleLog
    eventActorId: string | null
    triggerUses: Map<string, number>
    /** 待恢复的 buff（key 如 "qi_gather_p1"） */
    pendingBuffs: Map<string, { restoreValue: number }>
}

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
            player: p,
            opponent: o,
            distance: new DistanceSystem(d),
            turn: tm,
            log,
            eventActorId: null,
            triggerUses: new Map(),
            pendingBuffs: new Map(),
        }
    }

    /** 触发检测 */
    private emit(event: TriggerEvent, self: Character, enemy: Character, tMs: number) {
        const { log, triggerUses, distance } = this.state
        const equipped: TriggerDefinition[] = self.triggers
            .map((id) => getTrigger(id))
            .filter((t): t is TriggerDefinition => t != null)
        const results = processTriggers(
            { event, actor: self, target: enemy, distance: distance.current },
            equipped,
            triggerUses,
        )
        for (const r of results) log.logSystem(`[${r.triggered.name}] ${r.log}`, tMs)
    }

    startEvent(): boolean {
        const e = this.state.turn.peek()
        if (!e) return false
        this.state.eventActorId = e.characterId
        // 系统事件不重置 AP
        if (e.characterId.startsWith(SYS_PREFIX)) return true
        const self = e.characterId === this.state.player.id ? this.state.player : this.state.opponent
        self.resetAp()
        this.state.opponent.resetAp()
        this.emit(
            'turn_start',
            self,
            this.state.player.id === e.characterId ? this.state.opponent : this.state.player,
            e.nextActionAt,
        )
        tryBonus(this, self, 'turn_start')
        return true
    }

    execute(cmd: ActionCommand): ActionResult {
        const { player, opponent, distance, turn, log } = this.state
        const actorId = this.state.eventActorId!
        const isPlayer = actorId === player.id
        const self = isPlayer ? player : opponent
        const enemy = isPlayer ? opponent : player
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
                const weapon = cmd.weaponType ?? 'fist'
                const an = action?.name ?? weapon
                if (action) {
                    const c = canExecuteAction(action, self, distance.current)
                    if (!c.ok) {
                        log.logSystem(`${self.name} ${c.reason}`, tMs)
                        break
                    }
                }
                if (!self.spendAp(action?.apCost ?? 0)) {
                    log.logSystem(`${self.name} AP不足`, tMs)
                    break
                }
                const stats = WEAPONS[weapon]
                if (!distance.inRange(stats.range[0], stats.range[1])) {
                    log.logSystem(`${self.name} 距离不合适`, tMs)
                    break
                }
                log.logAttack(self.name, enemy.name, weapon, action?.apCost ?? 0, self.ap, tMs, an)

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

                const resolved = action
                    ? resolveAction(action, self, enemy, distance.current)
                    : resolveAction(
                          {
                              id: 'basic',
                              name: weapon,
                              weaponType: weapon,
                              apCost: 0,
                              bestDistance: 1,
                              tags: [],
                              effects: [{ type: 'damage', scaling: stats.attrScaling }],
                          },
                          self,
                          enemy,
                          distance.current,
                      )

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
                if (resolved.knockbackDistance > 0) distance.move(resolved.knockbackDistance)

                this.emit('on_hit', self, enemy, tMs)
                this.emit('on_take_damage', enemy, self, tMs)
                tryBonus(this, self, 'on_hit')
                tryBonus(this, enemy, 'on_take_damage')

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

                // 招式附加状态（如刺击→流血）
                if (action) {
                    for (const eff of action.effects ?? []) {
                        if (eff.type === 'status' && r.hit && !r.dodged) {
                            const sc = eff.chance ?? 0.5
                            const roll = Math.random()
                            if (!(roll < sc)) {
                                log.logSystem(
                                    `[${eff.status}] 概率${(sc * 100).toFixed(0)}% 骰${(roll * 100).toFixed(0)}% 未命中`,
                                    tMs,
                                )
                                continue
                            }
                            log.logSystem(
                                `[${eff.status}] 概率${(sc * 100).toFixed(0)}% 骰${(roll * 100).toFixed(0)}% 命中`,
                                tMs,
                            )
                            const existing = enemy.statuses.find((s) => s.type === eff.status)
                            if (existing) {
                                existing.stacks += eff.stacks
                            } else if (eff.status === 'bleed') {
                                enemy.statuses.push(createBleed(eff.stacks, 1, self.name))
                            } else if (eff.status === 'poison') {
                                enemy.statuses.push(createPoison(eff.stacks, self.name))
                            } else {
                                enemy.statuses.push({ type: eff.status, stacks: eff.stacks, source: self.name } as any)
                            }
                            const target = enemy.statuses.find((s) => s.type === eff.status)
                            log.logSystem(`[${eff.status}] ${enemy.name} ${target ? target.stacks : eff.stacks}层`, tMs)
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
            case 'wait':
                log.logSystem(`${self.name} 结束`, tMs)
                break
        }
        return r
    }

    endEvent(): void {
        const { turn, player, opponent } = this.state
        const id = this.state.eventActorId
        if (!id) return
        const actor = id === player.id ? player : opponent
        const enemy = id === player.id ? opponent : player
        const stats = WEAPONS.fist
        const tMs = turn.peek()?.nextActionAt ?? 0
        tryBonus(this, actor, 'before_turn_end')
        this.emit('turn_end', actor, enemy, tMs)
        turn.next()
        turn.scheduleNext(actor.id, calcTurnInterval(actor.attrs.get('dexterity'), stats.preDelay, stats.stunTime))
        this.state.eventActorId = null
    }
}

// ── 时机驱动的辅招系统 ──

/** 应用一个 triggerEffect（或数组）到角色身上 */
export function applyTriggerEffect(
    e: BonusTriggerEffect | BonusTriggerEffect[] | undefined,
    self: Character,
    engine: BattleEngine,
    actionName?: string,
): void {
    if (!e) return
    if (Array.isArray(e)) {
        for (const eff of e) applyTriggerEffect(eff, self, engine, actionName)
        return
    }
    const tag = actionName ?? '功法'
    const tMs = engine.state.turn.peek()?.nextActionAt ?? 0
    const actorName = self.name
    switch (e.type) {
        case 'stat_multiply': {
            const attr = e.stat as AttrName
            const old = self.attrs.get(attr)
            self.attrs.set(attr, old * e.multiplier)
            engine.state.log.logSystem(`[${tag}] ${self.name} ${e.stat} ${old}→${old * e.multiplier}!`, tMs, actorName)
            // 调度 buff 消失事件
            {
                const attrVal = self.attrs.get(e.duration.attr)
                const buffDuration = Math.round(attrVal * e.duration.multiplier)
                const buffKey = `qi_gather_${self.id}`
                engine.state.pendingBuffs.set(buffKey, { restoreValue: old })
                engine.state.turn.scheduleSystemEventAt(`buff_end_${buffKey}`, engine.state.turn.currentTime + buffDuration)
            }
            break
        }
        case 'stat_buff': {
            const entries = Object.entries(e.attrs) as [AttrName, number][]
            const desc = entries.map(([s, v]) => `${s}+${v}`).join(' ')
            for (const [attr, value] of entries) self.attrs.modify(attr, value)
            engine.state.log.logSystem(`[${tag}] ${self.name} ${desc}`, tMs, actorName)
            // 非 stat_multiply 类型的 buff 不需要调度恢复事件
            break
        }
        case 'stat_restore': {
            const attr = e.stat as AttrName
            const old = self.attrs.get(attr)
            self.attrs.set(attr, e.value)
            engine.state.log.logSystem(`[${tag}] ${self.name} ${e.stat} ${old}→恢复${e.value}`, tMs, actorName)
            break
        }
    }
}

/** 处理系统事件（buff 到期等） */
export function handleSystemEvent(engine: BattleEngine, eventId: string): void {
    const { log, turn, pendingBuffs } = engine.state
    // buff_end_qi_gather_p1
    if (eventId.startsWith('buff_end_qi_gather_')) {
        const charId = eventId.replace('buff_end_qi_gather_', '')
        const char = charId === engine.state.player.id ? engine.state.player : engine.state.opponent
        const buffKey = `qi_gather_${charId}`
        const data = pendingBuffs.get(buffKey)
        if (data) {
            applyTriggerEffect(
                { type: 'stat_restore', stat: 'strength', value: data.restoreValue },
                char,
                engine,
                '聚炁',
            )
            pendingBuffs.delete(buffKey)
        }
    }
}

/** 在指定时机遍历角色所有 actionInstances，触发匹配的辅招被动 */
export function tryBonus(engine: BattleEngine, self: Character, timing: BonusTiming, mainAp = 0): boolean {
    let fired = false
    for (const inst of self.actionInstances) {
        if (!inst.def.bonus || inst.def.bonusTiming !== timing) continue
        if (!inst.canUse()) continue
        if (self.ap < inst.apCost + mainAp) continue
        self.spendAp(inst.apCost)
        inst.use()
        applyTriggerEffect(inst.def.triggerEffect, self, engine, inst.name)
        fired = true
    }
    return fired
}
