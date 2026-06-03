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
        engine.state.log.logSystem(`[反击] ${self.name} 反击 ${enemy.name} ${dmg} 伤害`, tMs, engine.getSnapshot())
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
        if (existing) {
            existing.stacks += stacks
            return
        }
        enemy.statuses.push(createBleed(stacks, 1, name))
    },
    poison({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing }: StatusCtx) {
        if (existing) {
            existing.stacks += stacks
            return
        }
        enemy.statuses.push(createPoison(stacks, name))
        const interval = Math.max(500, 2000 - stacks * 200)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval)
    },
    burn({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing }: StatusCtx) {
        if (existing) {
            existing.stacks += stacks
            return
        }
        enemy.statuses.push(createBurn(stacks, 5, name))
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000)
    },
    paralyze({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing }: StatusCtx) {
        const duration = 1800
        const appId = `p${tMs}_${Math.random().toString(36).slice(2, 6)}`

        if (existing) {
            existing.stacks += stacks
        } else {
            enemy.statuses.push({ type: 'paralyze', stacks, source: name })
        }
        enemy.attrs.modify('dexterity', -stacks * 2)
        enemy.attrs.modify('insight', -stacks * 1)

        // 存该层贡献的层数，到期时扣除
        engine.state.pendingBuffs.set(`para_${appId}`, { restoreValue: stacks, stat: 'paralyze' })
        engine.state.turn.scheduleSystemEventAt(`paralyze_end_${appId}`, tMs + duration)

        const total = existing?.stacks ?? stacks
        engine.state.log.logSystem(
            `[麻痹] ${enemy.name} 身法-${total * 2} 洞察-${total * 1}`,
            tMs,
            engine.getSnapshot(),
        )
    },
    stun({ eff: { stacks }, self: { name }, enemy, engine, tMs }: StatusCtx) {
        const baseDuration = 2000
        const window = 30000

        // 眩晕衰减追踪
        const trackKey = `stun_track_${enemy.id}`
        const lastData = engine.state.pendingBuffs.get(trackKey)
        const now = engine.state.turn.currentTime
        let consecutive = 0
        if (lastData && now - lastData.restoreValue < window) {
            // 上次追踪还在窗口内
            consecutive = lastData.stat ? parseInt(lastData.stat) : 0
        }
        consecutive++
        engine.state.pendingBuffs.set(trackKey, { restoreValue: now, stat: String(consecutive) })
        // 窗口到期后清除追踪
        engine.state.turn.scheduleSystemEventAt(`stun_reset_${enemy.id}`, now + window)

        const duration = Math.round(baseDuration / Math.pow(2, consecutive - 1))
        enemy.statuses.push({
            type: 'stun',
            stacks,
            source: name,
            skipTurn: true,
            rescheduleDelay: duration,
        })
        engine.state.log.logSystem(
            `[眩晕] ${enemy.name} ${duration}ms（第${consecutive}次）`,
            tMs,
            engine.getSnapshot(),
        )
    },
}

function handleStatusEffect(ctx: Omit<StatusCtx, 'existing' | 'st'>): void {
    const { eff, self, enemy, engine, tMs } = ctx
    const { log } = engine.state
    const sc = eff.chance ?? 0.5
    const roll = Math.random()
    if (!(roll < sc)) return

    const st = eff.status as StatusType
    const existing = enemy.statuses.find((s) => s.type === st)

    const handler = statusHandlers[eff.status]
    if (handler) {
        handler({ eff, self, enemy, engine, tMs, existing, st })
    } else {
        if (existing) {
            existing.stacks += eff.stacks
        } else {
            enemy.statuses.push({ type: st, stacks: eff.stacks, source: self.name })
            log.logSystem(`[状态] ${enemy.name} ${st} ${eff.stacks}层`, tMs, engine.getSnapshot())
        }
    }
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
        const nextInterval = Math.max(500, 2000 - s.stacks * 200)
        log.logSystem(
            `[中毒] ${char.name} 受到 ${dmg} 毒伤害（下次${(nextInterval / 1000).toFixed(1)}s后）`,
            tMs,
            engine.getSnapshot(),
        )
        if (dmg > 0) {
            engine.emit('on_hit', char, char, tMs)
        }
        return { damage: dmg, nextInterval }
    }
    if (s.type === 'burn') {
        if (!s.burnBaseDamage || !s.remainingTicks) return { damage: 0, nextInterval: 0 }
        const dmg = Math.round(s.burnBaseDamage * (s.stacks / (s.stacks + s.remainingTicks)))
        s.remainingTicks--
        s.stacks = Math.max(0, s.stacks - 1)
        char.takeDamage(dmg)
        log.logSystem(
            `[灼烧] ${char.name} 受到 ${dmg} 灼烧伤害（剩余${s.remainingTicks}次）`,
            tMs,
            engine.getSnapshot(),
        )
        if (dmg > 0) {
            engine.emit('on_hit', char, char, tMs)
        }
        return { damage: dmg, nextInterval: s.remainingTicks && s.remainingTicks > 0 ? 1000 : 0 }
    }
    return { damage: 0, nextInterval: 0 }
}
