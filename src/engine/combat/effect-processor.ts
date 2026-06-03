import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import type { ActionEffect } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import type { StatusInstance, StatusType } from '../entities/status'
import { calcBaseDamage } from '../calc/damage'
import { createBleed, createBurn, createPoison } from '../entities/status'

// ── Context 类型 ──
interface Ctx {
    eff: ActionEffect
    self: Character
    enemy: Character
    engine: BattleEngine
    tMs: number
}

interface StatusCtx {
    eff: ActionEffect & { type: 'status' }
    self: Character
    enemy: Character
    engine: BattleEngine
    tMs: number
    existing: StatusInstance | undefined
    st: StatusType
}

// ── 效果分发表 ──
const effectHandlers: Record<string, (ctx: Ctx) => void> = {
    counter_damage({ eff, self, enemy, engine, tMs }: Ctx) {
        const { ratio } = eff as Extract<ActionEffect, { type: 'counter_damage' }>
        const scaling: Partial<Record<AttrName, number>> = { strength: 1.0 }
        const base = calcBaseDamage(scaling, self.attrs.getAll())
        const dmg = Math.round(base * ratio)
        enemy.takeDamage(dmg)
        engine.state.log.logSystem(`[反击] ${self.name} 反击 ${enemy.name} ${dmg} 伤害`, tMs)
    },
    modify_turn({ eff, enemy, engine }: Ctx) {
        const { deltaMs } = eff as Extract<ActionEffect, { type: 'modify_turn' }>
        engine.state.turn.modifyTime(enemy.id, deltaMs)
    },
    knockback({ eff, engine }: Ctx) {
        const { distance } = eff as Extract<ActionEffect, { type: 'knockback' }>
        if (distance > 0) engine.state.distance.move(distance)
    },
    status({ eff, self, enemy, engine, tMs }: Ctx) {
        handleStatusEffect({ eff: eff as Extract<ActionEffect, { type: 'status' }>, self, enemy, engine, tMs })
    },
}

// ── Status 子分发表 ──
const statusHandlers: Record<string, (ctx: StatusCtx) => void> = {
    bleed({ eff: { stacks }, self: { name }, enemy, existing }: StatusCtx) {
        if (!existing) enemy.statuses.push(createBleed(stacks, 1, name))
    },
    poison({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing }: StatusCtx) {
        if (!existing) {
            enemy.statuses.push(createPoison(stacks, name))
            engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + 2000)
        }
    },
    burn({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing }: StatusCtx) {
        if (!existing) {
            enemy.statuses.push(createBurn(stacks, 5, name))
            engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000)
        }
    },
    paralyze({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing }: StatusCtx) {
        const totalStacks = (existing?.stacks ?? 0) + stacks
        const dexDebuff = totalStacks * 3
        const insDebuff = totalStacks * 2
        if (!existing) {
            const oldDex = enemy.attrs.get('dexterity')
            const oldIns = enemy.attrs.get('insight')
            enemy.attrs.set('dexterity', oldDex - dexDebuff)
            enemy.attrs.set('insight', oldIns - insDebuff)
            engine.state.pendingBuffs.set(`paralyze_dex::${enemy.id}`, { restoreValue: oldDex, stat: 'dexterity' })
            engine.state.pendingBuffs.set(`paralyze_ins::${enemy.id}`, { restoreValue: oldIns, stat: 'insight' })
            enemy.statuses.push({ type: 'paralyze', stacks, source: name })
        } else {
            const origDex =
                engine.state.pendingBuffs.get(`paralyze_dex::${enemy.id}`)?.restoreValue ?? enemy.attrs.get('dexterity')
            const origIns =
                engine.state.pendingBuffs.get(`paralyze_ins::${enemy.id}`)?.restoreValue ?? enemy.attrs.get('insight')
            enemy.attrs.set('dexterity', origDex - dexDebuff)
            enemy.attrs.set('insight', origIns - insDebuff)
        }
        const duration = 3000
        engine.state.turn.scheduleSystemEventAt(`buff_end_paralyze_dex::${enemy.id}`, tMs + duration)
        engine.state.turn.scheduleSystemEventAt(`buff_end_paralyze_ins::${enemy.id}`, tMs + duration)
        engine.state.log.logSystem(`[麻痹] ${enemy.name} 身法-${dexDebuff} 洞察-${insDebuff}`, tMs)
    },
    stun({ eff: { stacks }, self: { name }, enemy, existing }: StatusCtx) {
        if (!existing) {
            enemy.statuses.push({
                type: 'stun',
                stacks,
                source: name,
                skipTurn: true,
                rescheduleDelay: 2000,
            })
        }
    },
}

