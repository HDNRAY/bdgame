import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import type { EffectDef, ActionDefinition } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import { ATTR_CN } from '../entities/attributes'
import type { StatusType } from '../entities/status'
import {
    calcBaseDamage,
    calcPoisonTickInterval,
    calcBuffDuration,
    calcHealAmount,
    calcParriedDamage,
    calcHitChance,
    calcParryChance,
    calcRoll,
    calcStunAttrRatio,
    calcStunAttrDelta,
} from '../calc/damage'
import { getWeapon } from '../data/weapons'
import { genAppId } from '../util/buff-utils'
import { triggerBleed } from '../entities/status'
import { EFFECT_META } from '../data/effects'
import type { BattleLog } from './battle-log'
import type { ActionResult, BuffLayer } from './types'

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
    let parryInfo = ''
    if (weapon.tags.includes('parry')) {
        const pc = calcParryChance(
            target.attrs.get('agility'),
            target.attrs.get('dexterity'),
            target.attrs.get('insight'),
        )
        const result = calcRoll(pc)
        parried = result.success
        const chPct = (pc * 100).toFixed(0)
        const rollPct = (result.roll * 100).toFixed(0)
        parryInfo = ` [招架${chPct}% 骰${rollPct}%]`
        if (parried) engine.emit('on_parry', target, attacker)
    }
    const final = parried ? calcParriedDamage(raw, target.attrs.get('strength')) : raw
    const blocked = raw - final
    target.takeDamage(final)
    const parryLabel = parried ? parryInfo.replace(']', ` -${blocked.toFixed(1)}]`) : parryInfo
    log.logSystem(`→ ${target.name} 受到 ${final} 点伤害${parryLabel}`, tMs, engine.getSnapshot())
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
        for (const [k] of engine.state.pendingBuffs) {
            const [prefix] = k.split('::')
            if (targets.includes(prefix as StatusType)) {
                engine.state.pendingBuffs.delete(k)
            }
        }
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
    stat_multiply({ eff, self, engine, tMs, log }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_multiply' }>
        const appId = genAppId(tMs)
        const layerKey = `stat_multiply::${self.id}::${appId}`
        const attr = e.stat as AttrName
        const old = self.attrs.get(attr)
        self.attrs.set(attr, old * e.multiplier)
        log.logSystem(
            `[${EFFECT_META.stat_multiply.tag}] ${self.name} ${e.stat} ${old}→${old * e.multiplier}!`,
            tMs,
            engine.getSnapshot(),
            self.name,
        )
        const attrVal = self.attrs.get(e.duration.attr)
        const buffDuration = calcBuffDuration(attrVal, e.duration.multiplier)
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stat_multiply',
            restoreValue: old,
            mods: { [e.stat]: old },
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + buffDuration,
            'buff_end',
        )
    },
    stat_buff({ eff, self, engine, tMs, log, tag }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_buff' }>
        const entries = Object.entries(e.attrs) as [AttrName, number][]
        for (const [attr, value] of entries) {
            self.attrs.modify(attr, value)
        }
        // Duration support: 创建独立 buff 层用于定时恢复
        if (e.durationMs) {
            const appId = genAppId(tMs)
            const mods: Record<string, number> = {}
            for (const [attr, value] of entries) {
                mods[attr] = value
            }
            const layerKey = `stat_buff::${self.id}::${appId}`
            engine.state.pendingBuffs.set(layerKey, {
                buffId: 'stat_buff',
                restoreValue: 1,
                mods,
            })
            engine.state.turn.scheduleSystemEventAt(
                `buff_end_${layerKey}`,
                engine.state.turn.currentTime + e.durationMs,
                'buff_end',
            )
        }
        const tagLabel = tag ?? EFFECT_META.stat_buff?.label ?? 'buff'
        const parts = entries.map(([attr, value]) => {
            const cn = ATTR_CN[attr] ?? attr
            const sign = value >= 0 ? '+' : ''
            return `${cn}${sign}${value}`
        })
        log.logSystem(`[${tagLabel}] ${self.name} ${parts.join(' ')}`, tMs, engine.getSnapshot(), self.name)
    },
    restore_ap({ eff, self, engine, tMs, log }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'restore_ap' }>
        self.ap = Math.min(self.maxAp, self.ap + e.value)
        log.logSystem(`[回气] ${self.name} AP+${e.value}`, tMs, engine.getSnapshot(), self.name)
    },
    summon_speed({ eff, self, engine, tMs, log }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'summon_speed' }>
        engine.speedUpSummons(self.id, e.value)
        log.logSystem(`[加速] ${self.name} 召唤物+${e.value}ms`, tMs, engine.getSnapshot(), self.name)
    },
    stat_transfer({ eff, self, enemy, engine, tMs, log }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_transfer' }>
        const attr = e.stat as AttrName
        const appId = genAppId(tMs)
        const layerKey = `stat_transfer::${self.id}::${appId}`

        self.attrs.modify(attr, e.value)
        enemy.attrs.modify(attr, -e.value)
        if (e.stat === 'agility') {
            engine.state.turn.recalcInterval(self.id, self.attrs.get('agility'))
            engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))
        }
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stat_transfer',
            restoreValue: e.value,
            targetId: enemy.id,
            mods: { [e.stat]: e.value },
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + e.duration,
            'buff_end',
        )

        // 计算当前累计吸取量
        let total = 0
        for (const [k, v] of engine.state.pendingBuffs) {
            if (k.startsWith(`stat_transfer::${self.id}`) && v.buffId === 'stat_transfer') {
                total += v.restoreValue
            }
        }
        log.logAttrChange(enemy.name, e.stat, -e.value, '汲取', tMs, engine.getSnapshot(), `累计${total}`)
    },
}

