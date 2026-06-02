import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager } from './turn'
import { BattleLog } from './battle-log'
import type { WeaponType } from '../calc/damage'
import {
    WEAPONS, calcBaseDamage, calcDistanceMultiplier, calcCritChance,
    calcFinalDamage, calcHitChance, calcParryChance, calcDodgeChance,
} from '../calc/damage'

export interface ActionCommand {
    type: 'attack' | 'move' | 'defend' | 'wait'
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

/** 战斗引擎 */
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

        this.state = {
            phase: 'fighting',
            player,
            opponent,
            distance: new DistanceSystem(startDistance),
            turn: tm,
            log,
            round: 1,
        }
    }

    /** 执行一个行动 */
    execute(cmd: ActionCommand): ActionResult {
        const { player, opponent, distance, turn, log } = this.state
        const actor = turn.peek()!
        const isPlayer = actor.characterId === player.id
        const self = isPlayer ? player : opponent
        const enemy = isPlayer ? opponent : player

        const result: ActionResult = {
            damage: 0,
            hit: false,
            parried: false,
            dodged: false,
            crit: false,
            distanceDelta: 0,
        }

        switch (cmd.type) {
            case 'move': {
                const delta = cmd.bestDistance ?? 0
                const actual = distance.move(delta)
                result.distanceDelta = actual
                log.logMove(self.name, actual, distance.current)
                break
            }

            case 'attack': {
                const weapon = cmd.weaponType ?? 'fist'
                const stats = WEAPONS[weapon]
                const bestDist = cmd.bestDistance ?? stats.range[0]

                // 距离检测
                if (!distance.inRange(stats.range[0], stats.range[1])) {
                    log.logSystem(`${self.name} 距离不合适 (${distance.current}/${stats.range[0]}-${stats.range[1]})`)
                    break
                }

                log.logAttack(self.name, enemy.name, weapon)

                // 命中判定
                const hitChance = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                const hitRoll = Math.random()
                result.hit = hitRoll < hitChance
                log.logHitCheck(self.name, enemy.name, hitChance, hitRoll, result.hit)

                if (!result.hit) break

                // 闪避判定
                const dodgeChance = calcDodgeChance(enemy.attrs.get('dexterity'))
                result.dodged = Math.random() < dodgeChance

                if (result.dodged) {
                    log.logDodge(self.name, enemy.name)
                    break
                }

                // 招架判定
                const parryChance = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                result.parried = Math.random() < parryChance
                if (result.parried) log.logParry(self.name, enemy.name)

                // 伤害计算
                const base = calcBaseDamage(stats.attrScaling, self.attrs.getAll())
                const distMult = calcDistanceMultiplier(distance.current, bestDist)
                result.crit = Math.random() < calcCritChance(self.attrs.get('technique'))

                const finalDamage = calcFinalDamage(base, distMult, result.crit)
                const blocked = result.parried ? finalDamage - Math.round(finalDamage * 0.4) : 0
                const actualDamage = result.parried ? Math.round(finalDamage * 0.4) : finalDamage

                enemy.takeDamage(actualDamage)
                result.damage = actualDamage

                log.logDamage(self.name, enemy.name, base, distMult, result.crit, result.parried, actualDamage, blocked)

                if (!enemy.isAlive()) {
                    log.logDefeat(enemy.name, self.name)
                    this.state.phase = 'finished'
                }
                break
            }

            case 'defend':
                log.logSystem(`${self.name} 进入防御姿态`)
                break

            case 'wait':
                log.logSystem(`${self.name} 选择等待`)
                break
        }

        this.advanceTurn(self, cmd.weaponType)
        return result
    }

    private advanceTurn(actor: Character, weaponType: WeaponType = 'fist'): void {
        const { turn } = this.state
        const stats = WEAPONS[weaponType]
        turn.next()
        turn.scheduleNext(actor.id, stats.stunTime + stats.preDelay)
        if (this.state.phase === 'fighting') {
            this.state.round++
        }
    }
}
