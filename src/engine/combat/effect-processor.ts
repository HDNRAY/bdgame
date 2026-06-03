import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import type { ActionEffect, ActionDefinition, BonusTriggerEffect } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import type { StatusInstance, StatusType } from '../entities/status'
import {
    calcBaseDamage,
    calcPoisonTickInterval,
    calcParalyzeAttrRestore,
    calcBuffDuration,
    calcHealAmount,
    calcParriedDamage,
    calcDodgeChanceWithParalyze,
    calcHitChance,
    calcParryChance,
    calcCritChance,
    calcFinalDamage,
    WEAPONS,
} from '../calc/damage'
import { encodeBuffKey, decodeBuffKey } from '../util/buff-utils'
import { resolveAction } from '../calc/action-executor'
import { createBleed, createBurn, createPoison, triggerBleed } from '../entities/status'
import { getAction } from '../data/actions'
import type { ActionResult } from './types'

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
        const interval = calcPoisonTickInterval(stacks)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval, 'tick_poison')
    },
    burn({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing }: StatusCtx) {
        if (existing) {
            existing.stacks += stacks
            return
        }
        enemy.statuses.push(createBurn(stacks, 5, name))
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000, 'tick_burn')
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
        engine.state.turn.scheduleSystemEventAt(`paralyze_end_${appId}`, tMs + duration, 'paralyze_end')

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
        engine.state.turn.scheduleSystemEventAt(`stun_reset_${enemy.id}`, now + window, 'stun_reset')

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
        const nextInterval = calcPoisonTickInterval(s.stacks)
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

// ── Combat rolls ──

/** 命中/闪避/招架判定，返回 false 则攻击终止 */
export function processCombatRolls(
    action: ActionDefinition,
    r: ActionResult,
    self: Character,
    enemy: Character,
    tMs: number,
    engine: BattleEngine,
): boolean {
    const log = engine.state.log
    const stats = WEAPONS[action.weaponType]

    engine.emit('on_attack', self, enemy, tMs)
    const hc = calcHitChance(self.attrs.get('technique'), enemy.attrs.get('dexterity'))
    const hitRoll = Math.random()
    r.hit = hitRoll < hc
    log.logHitCheck(self.name, enemy.name, hc, hitRoll, r.hit, tMs, engine.getSnapshot())
    if (!r.hit) {
        engine.emit('on_dodged', self, enemy, tMs)
        return false
    }

    const paraStacks = enemy.getStatus('paralyze')?.stacks ?? 0
    r.dodged = Math.random() < calcDodgeChanceWithParalyze(enemy.attrs.get('dexterity'), paraStacks)
    if (r.dodged) {
        log.logDodge(self.name, enemy.name, tMs, engine.getSnapshot())
        engine.emit('on_dodge', enemy, self, tMs)
        return false
    }

    const pc = calcParryChance(enemy.attrs.get('strength'), stats.parryRate ?? 0)
    const parryRoll = Math.random()
    r.parried = parryRoll < pc
    if (r.parried) log.logParry(self.name, enemy.name, tMs, engine.getSnapshot(), pc, parryRoll)
    else engine.emit('on_parried', self, enemy, tMs)
    return true
}

// ── Damage application ──

/** 伤害结算与应用（含暴击、招架减免、自伤、击退） */
export function processDamageApplication(
    action: ActionDefinition,
    r: ActionResult,
    self: Character,
    enemy: Character,
    tMs: number,
    engine: BattleEngine,
    currentDistance: number,
): void {
    const log = engine.state.log

    const resolved = resolveAction(action, self, enemy, currentDistance)
    const critChance = calcCritChance(self.attrs.get('technique'))
    const critRoll = Math.random()
    const isCrit = critRoll < critChance
    log.logCritCheck(self.name, critChance, critRoll, isCrit, tMs, engine.getSnapshot())
    resolved.isCrit = isCrit
    resolved.final = calcFinalDamage(resolved.base + resolved.crippleBonus, resolved.distanceMult, isCrit)

    const finalDmg = r.parried ? calcParriedDamage(resolved.final) : resolved.final
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
        engine.getSnapshot(),
    )
    if (resolved.knockbackDistance > 0) {
        processActionEffect({ type: 'knockback', distance: resolved.knockbackDistance }, self, enemy, engine, tMs)
    }
}

// ── Bleed ──

/** 对目标执行流血伤害 */
export function processBleedDamage(owner: Character, tMs: number, engine: BattleEngine): void {
    for (const s of owner.statuses) {
        if (s.type === 'bleed') {
            const dmg = triggerBleed(s)
            if (dmg > 0) {
                owner.takeDamage(dmg)
                engine.state.log.logSystem(`[流血] ${owner.name} 受到 ${dmg} 流血伤害`, tMs, engine.getSnapshot())
            }
        }
    }
}

