import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import type { WeaponType } from '../calc/damage'
import { WEAPONS, calcHitChance, calcParryChance, calcDodgeChance } from '../calc/damage'
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
    round: number
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
        log.logBattleStart(player.name, opponent.name)
        const tm = new TurnManager()
        tm.addCharacter(player, 0)
        tm.addCharacter(opponent, 0)
        this.state = { phase: 'fighting', player, opponent, distance: new DistanceSystem(startDistance), turn: tm, log, round: 1 }
    }

    execute(cmd: ActionCommand): ActionResult {
        const { player, opponent, distance, turn, log } = this.state
        const actor = turn.peek()!
        const isPlayer = actor.characterId === player.id
        const self = isPlayer ? player : opponent
        const enemy = isPlayer ? opponent : player

        const result: ActionResult = { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }

        switch (cmd.type) {
            case 'move': {
                const delta = cmd.bestDistance ?? 0
                const actual = distance.move(delta)
                result.distanceDelta = actual
                log.logMove(self.name, actual, distance.current, 0, self.ap)
                break
            }

            case 'attack': {
                // 查找招式定义
                const action = cmd.actionId ? getAction(cmd.actionId) : undefined
                const weapon = cmd.weaponType ?? 'fist'
                const actionName = action?.name ?? weapon

                // 条件检测
                if (action) {
                    const check = canExecuteAction(action, self, distance.current)
                    if (!check.ok) {
                        log.logSystem(`${self.name} [${actionName}] ${check.reason}`)
                        break
                    }
                }

                if (!self.spendAp(action?.apCost ?? 0)) {
                    log.logSystem(`${self.name} AP不足`)
                    break
                }

                // 距离检测（武器范围）
                const stats = WEAPONS[weapon]
                if (!distance.inRange(stats.range[0], stats.range[1])) {
                    log.logSystem(`${self.name} 距离不合适`)
                    break
                }

                log.logAttack(self.name, enemy.name, weapon, action?.apCost ?? 0, self.ap, actionName)

                // 命中判定
                const hitChance = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                result.hit = Math.random() < hitChance
                log.logHitCheck(self.name, enemy.name, hitChance, Math.random(), result.hit)
                if (!result.hit) break

                // 闪避
                result.dodged = Math.random() < calcDodgeChance(enemy.attrs.get('dexterity'))
                if (result.dodged) { log.logDodge(self.name, enemy.name); break }

                // 招架
                const parryChance = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                result.parried = Math.random() < parryChance
                if (result.parried) log.logParry(self.name, enemy.name)

                // 伤害计算
                const resolved = action
                    ? resolveAction(action, self, enemy, distance.current)
                    : resolveAction({ id: 'basic', name: weapon, weaponType: weapon, apCost: 0, bestDistance: 1, tags: [], effects: [{ type: 'damage', scaling: stats.attrScaling }] }, self, enemy, distance.current)

                const finalDamage = result.parried ? Math.round(resolved.final * 0.4) : resolved.final
                const blocked = resolved.final - finalDamage
                enemy.takeDamage(finalDamage)
                result.damage = finalDamage
                result.crit = resolved.isCrit

                // 自伤
                if (resolved.selfDamage > 0) {
                    self.takeDamage(resolved.selfDamage)
                }

                log.logDamage(self.name, enemy.name, resolved.base, resolved.distanceMult, resolved.isCrit, result.parried, finalDamage, blocked)

                // 击退
                if (resolved.knockbackDistance > 0) {
                    distance.move(resolved.knockbackDistance)
                }

                if (!enemy.isAlive()) {
                    log.logDefeat(enemy.name, self.name)
                    this.state.phase = 'finished'
                }
                break
            }

            case 'defend':
                log.logSystem(`${self.name} 防御`)
                break

            case 'wait':
                log.logSystem(`${self.name} 等待`)
                break
        }

        this.advanceTurn(self, cmd.weaponType)
        return result
    }

    private advanceTurn(actor: Character, weaponType: WeaponType = 'fist'): void {
        const { turn, player } = this.state
        const stats = WEAPONS[weaponType]
        turn.next()
        turn.scheduleNext(actor.id, stats.stunTime + stats.preDelay)

        // 当下一行动者是玩家时，重置双方 AP（新的一轮）
        const next = turn.peek()
        if (next && next.characterId === player.id) {
            this.state.round++
            this.state.player.resetAp()
            this.state.opponent.resetAp()
        }
    }
}
