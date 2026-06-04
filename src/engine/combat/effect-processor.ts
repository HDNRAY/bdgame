import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import type { EffectDef, ActionDefinition } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import type { StatusInstance, StatusType } from '../entities/status'
import {
    calcBaseDamage,
    calcPoisonTickInterval,
    calcParalyzeAttrRestore,
    calcBuffDuration,
    calcHealAmount,
    calcParriedDamage,
    calcHitChance,
    calcParryChance,
    calcRoll,
    calcStunDuration,
    calcParalyzeAttrPenalty,
} from '../calc/damage'
import { getWeapon } from '../data/weapons'
import { encodeBuffKey, decodeBuffKey } from '../util/buff-utils'
import { createBleed, createBurn, createPoison, triggerBleed } from '../entities/status'
import { getAction } from '../data/actions'
import type { BattleLog } from './battle-log'
import type { ActionResult } from './types'

// ── Context 类型 ──
interface Ctx {
    eff: EffectDef
    self: Character
    enemy: Character
    engine: BattleEngine
    tMs: number
    log: BattleLog
    tag?: string
    actionId?: string
}

interface StatusCtx {
    eff: EffectDef & { type: 'status' }
    self: Character
    enemy: Character
    engine: BattleEngine
    tMs: number
    log: BattleLog
    existing: StatusInstance | undefined
    st: StatusType
}

// ── 效果分发表 ──

/** 应用伤害（含招架判定） */
function applyDamage(
    raw: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    tMs: number,
    log: BattleLog,
): void {
    const weapon = getWeapon(target.build.weapon)
    let parried = false
    if (weapon.tags.includes('parry')) {
        const pc = calcParryChance(
            target.attrs.get('agility'),
            target.attrs.get('dexterity'),
            target.attrs.get('insight'),
        )
        parried = calcRoll(pc).success
        if (parried) engine.emit('on_parry', target, attacker)
    }
    const final = parried ? calcParriedDamage(raw, target.attrs.get('strength')) : raw
    target.takeDamage(final)
    log.logSystem(`→ ${target.name} 受到 ${final} 点伤害${parried ? ' [挡]' : ''}`, tMs, engine.getSnapshot())
}