// ── Trigger effects ──

/** 应用 triggerEffect（stat_multiply / stat_buff / stat_restore / heal） */
export function processTriggerEffect(
    e: BonusTriggerEffect | BonusTriggerEffect[] | undefined,
    self: Character,
    engine: BattleEngine,
    actionName?: string,
    actionId?: string,
): void {
    if (!e) return
    if (Array.isArray(e)) {
        for (const eff of e) processTriggerEffect(eff, self, engine, actionName, actionId)
        return
    }
    const tag = actionName ?? '功法'
    const tMs = engine.state.turn.peek()?.nextActionAt ?? 0
    const actorName = self.name
    switch (e.type) {
        case 'stat_multiply': {
            const buffKey = encodeBuffKey(actionId ?? 'buff', self.id)
            if (engine.state.pendingBuffs.has(buffKey)) break
            const attr = e.stat as AttrName
            const old = self.attrs.get(attr)
            self.attrs.set(attr, old * e.multiplier)
            engine.state.log.logSystem(
                `[${tag}] ${self.name} ${e.stat} ${old}→${old * e.multiplier}!`,
                tMs,
                engine.getSnapshot(),
                actorName,
            )
            {
                const attrVal = self.attrs.get(e.duration.attr)
                const buffDuration = calcBuffDuration(attrVal, e.duration.multiplier)
                engine.state.pendingBuffs.set(buffKey, { restoreValue: old, stat: e.stat })
                engine.state.turn.scheduleSystemEventAt(
                    `buff_end_${buffKey}`,
                    engine.state.turn.currentTime + buffDuration,
                    'buff_end',
                )
            }
            break
        }
        case 'stat_buff': {
            const entries = Object.entries(e.attrs) as [AttrName, number][]
            const desc = entries.map(([s, v]) => `${s}+${v}`).join(' ')
            for (const [attr, value] of entries) self.attrs.modify(attr, value)
            engine.state.log.logSystem(`[${tag}] ${self.name} ${desc}`, tMs, engine.getSnapshot(), actorName)
            break
        }
        case 'stat_restore': {
            const attr = e.stat as AttrName
            const old = self.attrs.get(attr)
            self.attrs.set(attr, e.value)
            engine.state.log.logSystem(
                `[${tag}] ${self.name} ${e.stat} ${old}→恢复${e.value}`,
                tMs,
                engine.getSnapshot(),
                actorName,
            )
            break
        }
        case 'heal': {
            const amount = calcHealAmount(e.value, self.maxHp, e.ratio)
            self.heal(amount)
            engine.state.log.logSystem(`[${tag}] ${self.name} 回复 ${amount} HP`, tMs, engine.getSnapshot(), actorName)
            break
        }
    }
}

// ── Paralyze end ──

/** 麻痹单层到期：恢复属性 + 移除 status */
export function processParalyzeEnd(appId: string, engine: BattleEngine): void {
    const buffs = engine.state.pendingBuffs
    const data = buffs.get(`para_${appId}`)
    if (!data || data.stat !== 'paralyze') return
    const stacks = data.restoreValue
    buffs.delete(`para_${appId}`)

    for (const char of engine.state.characters) {
        const entry = char.getStatus('paralyze')
        if (!entry) continue
        const restore = calcParalyzeAttrRestore(stacks)
        entry.stacks -= stacks
        char.attrs.modify('dexterity', restore.dexterity)
        char.attrs.modify('insight', restore.insight)
        engine.state.log.logSystem(
            `[麻痹] ${char.name} 恢复${stacks}层`,
            engine.state.turn.currentTime,
            engine.getSnapshot(),
        )
        if (entry.stacks <= 0) {
            char.statuses = char.statuses.filter((s) => s !== entry)
        }
        return
    }
}

// ── Buff end ──

/** buff 到期恢复 */
export function processBuffEnd(buffKey: string, engine: BattleEngine): void {
    const data = engine.state.pendingBuffs.get(buffKey)
    if (!data) return
    const decoded = decodeBuffKey(buffKey)
    if (!decoded) return
    const char = engine.state.characters.find((c) => c.id === decoded.characterId)
    if (!char) return
    const action = getAction(decoded.actionId)
    const buffName = action?.name ?? (decoded.actionId.startsWith('paralyze') ? '麻痹' : decoded.actionId)
    processTriggerEffect({ type: 'stat_restore', stat: data.stat, value: data.restoreValue }, char, engine, buffName)
    engine.state.pendingBuffs.delete(buffKey)
}
