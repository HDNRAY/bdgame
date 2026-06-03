import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import type { WeaponType } from '../calc/damage'
import { WEAPONS, calcHitChance, calcParryChance, calcDodgeChance, calcTurnInterval } from '../calc/damage'
import { resolveAction, canExecuteAction } from '../calc/action-executor'
import { getAction } from '../data/actions'
import type { TriggerEvent, TriggerDefinition } from '../entities/trigger'
import { getTrigger } from '../data/triggers'
import { processTriggers } from './trigger-system'
import { createBleed, triggerBleed } from '../entities/status'
import { getForgingBuffs } from '../data/forging'

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
}

export class BattleEngine {
    state!: BattleState

    constructor(p: Character, o: Character, d = 4) {
        this.init(p, o, d)
    }

    init(p: Character, o: Character, d = 4): void {
        p.resetAp()
        o.resetAp()
        const log = new BattleLog()
        const tm = new TurnManager()
        tm.addCharacter(p, 0)
        tm.addCharacter(o, 0)
        log.logBattleStart(p.name, o.name, 0)
        // 锻体 buff（数据驱动）
        if (p.forgingLevel > 0) {
            const buffs = getForgingBuffs(p.forgingLevel)
            for (const b of buffs) { (p.attrs as any).modify(b.stat, b.value) }
            log.logSystem(`[锻体] ${p.name} Lv.${p.forgingLevel}: ${buffs.map(b => `${b.stat}+${b.value}`).join(' ')}`, 0)
        }
        this.state = {
            phase: 'fighting',
            player: p,
            opponent: o,
            distance: new DistanceSystem(d),
            turn: tm,
            log,
            eventActorId: null,
            triggerUses: new Map(),
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
        const self = e.characterId === this.state.player.id ? this.state.player : this.state.opponent
        self.resetAp()
        this.state.opponent.resetAp()
        this.emit(
            'turn_start',
            self,
            this.state.player.id === e.characterId ? this.state.opponent : this.state.player,
            e.nextActionAt,
        )
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
                if (!self.spendAp(ap)) {
                    log.logSystem(`${self.name} AP不足 无法移动`, tMs)
                    break
                }
                const a = distance.move(cmd.bestDistance ?? 0)
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
                r.parried = Math.random() < pc
                if (r.parried) {
                    log.logParry(self.name, enemy.name, tMs)
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
                            const existing = enemy.statuses.find((s) => s.type === eff.status)
                            if (existing) {
                                existing.stacks += eff.stacks
                                log.logSystem(`[${eff.status}] ${enemy.name} 叠${existing.stacks}层`, tMs)
                            } else if (eff.status === 'bleed') {
                                enemy.statuses.push(createBleed(eff.stacks, 3, self.name))
                                log.logSystem(`[bleed] ${enemy.name} 流血${eff.stacks}层`, tMs)
                            }
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
        this.emit('turn_end', actor, enemy, tMs)
        turn.next()
        turn.scheduleNext(actor.id, calcTurnInterval(actor.attrs.get('dexterity'), stats.preDelay, stats.stunTime))
        this.state.eventActorId = null
    }
}
