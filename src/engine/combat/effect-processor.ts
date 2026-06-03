import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import type { ActionEffect } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import { calcBaseDamage } from '../calc/damage'
import { createBleed, createPoison } from '../entities/status'

/** 处理一个 ActionEffect（engine 不包含具体效果名称） */
export function processActionEffect(
    eff: ActionEffect,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
    tMs: number,
): void {
    const { log, turn, distance } = engine.state
    switch (eff.type) {
        case 'counter_damage': {
            const scaling: Partial<Record<AttrName, number>> = { strength: 1.0 }
            const base = calcBaseDamage(scaling, self.attrs.getAll())
            const dmg = Math.round(base * eff.ratio)
            enemy.takeDamage(dmg)
            log.logSystem(`[反击] ${self.name} 反击 ${enemy.name} ${dmg} 伤害`, tMs)
            break
        }
        case 'modify_turn':
            turn.modifyTime(enemy.id, eff.deltaMs)
            break
        case 'cleanse':
            self.statuses = self.statuses.filter((s) => s.type !== 'stun' && s.type !== 'paralyze')
            break
        case 'status': {
            const sc = eff.chance ?? 0.5
            const roll = Math.random()
            if (!(roll < sc)) {
                log.logSystem(`[${eff.status}] 概率${(sc * 100).toFixed(0)}% 骰${(roll * 100).toFixed(0)}% 未命中`, tMs)
                return
            }
            log.logSystem(`[${eff.status}] 概率${(sc * 100).toFixed(0)}% 骰${(roll * 100).toFixed(0)}% 命中`, tMs)
            const existing = enemy.statuses.find((s) => s.type === eff.status)
            if (existing) {
                existing.stacks += eff.stacks
            } else if (eff.status === 'bleed') {
                enemy.statuses.push(createBleed(eff.stacks, 1, self.name))
            } else if (eff.status === 'poison') {
                enemy.statuses.push(createPoison(eff.stacks, self.name))
            } else if (eff.status === 'stagger' || eff.status === 'paralyze') {
                enemy.statuses.push({ type: eff.status, stacks: eff.stacks, source: self.name } as any)
            }
            const target = enemy.statuses.find((s) => s.type === eff.status)
            log.logSystem(`[${eff.status}] ${enemy.name} ${target ? target.stacks : eff.stacks}层`, tMs)
            break
        }
        case 'knockback':
            if (eff.distance > 0) distance.move(eff.distance)
            break
    }
}
