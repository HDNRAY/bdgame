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

export interface ActionResult { damage: number; hit: boolean; parried: boolean; dodged: boolean; crit: boolean; distanceDelta: number }
export type BattlePhase = 'idle' | 'fighting' | 'finished'

export interface BattleState {
    phase: BattlePhase
    player: Character
    opponent: Character
    distance: DistanceSystem
    turn: TurnManager
    log: BattleLog
    needsReset: boolean
}

export class BattleEngine {
    state!: BattleState

    constructor(player: Character, opponent: Character, startDistance = 4) { this.init(player, opponent, startDistance) }

    init(player: Character, opponent: Character, startDistance = 4): void {
        player.resetAp(); opponent.resetAp()
        const log = new BattleLog()
        const tm = new TurnManager()
        tm.addCharacter(player, 0); tm.addCharacter(opponent, 0)
        log.logBattleStart(player.name, opponent.name, 0)
        this.state = { phase: 'fighting', player, opponent, distance: new DistanceSystem(startDistance), turn: tm, log, needsReset: false }
    }

    execute(cmd: ActionCommand): ActionResult {
        const { player, opponent, distance, turn, log } = this.state
        const actor = turn.peek()!
        const tMs = actor.nextActionAt  // 用当前行动者的时间轴时间
        const isPlayer = actor.characterId === player.id
        const self = isPlayer ? player : opponent
        const enemy = isPlayer ? opponent : player

        const r: ActionResult = { damage: 0, hit: false, parried: false, dodged: false, crit: false, distanceDelta: 0 }

        if (this.state.needsReset) {
            this.state.needsReset = false
            this.state.player.resetAp()
            this.state.opponent.resetAp()
        }

        switch (cmd.type) {
            case 'move': {
                const delta = cmd.bestDistance ?? 0
                const actual = distance.move(delta)
                r.distanceDelta = actual
                log.logMove(self.name, actual, distance.current, 0, self.ap, tMs)
                break
            }

            case 'attack': {
                const action = cmd.actionId ? getAction(cmd.actionId) : undefined
                const weapon = cmd.weaponType ?? 'fist'
                const an = action?.name ?? weapon

                if (action) { const c = canExecuteAction(action, self, distance.current); if (!c.ok) { log.logSystem(`${self.name} ${c.reason}`, tMs); break } }
                if (!self.spendAp(action?.apCost ?? 0)) { log.logSystem(`${self.name} AP不足`, tMs); break }

                const stats = WEAPONS[weapon]
                if (!distance.inRange(stats.range[0], stats.range[1])) { log.logSystem(`${self.name} 距离不合适`, tMs); break }

                log.logAttack(self.name, enemy.name, weapon, action?.apCost ?? 0, self.ap, tMs, an)

                const hc = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
                r.hit = Math.random() < hc
                log.logHitCheck(self.name, enemy.name, hc, Math.random(), r.hit, tMs)
                if (!r.hit) break

                r.dodged = Math.random() < calcDodgeChance(enemy.attrs.get('dexterity'))
                if (r.dodged) { log.logDodge(self.name, enemy.name, tMs); break }

                const pc = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
                r.parried = Math.random() < pc
                if (r.parried) log.logParry(self.name, enemy.name, tMs)

                const resolved = action
                    ? resolveAction(action, self, enemy, distance.current)
                    : resolveAction({ id: 'basic', name: weapon, weaponType: weapon, apCost: 0, bestDistance: 1, tags: [], effects: [{ type: 'damage', scaling: stats.attrScaling }] }, self, enemy, distance.current)

                const finalDmg = r.parried ? Math.round(resolved.final * 0.4) : resolved.final
                const blocked = resolved.final - finalDmg
                enemy.takeDamage(finalDmg); r.damage = finalDmg; r.crit = resolved.isCrit

                if (resolved.selfDamage > 0) self.takeDamage(resolved.selfDamage)
                log.logDamage(self.name, enemy.name, resolved.base, resolved.distanceMult, resolved.isCrit, r.parried, finalDmg, blocked, tMs)
                if (resolved.knockbackDistance > 0) distance.move(resolved.knockbackDistance)

                if (!enemy.isAlive()) { log.logDefeat(enemy.name, self.name, tMs); this.state.phase = 'finished' }
                break
            }

            case 'defend': log.logSystem(`${self.name} 防御`, tMs); break
            case 'wait': log.logSystem(`${self.name} 等待`, tMs); break
        }

        this.advanceTurn(self, cmd.weaponType)
        return r
    }

    private advanceTurn(actor: Character, weaponType: WeaponType = 'fist'): void {
        const { turn, player } = this.state
        const stats = WEAPONS[weaponType]
        const dexInterval = Math.max(200, 1000 - actor.attrs.get('dexterity') * 30)
        turn.next()
        turn.scheduleNext(actor.id, dexInterval + stats.preDelay + stats.stunTime)
        const next = turn.peek()
        if (next && next.characterId === player.id) this.state.needsReset = true
    }
}
