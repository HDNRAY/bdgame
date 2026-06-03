import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import type { WeaponType } from '../calc/damage'
import { WEAPONS, calcHitChance, calcParryChance, calcDodgeChance, calcTurnInterval } from '../calc/damage'
import { resolveAction, canExecuteAction } from '../calc/action-executor'
import { getAction } from '../data/actions'

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
    eventActorId: string | null // 当前 event 的行动者
}

export class BattleEngine {
    state!: BattleState

    constructor(player: Character, opponent: Character, startDistance = 4) {
        this.init(player, opponent, startDistance)
    }

    init(player: Character, opponent: Character, startDistance = 4): void {
        player.resetAp()
        opponent.resetAp()
        const log = new BattleLog()
        const tm = new TurnManager()
        tm.addCharacter(player, 0)
        tm.addCharacter(opponent, 0)
        log.logBattleStart(player.name, opponent.name, 0)
        this.state = {
            phase: 'fighting',
            player,
            opponent,
            distance: new DistanceSystem(startDistance),
            turn: tm,
            log,
            eventActorId: null,
        }
    }

    /** 开始一个新的 event（一个角色在一时间点的连续行动） */
    startEvent(): boolean {
        const { turn, player, opponent, log } = this.state
        const entry = turn.peek()
        if (!entry) return false

        this.state.eventActorId = entry.characterId
        const self = entry.characterId === player.id ? player : opponent
        self.resetAp()
        opponent.resetAp() // 双方都重置 AP（新 event 开始）
        return true
    }

    /** 在当前 event 中执行一个行动 */
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
                const delta = cmd.bestDistance ?? 0
                const apCost = Math.abs(delta) // 1 AP per range
                if (!self.spendAp(apCost)) {
                    log.logSystem(`${self.name} AP不足 无法移动`, tMs)
                    break
                }
                const actual = distance.move(delta)
                r.distanceDelta = actual
                log.logMove(self.name, actual, distance.current, apCost, self.ap, tMs)
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
                const hc = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                r.hit = Math.random() < hc
                log.logHitCheck(self.name, enemy.name, hc, Math.random(), r.hit, tMs)
                if (!r.hit) break
                r.dodged = Math.random() < calcDodgeChance(enemy.attrs.get('dexterity'))
                if (r.dodged) {
                    log.logDodge(self.name, enemy.name, tMs)
                    break
                }
                const pc = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                r.parried = Math.random() < pc
                if (r.parried) log.logParry(self.name, enemy.name, tMs)
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

    /** 结束当前 event，将行动者排入时间轴 */
    endEvent(): void {
        const { turn, player, opponent } = this.state
        const actorId = this.state.eventActorId
        if (!actorId) return
        const actor = actorId === player.id ? player : opponent
        const wep = actorId === player.id ? ('fist' as const) : ('fist' as const)
        const stats = WEAPONS[wep]
        turn.next()
        turn.scheduleNext(actor.id, calcTurnInterval(actor.attrs.get('dexterity'), stats.preDelay, stats.stunTime))
        this.state.eventActorId = null
    }
}