const effectHandlers: Record<string, (ctx: Ctx) => void> = {
    counter_damage({ eff, self, enemy, engine, tMs, log }: Ctx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'counter_damage' }>
        const scaling: Partial<Record<AttrName, number>> = { strength: 1.0 }
        const base = calcBaseDamage(scaling, self.attrs.getAll())
        const dmg = Math.round(base * ratio)
        enemy.takeDamage(dmg)
        log.logSystem(`[反击] ${self.name} 反击 ${enemy.name} ${dmg} 伤害`, tMs, engine.getSnapshot())
    },
    modify_turn({ eff, enemy, engine }: Ctx) {
        const { deltaMs } = eff as Extract<EffectDef, { type: 'modify_turn' }>
        engine.state.turn.modifyTime(enemy.id, deltaMs)
    },
    cleanse({ eff, self, engine, tMs, log }: Ctx) {
        const { statuses } = eff as Extract<EffectDef, { type: 'cleanse' }>
        const targets = statuses ?? (['paralyze', 'poison'] as StatusType[])
        self.statuses = self.statuses.filter((s) => !targets.includes(s.type as StatusType))
        log.logSystem(`[净化] ${self.name} 清除了负面效果`, tMs, engine.getSnapshot())
    },
    heal({ eff, self, engine, tMs, log }: Ctx) {
        const { value, ratio } = eff as Extract<EffectDef, { type: 'heal' }>
        const amount = calcHealAmount(value, self.maxHp, ratio)
        self.hp = Math.min(self.maxHp, self.hp + amount)
        log.logSystem(`[回复] ${self.name} 恢复了 ${amount} HP`, tMs, engine.getSnapshot())
    },
    interrupt({ enemy, engine, tMs, log }: Ctx) {
        const INTERRUPT_DELAY = 1000
        engine.state.turn.modifyTime(enemy.id, INTERRUPT_DELAY)
        log.logSystem(`[打断] ${enemy.name} 被中断，延后 ${INTERRUPT_DELAY}ms`, tMs, engine.getSnapshot())
    },
    knockback({ eff, engine }: Ctx) {
        const { distance } = eff as Extract<EffectDef, { type: 'knockback' }>
        if (distance > 0) engine.state.distance.move(distance)
    },
    fixed_damage({ eff, self, enemy, engine, tMs, log }: Ctx) {
        const { value } = eff as Extract<EffectDef, { type: 'fixed_damage' }>
        applyDamage(value, enemy, self, engine, tMs, log)
    },
    damage({ eff, self, enemy, engine, tMs, log }: Ctx) {
        const { scaling } = eff as Extract<EffectDef, { type: 'damage' }>
        const base = calcBaseDamage(scaling, self.attrs.getAll())
        if (base > 0) applyDamage(base, enemy, self, engine, tMs, log)
    },
    self_damage({ eff, self, engine, tMs, log }: Ctx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'self_damage' }>
        const dmg = Math.round(self.maxHp * ratio)
        self.takeDamage(dmg)
        log.logSystem(`[自伤] ${self.name} 受到 ${dmg} 自伤`, tMs, engine.getSnapshot())
    },
    cripple({ eff, enemy, engine, tMs, log }: Ctx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'cripple' }>
        const dmg = Math.round((enemy.maxHp - enemy.hp) * ratio)
        if (dmg > 0) {
            enemy.takeDamage(dmg)
            log.logSystem(`[崩劲] ${enemy.name} 受到 ${dmg} 崩劲伤害`, tMs, engine.getSnapshot())
        }
    },
    status({ eff, self, enemy, engine, tMs, log }: Ctx) {
        handleStatusEffect({ eff: eff as Extract<EffectDef, { type: 'status' }>, self, enemy, engine, tMs, log })
    },

    // ── 自效果（无需命中判定） ──
    stat_multiply({ eff, self, engine, tMs, log, tag, actionId }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_multiply' }>
        const buffKey = encodeBuffKey(actionId ?? 'buff', self.id)
        if (engine.state.pendingBuffs.has(buffKey)) return
        const attr = e.stat as AttrName
        const old = self.attrs.get(attr)
        self.attrs.set(attr, old * e.multiplier)
        log.logSystem(
            `[${tag ?? 'buff'}] ${self.name} ${e.stat} ${old}→${old * e.multiplier}!`,
            tMs,
            engine.getSnapshot(),
            self.name,
        )
        const attrVal = self.attrs.get(e.duration.attr)
        const buffDuration = calcBuffDuration(attrVal, e.duration.multiplier)
        engine.state.pendingBuffs.set(buffKey, { restoreValue: old, stat: e.stat })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${buffKey}`,
            engine.state.turn.currentTime + buffDuration,
            'buff_end',
        )
    },
    stat_buff({ eff, self, engine, tMs, log, tag }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_buff' }>
        const entries = Object.entries(e.attrs) as [AttrName, number][]
        const desc = entries.map(([s, v]) => `${s}+${v}`).join(' ')
        for (const [attr, value] of entries) self.attrs.modify(attr, value)
        log.logSystem(`[${tag ?? 'buff'}] ${self.name} ${desc}`, tMs, engine.getSnapshot(), self.name)
    },
    stat_restore({ eff, self, engine, tMs, log, tag }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_restore' }>
        const attr = e.stat as AttrName
        const old = self.attrs.get(attr)
        self.attrs.set(attr, e.value)
        log.logSystem(
            `[${tag ?? 'buff'}] ${self.name} ${e.stat} ${old}→恢复${e.value}`,
            tMs,
            engine.getSnapshot(),
            self.name,
        )
    },
    restore_ap({ eff, self, engine, tMs, log, tag }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'restore_ap' }>
        self.ap = Math.min(self.maxAp, self.ap + e.value)
        log.logSystem(`[${tag ?? 'buff'}] ${self.name} 恢复 ${e.value} AP`, tMs, engine.getSnapshot(), self.name)
    },
    summon_speed({ eff, self, engine, tMs, log, tag }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'summon_speed' }>
        engine.speedUpSummons(self.id, e.value)
        log.logSystem(`[${tag ?? 'buff'}] ${self.name} 召唤物加速 ${e.value}ms`, tMs, engine.getSnapshot(), self.name)
    },
}

// ── Status 子分发表 ──
const statusHandlers: Record<string, (ctx: StatusCtx) => void> = {
    bleed({ eff: { stacks }, self, enemy, engine }: StatusCtx) {
        const { name } = self
        enemy.statuses.push(createBleed(stacks, 1, name))
        engine.emit('on_debuff', self, enemy)
    },
    poison({ eff: { stacks }, self: { name }, enemy, engine, tMs }: StatusCtx) {
        enemy.statuses.push(createPoison(stacks, name))
        const interval = calcPoisonTickInterval(stacks)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval, 'tick_poison')
    },
    burn({ eff: { stacks }, self: { name }, enemy, engine, tMs }: StatusCtx) {
        enemy.statuses.push(createBurn(stacks, 5, name))
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000, 'tick_burn')
    },
    paralyze({ eff: { stacks }, self: { name }, enemy, engine, tMs, existing, log }: StatusCtx) {
        const duration = 1800
        const appId = `p${tMs}_${Math.random().toString(36).slice(2, 6)}`

        const prevStacks = existing?.stacks ?? 0
        if (existing) {
            existing.stacks += stacks
        } else {
            enemy.statuses.push({ type: 'paralyze', stacks, source: name })
        }
        const total = prevStacks + stacks
        const penalty = calcParalyzeAttrPenalty(stacks)
        enemy.attrs.modify('agility', penalty.agility)
        enemy.attrs.modify('insight', penalty.insight)
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))

        engine.state.pendingBuffs.set(`para_${appId}`, { restoreValue: stacks, stat: 'paralyze' })
        engine.state.turn.scheduleSystemEventAt(`paralyze_end_${appId}`, tMs + duration, 'paralyze_end')

        log.logSystem(
            `[麻痹] ${enemy.name} 麻痹x${total} (+${stacks}层 身法${penalty.agility} 洞察${penalty.insight})`,
            tMs,
            engine.getSnapshot(),
        )
    },
    stun({ eff: { stacks }, self: { name }, enemy, engine, tMs, log }: StatusCtx) {
        const STUN_BASE_DURATION = 2000
        const STUN_RESET_WINDOW = 5000

        const trackKey = `stun_track_${enemy.id}`
        const lastData = engine.state.pendingBuffs.get(trackKey)
        const now = engine.state.turn.currentTime
        let consecutive = 0
        if (lastData && now - lastData.restoreValue < STUN_RESET_WINDOW) {
            consecutive = lastData.stat ? parseInt(lastData.stat) : 0
        }
        consecutive++
        engine.state.pendingBuffs.set(trackKey, { restoreValue: now, stat: String(consecutive) })
        engine.state.turn.scheduleSystemEventAt(`stun_reset_${enemy.id}`, now + STUN_RESET_WINDOW, 'stun_reset')

        const duration = calcStunDuration(consecutive, STUN_BASE_DURATION)
        enemy.statuses.push({ type: 'stun', stacks, source: name, skipTurn: true, rescheduleDelay: duration })
        log.logSystem(`[眩晕] ${enemy.name} ${duration}ms（第${consecutive}次）`, tMs, engine.getSnapshot())
    },
}

function handleStatusEffect(ctx: Omit<StatusCtx, 'existing' | 'st'>): void {
    const { eff, self, enemy, engine, tMs } = ctx
    const { success } = calcRoll(eff.chance)
    if (!success) return

    const st = eff.status as StatusType
    const existing = enemy.statuses.find((s) => s.type === st)

    // Stackable statuses: only stack, no trigger
    const STACKABLE_STATUSES: StatusType[] = ['bleed', 'poison', 'burn']
    if (existing && STACKABLE_STATUSES.includes(st)) {
        existing.stacks += eff.stacks
        return
    }

    const handler = statusHandlers[eff.status]
    if (handler) {
        handler({ eff, self, enemy, engine, tMs, existing, st, log: engine.state.log })
    } else {
        console.warn(`[effect-processor] 未注册的 status 类型: ${eff.status}`)
    }
}

/** 处理一个效果（统一入口） */
export function processActionEffect(
    eff: EffectDef,
    self: Character,
    enemy: Character,
    engine: BattleEngine,
    tMs: number,
    tag?: string,
    actionId?: string,
): void {
    const handler = effectHandlers[eff.type]
    if (handler) handler({ eff, self, enemy, engine, tMs, log: engine.state.log, tag, actionId })
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
            engine.emit('on_hit', char, char)
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
            engine.emit('on_hit', char, char)
        }
        return { damage: dmg, nextInterval: s.remainingTicks && s.remainingTicks > 0 ? 1000 : 0 }
    }
    return { damage: 0, nextInterval: 0 }
}

// ── Combat rolls ──

/** 命中/闪避/招架判定，返回 false 则攻击终止 */
export function processCombatRolls(
    _action: ActionDefinition,
    r: ActionResult,
    self: Character,
    enemy: Character,
    tMs: number,
    engine: BattleEngine,
): boolean {
    const { log } = engine.state

    engine.emit('on_attack', self, enemy)
    const hc = calcHitChance({
        attackerDexterity: self.attrs.get('dexterity'),
        attackerInsight: self.attrs.get('insight'),
        defenderAgility: enemy.attrs.get('agility'),
        defenderInsight: enemy.attrs.get('insight'),
    })
    const hitResult = calcRoll(hc)
    r.hit = hitResult.success
    log.logHitCheck(self.name, enemy.name, hc, hitResult.roll, r.hit, tMs, engine.getSnapshot())
    if (!r.hit) {
        engine.emit('on_dodged', self, enemy)
        return false
    }

    return true
}

// ── Bleed ──

/** 对目标执行流血伤害 */
export function processBleedDamage(owner: Character, tMs: number, engine: BattleEngine): void {
    const { log } = engine.state
    for (const s of owner.statuses) {
        if (s.type === 'bleed') {
            const dmg = triggerBleed(s)
            if (dmg > 0) {
                owner.takeDamage(dmg)
                s.bleedTriggerCount = (s.bleedTriggerCount ?? 0) + 1
                if (s.bleedTriggerCount >= 5) {
                    s.bleedTriggerCount = 0
                    s.stacks = Math.max(0, s.stacks - 1)
                }
                log.logSystem(`[流血] ${owner.name} 受到 ${dmg} 流血伤害`, tMs, engine.getSnapshot())
            }
        }
    }
}

// ── Paralyze end ──

/** 麻痹单层到期：恢复属性 + 移除 status */
export function processParalyzeEnd(appId: string, engine: BattleEngine): void {
    const { log } = engine.state
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
        char.attrs.modify('agility', restore.agility)
        char.attrs.modify('insight', restore.insight)
        engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'))
        log.logSystem(
            `[麻痹] ${char.name} 麻痹x${entry.stacks} (-${stacks}层 身法+${restore.agility} 洞察+${restore.insight})`,
            engine.state.turn.currentTime,
            engine.getSnapshot(),
            char.name,
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
    processActionEffect(
        { type: 'stat_restore', stat: data.stat, value: data.restoreValue },
        char,
        char,
        engine,
        engine.state.turn.currentTime,
        buffName,
    )
    engine.state.pendingBuffs.delete(buffKey)
}