// ── Status 子分发表 ──
const statusHandlers: Record<string, (ctx: Ctx) => void> = {
    bleed({ eff, self, enemy, engine }: Ctx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const key = `bleed::${enemy.id}`
        const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined
        if (existing) {
            existing.restoreValue += stacks
        } else {
            engine.state.pendingBuffs.set(key, {
                restoreValue: stacks,
                extra: { bleedTriggerCount: 0, source: self.name },
            })
        }
        engine.emit('on_debuff', self, enemy)
    },
    poison({ eff, self, enemy, engine, tMs }: Ctx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const key = `poison::${enemy.id}`
        const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined
        if (existing) {
            existing.restoreValue += stacks
        } else {
            engine.state.pendingBuffs.set(key, {
                restoreValue: stacks,
                extra: { source: self.name },
            })
        }
        const interval = calcPoisonTickInterval(stacks)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval, 'tick_poison')
    },
    burn({ eff, self, enemy, engine, tMs }: Ctx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const key = `burn::${enemy.id}`
        const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined
        if (existing) {
            existing.restoreValue += stacks
        } else {
            engine.state.pendingBuffs.set(key, {
                restoreValue: stacks,
                extra: { source: self.name, burnBaseDamage: 5, remainingTicks: stacks },
            })
        }
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000, 'tick_burn')
    },
    paralyze({ eff, enemy, engine, tMs, log }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'status' }>
        const { stacks } = e
        const attrMods = EFFECT_META.paralyze.attrMods!
        const duration = 1800
        const appId = genAppId(tMs)
        const layerKey = `paralyze::${enemy.id}::${appId}`
        const mods: Record<string, number> = {}
        for (const [attr, rate] of Object.entries(attrMods)) {
            const delta = -Math.floor(Math.abs(rate) * stacks)
            enemy.attrs.modify(attr as AttrName, delta)
            mods[attr] = delta
        }
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))

        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'paralyze',
            restoreValue: stacks,
            mods,
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + duration,
            'buff_end',
        )

        // 计算总层数
        let totalStacks = 0
        for (const [k, v] of engine.state.pendingBuffs) {
            if (k.startsWith(`paralyze::${enemy.id}`) && v.buffId === 'paralyze') {
                totalStacks += v.restoreValue
            }
        }
        log.logSystem(
            `[麻痹] ${enemy.name} ${Object.entries(mods)
                .map(([a, v]) => `${ATTR_CN[a] ?? a}${v}`)
                .join(' ')}（累计${totalStacks}）`,
            tMs,
            engine.getSnapshot(),
        )
    },
    stun({ eff, enemy, engine, tMs, log }: Ctx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const STUN_DURATION = 2000
        const STUN_RESET_WINDOW = 5000

        // 连续递减追踪
        const trackKey = `stun_track_${enemy.id}`
        const lastData = engine.state.pendingBuffs.get(trackKey)
        const now = engine.state.turn.currentTime
        let consecutive = 0
        if (lastData && now - lastData.restoreValue < STUN_RESET_WINDOW) {
            consecutive = (lastData.extra?.consecutive as number) ?? 0
        }
        consecutive++
        engine.state.pendingBuffs.set(trackKey, { restoreValue: now, extra: { consecutive } })
        engine.state.turn.scheduleSystemEventAt(`stun_reset_${enemy.id}`, now + STUN_RESET_WINDOW, 'stun_reset')

        // 数值递减
        const ratio = calcStunAttrRatio(consecutive)
        const agility = enemy.attrs.get('agility')
        const insight = enemy.attrs.get('insight')
        const agiDelta = calcStunAttrDelta(agility, ratio)
        const insDelta = calcStunAttrDelta(insight, ratio)
        const mods: Record<string, number> = {}
        if (agiDelta !== 0) {
            enemy.attrs.modify('agility', agiDelta)
            mods.agility = agiDelta
        }
        if (insDelta !== 0) {
            enemy.attrs.modify('insight', insDelta)
            mods.insight = insDelta
        }
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))

        const appId = genAppId(tMs)
        const layerKey = `stun::${enemy.id}::${appId}`
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stun',
            restoreValue: stacks,
            mods,
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + STUN_DURATION,
            'buff_end',
        )

        log.logSystem(
            `[眩晕] ${enemy.name} ${Object.entries(mods)
                .map(([a, v]) => `${ATTR_CN[a] ?? a}${v}`)
                .join(' ')}（第${consecutive}次）`,
            tMs,
            engine.getSnapshot(),
        )
    },
}

