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
    damage: number; hit: boolean; parried: boolean; dodged: boolean; crit: boolean; distanceDelta: number
}

export type BattlePhase = 'idle' | 'fighting' | 'finished'

export interface BattleState {
    phase: BattlePhase
    player: Character
    opponent: Character
    distance: DistanceSystem
    turn: TurnManager
    log: BattleLog
}

const t = (e: { turn: TurnManager }) => e.turn.currentTime

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
        this.state = { phase: 'fighting', player, opponent, distance: new DistanceSystem(startDistance), turn: tm, log }
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
                log.logMove(self.name, actual, distance.current, 0, self.ap, turn.currentTime)
                break
            }

            case 'attack': {
                const action = cmd.actionId ? getAction(cmd.actionId) : undefined
                const weapon = cmd.weaponType ?? 'fist'
                const actionName = action?.name ?? weapon

                if (action) {
                    const check = canExecuteAction(action, self, distance.current)
                    if (!check.ok) { log.logSystem(`${self.name} ${check.reason}`, turn.currentTime); break }
                }
                if (!self.spendAp(action?.apCost ?? 0)) { log.logSystem(`${self.name} AP不足`, turn.currentTime); break }

                const stats = WEAPONS[weapon]
                if (!distance.inRange(stats.range[0], stats.range[1])) {
                    log.logSystem(`${self.name} 距离不合适`, turn.currentTime); break
                }

                log.logAttack(self.name, enemy.name, weapon, action?.apCost ?? 0, self.ap, turn.currentTime, actionName)

                const hitChance = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                result.hit = Math.random() < hitChance
                log.logHitCheck(self.name, enemy.name, hitChance, Math.random(), result.hit, turn.currentTime)
                if (!result.hit) break

                result.dodged = Math.random() < calcDodgeChance(enemy.attrs.get('dexterity'))
                if (result.dodged) { log.logDodge(self.name, enemy.name, turn.currentTime); break }

                const parryChance = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                result.parried = Math.random() < parryChance
                if (result.parried) log.logParry(self.name, enemy.name, turn.currentTime)

                const resolved = action
                    ? resolveAction(action, self, enemy, distance.current)
                    : resolveAction({ id: 'basic', name: weapon, weaponType: weapon, apCost: 0, bestDistance: 1, tags: [], effects: [{ type: 'damage', scaling: stats.attrScaling }] }, self, enemy, distance.current)

                const finalDamage = result.parried ? Math.round(resolved.final * 0.4) : resolved.final
                const blocked = resolved.final - finalDamage
                enemy.takeDamage(finalDamage)
                result.damage = finalDamage
                result.crit = resolved.isCrit

                if (resolved.selfDamage > 0) self.takeDamage(resolved.selfDamage)
                log.logDamage(self.name, enemy.name, resolved.base, resolved.distanceMult, resolved.isCrit, result.parried, finalDamage, blocked, turn.currentTime)
                if (resolved.knockbackDistance > 0) distance.move(resolved.knockbackDistance)

                if (!enemy.isAlive()) {
                    log.logDefeat(enemy.name, self.name, turn.currentTime)
                    this.state.phase = 'finished'
                }
                break
            }

            case 'defend': log.logSystem(`${self.name} 防御`, turn.currentTime); break
            case 'wait':   log.logSystem(`${self.name} 等待`, turn.currentTime); break
        }

        this.advanceTurn(self, cmd.weaponType)
        return result
    }

    private advanceTurn(actor: Character, weaponType: WeaponType = 'fist'): void {
        const { turn, player, log } = this.state
        const stats = WEAPONS[weaponType]
        // 行动间隔 = 身法基础间隔 + 武器前摇硬直
        // 基础 1000ms，每点身法 -30ms，最低 200ms
        const dexInterval = Math.max(200, 1000 - actor.attrs.get('dexterity') * 30)
        const totalDelay = dexInterval + stats.preDelay + stats.stunTime
        turn.next()
        turn.scheduleNext(actor.id, totalDelay)
        const next = turn.peek()
        if (next && next.characterId === player.id) {
            log.logSystem(`── 新轮 ──`, turn.currentTime)
            this.state.player.resetAp()
            this.state.opponent.resetAp()
        }
    }
}
