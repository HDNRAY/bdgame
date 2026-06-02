import { Character } from '../entities/character'
import { DistanceSystem } from './distance'
import { TurnManager } from './turn-manager'
import { BattleLog } from './battle-log'
import {
    WEAPONS, calcBaseDamage, calcDistanceMultiplier, calcCritChance,
    calcFinalDamage, calcHitChance, calcParryChance, calcDodgeChance,
    WeaponType,
} from './damage'

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
    log: string[]
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
        log.add(`⚔️ ${player.name} VS ${opponent.name}`, 'system')

        const tm = new TurnManager()
        const pDelay = 0  // 第一回合同时行动
        const oDelay = 0
        tm.addCharacter(player, pDelay)
        tm.addCharacter(opponent, oDelay)

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
            log: [],
        }

        switch (cmd.type) {
            case 'move': {
                const delta = cmd.bestDistance ?? 0  // 正=后退 负=前进
                const actual = distance.move(delta)
                result.distanceDelta = actual
                result.log.push(`${self.name} 移动了 ${Math.abs(actual)} 档`)
                log.add(`${self.name} 移动了 ${Math.abs(actual)} 档 (→${distance.current})`, 'move')
                break
            }

            case 'attack': {
                const weapon = cmd.weaponType ?? 'fist'
                const stats = WEAPONS[weapon]
                const bestDist = cmd.bestDistance ?? stats.range[0]

                // 距离检测
                if (!distance.inRange(stats.range[0], stats.range[1])) {
                    result.log.push(`${self.name} 距离不合适，无法攻击`)
                    log.add(`${self.name} 距离不合适 (${distance.current}/${stats.range[0]}-${stats.range[1]})`, 'combat')
                    break
                }

                // 命中判定
                const hitChance = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                const hitRoll = Math.random()
                result.hit = hitRoll < hitChance

                if (!result.hit) {
                    result.log.push(`${self.name} 的攻击未命中！`)
                    log.add(`${self.name} 的攻击未命中 (需${(hitChance * 100).toFixed(0)}% 骰${(hitRoll * 100).toFixed(0)}%)`, 'combat', '#ff3355')
                    break
                }

                // 闪避判定
                const dodgeChance = calcDodgeChance(enemy.attrs.get('dexterity'))
                const dodgeRoll = Math.random()
                result.dodged = dodgeRoll < dodgeChance

                if (result.dodged) {
                    result.log.push(`${enemy.name} 闪避了攻击！`)
                    log.add(`${enemy.name} 闪避了攻击`, 'combat')
                    break
                }

                // 招架判定
                const parryChance = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                const parryRoll = Math.random()
                result.parried = parryRoll < parryChance

                // 伤害计算
                const base = calcBaseDamage(stats.attrScaling, self.attrs.getAll())
                const distMult = calcDistanceMultiplier(distance.current, bestDist)
                const critChance = calcCritChance(self.attrs.get('technique'))
                result.crit = Math.random() < critChance

                const finalDamage = calcFinalDamage(base, distMult, result.crit)
                const actualDamage = result.parried ? Math.round(finalDamage * 0.4) : finalDamage  // 招架减伤 60%

                enemy.takeDamage(actualDamage)
                result.damage = actualDamage

                // 日志
                const logParts = [`${self.name} 使用了 ${cmd.weaponType ?? '拳脚'}`]
                if (result.parried) logParts.push('(被招架)')
                if (result.crit) logParts.push('💥暴击!')
                logParts.push(`→ ${actualDamage} 伤害`)
                if (result.parried) logParts.push(`(减伤 ${finalDamage - actualDamage})`)

                result.log.push(logParts.join(' '))
                log.add(`${self.name} ${result.crit ? '💥' : ''}${result.parried ? '🛡' : ''} → ${enemy.name} ${actualDamage}伤害${result.crit ? ' 暴击!' : ''}`, 'combat')

                if (!enemy.isAlive()) {
                    log.add(`🏆 ${enemy.name} 被击败！`, 'system')
                    this.state.phase = 'finished'
                }
                break
            }

            case 'defend': {
                result.log.push(`${self.name} 进入防御姿态`)
                log.add(`${self.name} 进入防御姿态`, 'system')
                break
            }

            case 'wait': {
                result.log.push(`${self.name} 选择等待`)
                log.add(`${self.name} 选择等待`, 'system')
                break
            }
        }

        // 推进回合
        this.advanceTurn(self, cmd.weaponType)

        return result
    }

    private advanceTurn(actor: Character, weaponType: WeaponType = 'fist'): void {
        const { turn } = this.state
        const stats = WEAPONS[weaponType]
        const delay = stats.stunTime + stats.preDelay
        // 先弹出当前行动者
        turn.next()
        // 再将其重新排入队列（带硬直延迟）
        turn.scheduleNext(actor.id, delay)

        // 简单回合计数：每轮行动过半圈算一回合
        if (this.state.phase === 'fighting') {
            this.state.round++
        }
    }

    /** 快速模拟一场战斗（用于测试） */
    static simulate(player: Character, opponent: Character): { winner: string; log: BattleLog } {
        const engine = new BattleEngine(player, opponent)
        const { state } = engine

        while (state.phase === 'fighting') {
            const actor = state.turn.peek()
            if (!actor) break

            const isPlayer = actor.characterId === player.id
            const self = isPlayer ? player : opponent
            const enemy = isPlayer ? opponent : player

            // 简单 AI：如果在范围内就攻击，否则靠近
            const weapon: WeaponType = 'fist'
            const stats = WEAPONS[weapon]

            if (state.distance.inRange(stats.range[0], stats.range[1])) {
                engine.execute({ type: 'attack', weaponType: weapon, bestDistance: 1 })
            } else {
                const dir = state.distance.current > stats.range[1] ? -1 : 1
                engine.execute({ type: 'move', bestDistance: dir })
            }
        }

        const winner = player.isAlive() ? player.name : opponent.name
        return { winner, log: state.log }
    }
}