function handleStatusEffect(ctx: Omit<StatusCtx, 'existing' | 'st'>): void {
    const { eff, self, enemy, engine, tMs } = ctx
    const { log } = engine.state
    const sc = eff.chance ?? 0.5
    const roll = Math.random()
    if (!(roll < sc)) {
        log.logSystem(`[${eff.status}] 概率${(sc * 100).toFixed(0)}% 骰${(roll * 100).toFixed(0)}% 未命中`, tMs)
        return
    }
    log.logSystem(`[${eff.status}] 概率${(sc * 100).toFixed(0)}% 骰${(roll * 100).toFixed(0)}% 命中`, tMs)

    const st = eff.status as StatusType
    const existing = enemy.statuses.find((s) => s.type === st)
    if (existing) existing.stacks += eff.stacks

    const handler = statusHandlers[eff.status]
    if (handler) {
        handler({ eff, self, enemy, engine, tMs, existing, st })
    } else if (!existing) {
        enemy.statuses.push({ type: st, stacks: eff.stacks, source: self.name })
    }

    const target = enemy.statuses.find((s) => s.type === st)
    log.logSystem(`[${eff.status}] ${enemy.name} ${target ? target.stacks : eff.stacks}层`, tMs)
}

/** 处理一个 ActionEffect */
export function processActionEffect(
    eff: ActionEffect,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
    tMs: number,
): void {
    const handler = effectHandlers[eff.type]
    if (handler) handler({ eff, self, enemy, engine, tMs })
}

/** 处理 status tick（毒/灼烧），返回 damage 和下次间隔 */
export function processStatusTick(
    s: StatusInstance,
    char: Character,
    engine: BattleEngine,
    tMs: number,
): { damage: number; nextInterval: number } {
    const { log } = engine.state
    if (s.type === 'poison') {
        const dmg = s.stacks * 2
        char.takeDamage(dmg)
        s.poisonInterval = Math.max(500, (s.poisonInterval ?? 2000) - 150)
        log.logSystem(`[中毒] ${char.name} 受到 ${dmg} 毒伤害（下次${(s.poisonInterval / 1000).toFixed(1)}s后）`, tMs)
        if (dmg > 0) {
            engine.emit('on_hit', char, char, tMs)
        }
        return { damage: dmg, nextInterval: s.poisonInterval }
    }
    if (s.type === 'burn') {
        if (!s.burnBaseDamage || !s.remainingTicks) return { damage: 0, nextInterval: 0 }
        const dmg = Math.round(s.burnBaseDamage * (s.stacks / (s.stacks + s.remainingTicks)))
        s.remainingTicks--
        s.stacks = Math.max(0, s.stacks - 1)
        char.takeDamage(dmg)
        log.logSystem(`[灼烧] ${char.name} 受到 ${dmg} 灼烧伤害（剩余${s.remainingTicks}次）`, tMs)
        if (dmg > 0) {
            engine.emit('on_hit', char, char, tMs)
        }
        return { damage: dmg, nextInterval: s.remainingTicks && s.remainingTicks > 0 ? 1000 : 0 }
    }
    return { damage: 0, nextInterval: 0 }
}