function handleStatusEffect(ctx: Omit<Ctx, 'tag' | 'actionId'> & { eff: EffectDef & { type: 'status' } }): void {
    const { eff, self, enemy, engine, tMs } = ctx
    const { success } = calcRoll(eff.chance)
    if (!success) return

    const st = eff.status
    const key = `${st}::${enemy.id}`
    const existing = engine.state.pendingBuffs.get(key) as BuffLayer | undefined

    // Stackable statuses: only stack, no trigger
    const STACKABLE_STATUSES: StatusType[] = ['bleed', 'poison', 'burn']
    if (existing && STACKABLE_STATUSES.includes(st as StatusType)) {
        existing.restoreValue += eff.stacks
        return
    }

    const handler = statusHandlers[eff.status]
    if (handler) {
        handler({ eff, self, enemy, engine, tMs, log: engine.state.log })
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

/** 处理 status tick（毒/灼烧），从 pendingBuffs 读取层数，返回 damage 和下次间隔 */
export function processStatusTick(
    charId: string,
    char: Character,
    engine: BattleEngine,
    tMs: number,
    type: 'poison' | 'burn',
): { damage: number; nextInterval: number } {
    const { log } = engine.state
    const key = `${type}::${charId}`
    const entry = engine.state.pendingBuffs.get(key)
    if (!entry) return { damage: 0, nextInterval: 0 }

    if (type === 'poison') {
        const stacks = entry.restoreValue
        const dmg = stacks * 2
        char.takeDamage(dmg)
        const nextInterval = calcPoisonTickInterval(stacks)
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

    if (type === 'burn') {
        const stacks = entry.restoreValue
        const burnBaseDamage = (entry.extra?.burnBaseDamage as number) ?? 0
        const remainingTicks = (entry.extra?.remainingTicks as number) ?? 0
        if (!burnBaseDamage || !remainingTicks) return { damage: 0, nextInterval: 0 }
        const dmg = Math.round(burnBaseDamage * (stacks / (stacks + remainingTicks)))
        entry.extra = { ...entry.extra, remainingTicks: remainingTicks - 1 }
        entry.restoreValue = Math.max(0, stacks - 1)
        char.takeDamage(dmg)
        log.logSystem(
            `[灼烧] ${char.name} 受到 ${dmg} 灼烧伤害（剩余${remainingTicks - 1}次）`,
            tMs,
            engine.getSnapshot(),
        )
        if (dmg > 0) {
            engine.emit('on_hit', char, char)
        }
        return { damage: dmg, nextInterval: remainingTicks - 1 > 0 ? 1000 : 0 }
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
    const hc =
        _action.chance ??
        calcHitChance({
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
        engine.emit('on_dodge', enemy, self)
        return false
    }

    return true
}

// ── Bleed ──

/** 对目标执行流血伤害 */
export function processBleedDamage(owner: Character, tMs: number, engine: BattleEngine): void {
    const { log } = engine.state
    const key = `bleed::${owner.id}`
    const entry = engine.state.pendingBuffs.get(key)
    if (!entry) return
    const stacks = entry.restoreValue
    const dmg = triggerBleed(stacks)
    if (dmg > 0) {
        owner.takeDamage(dmg)
        const bt = ((entry.extra?.bleedTriggerCount as number) ?? 0) + 1
        entry.extra = { ...entry.extra, bleedTriggerCount: bt }
        if (bt >= 5) {
            entry.extra = { ...entry.extra, bleedTriggerCount: 0 }
            entry.restoreValue = Math.max(0, stacks - 1)
        }
        log.logSystem(`[流血] ${owner.name} 受到 ${dmg} 流血伤害`, tMs, engine.getSnapshot())
    }
}

// ── Buff end ──

/** buff 到期恢复 */
export function processBuffEnd(buffKey: string, engine: BattleEngine): void {
    const layer = engine.state.pendingBuffs.get(buffKey)
    if (!layer) return
    const parts = buffKey.split('::')
    if (parts.length !== 3) return

    const buffId = parts[0]
    const charId = parts[1]
    const { log } = engine.state
    const tag = EFFECT_META[buffId]?.label ?? buffId

    // 通用：反转属性变化
    const char = engine.getCharacter(charId)
    if (char && layer.mods) {
        for (const [attr, delta] of Object.entries(layer.mods)) {
            char.attrs.modify(attr as AttrName, -delta)
            if (attr === 'agility') engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'))
        }
    }

    // stat_transfer：正向恢复目标
    if (buffId === 'stat_transfer' && layer.targetId) {
        const target = engine.getCharacter(layer.targetId)
        if (target && layer.mods) {
            for (const [attr, delta] of Object.entries(layer.mods)) {
                target.attrs.modify(attr as AttrName, delta)
                if (attr === 'agility') engine.state.turn.recalcInterval(target.id, target.attrs.get('agility'))
            }
        }
    }

    // 计算剩余总层数
    let remaining = 0
    for (const [k, v] of engine.state.pendingBuffs) {
        if (k.startsWith(`${buffId}::${charId}`) && k !== buffKey && v.buffId === buffId) {
            remaining += v.restoreValue
        }
    }

    // Log
    if (char && layer.mods) {
        log.logSystem(
            `[${tag}] ${char.name} ${Object.entries(layer.mods)
                .map(([a, v]) => {
                    const actual = -(v as number)
                    return `${ATTR_CN[a] ?? a}${actual >= 0 ? '+' : ''}${actual}`
                })
                .join(' ')}（结束·剩余${remaining}）`,
            engine.state.turn.currentTime,
            engine.getSnapshot(),
            char.name,
        )
    }

    engine.state.pendingBuffs.delete(buffKey)
}
