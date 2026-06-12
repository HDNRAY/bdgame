import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import type { EffectDef, ActionDefinition } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import type { StatusType } from '../entities/status'
import {
    calcBaseDamage,
    calcCritChance,
    calcFinalDamage,
    calcPoisonTickInterval,
    calcBuffDuration,
    calcHealAmount,
    calcParriedDamage,
    calcHitChance,
    calcParryChance,
    calcRoll,
    calcStunAttrRatio,
    calcStunAttrDelta,
    calcDebuffDuration,
} from '../calc/damage'
import { getWeapon } from '../data/weapons'
import { getBuff } from '../data/buffs'
import { genAppId } from '../util/buff-utils'
import { triggerBleed } from '../entities/status'
import type { Tag } from '../entities/tag'
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
    _tMs: number,
    _log: BattleLog,
    actionName?: string,
    actionId?: string,
): void {
    const weapon = target.weaponDef ?? getWeapon(target.build.weapon)
    let parried = false
    if (weapon.tags.includes('parry') && !engine.state.pendingBuffs.has(`dimensional_blade::${attacker.id}`)) {
        let pc = calcParryChance(0, target.attrs.get('dexterity'), target.attrs.get('insight'))
        // 看破 buff：招架率+0.5，成功后消耗
        const foresightKey = `foresight::${target.id}`
        if (engine.state.pendingBuffs.has(foresightKey)) {
            pc = Math.min(0.95, pc + 0.5)
        }
        // 守势
        if (engine.state.pendingBuffs.has(`guard_up::${target.id}`)) {
            pc = Math.min(0.95, pc + 0.35)
        }
        // 奇物/被动招架修正
        if (target.parryMod) {
            pc = Math.min(0.95, pc + target.parryMod)
        }
        const result = calcRoll(pc)
        parried = result.success
        engine.emitLog({
            type: 'check_parry',
            sourceId: attacker.id,
            targetId: target.id,
            parryChance: pc,
            roll: result.roll,
            result: result.success,
        })
        if (parried) {
            engine.state.pendingBuffs.delete(foresightKey)
            engine.emit('on_parry', target, attacker)
        }
    }
    let final = parried ? calcParriedDamage(raw, target.attrs.get('strength')) : raw
    const blocked = raw - final

    // 暴击判定
    const mindEyeKey = `mind_eye::${attacker.id}`
    const mindEyeBonus = engine.state.pendingBuffs.has(mindEyeKey) ? 0.25 : 0
    const critChance = calcCritChance(
        attacker.attrs.get('dexterity'),
        attacker.attrs.get('insight'),
        attacker.critChance + mindEyeBonus,
    )
    const critRoll = calcRoll(critChance)
    const isCrit = critRoll.success
    engine.emitLog({ type: 'check_crit', sourceId: attacker.id, critChance, roll: critRoll.roll, result: isCrit })

    final = calcFinalDamage(final, 1, isCrit, attacker.critDamageMod)
    final = Math.round(final * 10) / 10

    // 通用伤害修正钩子（遍历双方 buff 的 onDamage）
    final = applyDamageModifiers(final, target, attacker, engine, actionId)

    target.takeDamage(final)

    if (final > 0) {
        engine.emit('on_dealt_damage', attacker, target)
        engine.emit('on_took_damage', target, attacker)
    }

    engine.emitLog({
        type: 'damage',
        actionId: actionId ?? 'unknown',
        actionName: actionName ?? '未知',
        sourceId: attacker.id,
        targetId: target.id,
        base: raw,
        final,
        blocked,
        isCrit,
        isParried: parried,
        tags: [],
    })
    if (isCrit) engine.emit('on_crit', attacker, target)
}

const effectHandlers: Record<string, (ctx: Ctx) => void> = {
    counter_damage({ eff, self, enemy, engine }: Ctx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'counter_damage' }>
        const scaling: Partial<Record<AttrName, number>> = { strength: 1.0 }
        const base = calcBaseDamage(scaling, self.attrs.getAll())
        const dmg = Math.round(base * ratio)
        enemy.takeDamage(dmg)
        engine.emitLog({
            type: 'system',
            message: `[反击] ${self.name} 反击 ${enemy.name} ${dmg} 伤害`,
            actorId: self.id,
        })
    },
    modify_turn({ eff, enemy, engine }: Ctx) {
        const { deltaMs } = eff as Extract<EffectDef, { type: 'modify_turn' }>
        engine.state.turn.modifyTime(enemy.id, deltaMs)
    },
    cleanse({ eff, self, engine }: Ctx) {
        const { statuses } = eff as Extract<EffectDef, { type: 'cleanse' }>
        const targets = statuses ?? (['paralyze', 'poison'] as StatusType[])
        for (const [k] of engine.state.pendingBuffs) {
            const [prefix] = k.split('::')
            if (targets.includes(prefix as StatusType)) {
                engine.state.pendingBuffs.delete(k)
            }
        }
        engine.emitLog({ type: 'cleanse', sourceId: self.id, targetId: self.id, statuses: targets })
    },
    heal({ eff, self, engine }: Ctx) {
        const { value, ratio } = eff as Extract<EffectDef, { type: 'heal' }>
        const amount = calcHealAmount(value, self.maxHp, ratio)
        self.hp = Math.min(self.maxHp, self.hp + amount)
        engine.emitLog({
            type: 'heal',
            actionId: '_heal',
            actionName: '治疗',
            sourceId: self.id,
            targetId: self.id,
            amount,
        })
    },
    interrupt({ enemy, engine }: Ctx) {
        const INTERRUPT_DELAY = 1000
        engine.state.turn.modifyTime(enemy.id, INTERRUPT_DELAY)
        engine.emitLog({ type: 'interrupt', sourceId: '', targetId: enemy.id })
    },
    knockback({ eff, engine }: Ctx) {
        const { distance } = eff as Extract<EffectDef, { type: 'knockback' }>
        if (distance > 0) engine.state.distance.move(distance)
    },
    leap({ self, engine }: Ctx) {
        const dist = engine.state.distance.current
        if (dist < 4 || dist > 8) {
            engine.emitLog({ type: 'system', message: `${self.name} 距离不合适，无法跳跃`, actorId: self.id })
            return
        }
        const target = 1
        const delta = dist - target
        engine.state.distance.move(-delta)
        engine.emitLog({
            type: 'move',
            sourceId: self.id,
            delta: -delta,
            newDistance: engine.state.distance.current,
            apCost: 0,
            apRemaining: self.ap,
        })
    },
    ciyuan_init({ self, engine }: Ctx) {
        const weapon = self.weaponDef ?? getWeapon(self.build.weapon)
        if (weapon.id === 'bare_hands') {
            self.weaponDef = { ...getWeapon('ciyuan_blade') }
            engine.emitLog({ type: 'system', message: `[次元刃] ${self.name} 凝炁为刃`, actorId: self.id })
        } else {
            self.weaponDef = {
                ...weapon,
                tags: [...new Set([...weapon.tags, 'ignore_parry' as Tag, 'qi' as Tag])],
            }
            engine.emitLog({ type: 'system', message: `[次元刃] ${self.name} 附刃成功`, actorId: self.id })
        }
        engine.state.pendingBuffs.set(`dimensional_blade::${self.id}`, { restoreValue: 1 })
    },
    fixed_damage({ eff, self, enemy, engine, tMs, log, tag, actionId }: Ctx) {
        const { value } = eff as Extract<EffectDef, { type: 'fixed_damage' }>
        applyDamage(value, enemy, self, engine, tMs, log, tag, actionId)
    },
    damage({ eff, self, enemy, engine, tMs, log, tag, actionId }: Ctx) {
        const { scaling } = eff as Extract<EffectDef, { type: 'damage' }>
        const base = (eff as Extract<EffectDef, { type: 'damage' }>).base ?? 0
        const raw = calcBaseDamage(scaling, self.attrs.getAll(), base)
        if (raw > 0) applyDamage(raw, enemy, self, engine, tMs, log, tag, actionId)
    },
    self_damage({ eff, self, engine }: Ctx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'self_damage' }>
        const dmg = Math.round(self.maxHp * ratio)
        self.takeDamage(dmg)
        engine.emitLog({
            type: 'damage',
            actionId: '_self_damage',
            actionName: '自伤',
            sourceId: self.id,
            targetId: self.id,
            base: dmg,
            final: dmg,
            blocked: 0,
            isCrit: false,
            isParried: false,
            tags: ['self_damage'],
        })
    },
    cripple({ eff, self, enemy, engine, tag, actionId }: Ctx) {
        const { ratio } = eff as Extract<EffectDef, { type: 'cripple' }>
        const dmg = Math.round((enemy.maxHp - enemy.hp) * ratio)
        if (dmg > 0) {
            enemy.takeDamage(dmg)
            engine.emitLog({
                type: 'damage',
                actionId: actionId ?? 'cripple',
                actionName: tag ?? '崩劲',
                sourceId: self.id,
                targetId: enemy.id,
                base: dmg,
                final: dmg,
                blocked: 0,
                isCrit: false,
                isParried: false,
                tags: ['fixed_damage'],
            })
        }
    },
    status({ eff, self, enemy, engine, tMs, log }: Ctx) {
        handleStatusEffect({ eff: eff as Extract<EffectDef, { type: 'status' }>, self, enemy, engine, tMs, log })
    },

    // ── 自效果（无需命中判定） ──
    stat_multiply({ eff, self, engine, tMs }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_multiply' }>
        const appId = genAppId(tMs)
        const layerKey = `stat_multiply::${self.id}::${appId}`
        const attr = e.stat as AttrName
        const old = self.attrs.get(attr)
        self.attrs.set(attr, old * e.multiplier)
        engine.emitLog({
            type: 'stat_change',
            targetId: self.id,
            attr: e.stat,
            delta: old * e.multiplier - old,
            label: getBuff('stat_multiply')?.name ?? '超越',
        })
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
    stat_buff({ eff, self, engine, tMs, tag }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_buff' }>
        const entries = Object.entries(e.attrs) as [AttrName, number][]
        for (const [attr, value] of entries) {
            self.attrs.modify(attr, value)
            engine.emitLog({
                type: 'stat_change',
                targetId: self.id,
                attr,
                delta: value,
                label: tag ?? getBuff('stat_buff')?.name ?? '内劲',
            })
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
    },
    restore_ap({ eff, self, engine }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'restore_ap' }>
        self.ap = Math.min(self.maxAp, self.ap + e.value)
        engine.emitLog({ type: 'system', message: `[回气] ${self.name} AP+${e.value}`, actorId: self.id })
    },
    summon_speed({ eff, self, engine }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'summon_speed' }>
        engine.speedUpSummons(self.id, e.value)
        engine.emitLog({ type: 'system', message: `[加速] ${self.name} 召唤物+${e.value}ms`, actorId: self.id })
    },
    // permanent_burn({ eff, self, engine, tMs, log }: Ctx) {
    //     // 运行时由 engine 系统事件处理
    // },
    stat_transfer({ eff, self, enemy, engine, tMs }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'stat_transfer' }>
        const attr = e.stat as AttrName
        const appId = genAppId(tMs)
        const layerKey = `stat_transfer::${self.id}::${appId}`

        self.attrs.modify(attr, e.value)
        enemy.attrs.modify(attr, -e.value)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: e.stat, delta: -e.value, label: '汲取' })
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

        // AP 封顶
        if (e.stat === 'vitality') {
            self.capAp()
            enemy.capAp()
        }
    },
    crit_chance({ eff, self, engine }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'crit_chance' }>
        if (e.reset) {
            self.critChance = 0
        } else {
            self.critChance += e.value
        }
        engine.emitLog({
            type: 'system',
            message: e.reset
                ? `[弗思] ${self.name} 蓄势消散`
                : `[弗思] ${self.name} 蓄势+${Math.round(e.value * 100)}%`,
            actorId: self.id,
        })
    },
    crit_damage({ eff, self, engine }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'crit_damage' }>
        self.critDamageMod += e.value
        engine.emitLog({
            type: 'system',
            message: `[不二] ${self.name} 暴伤+${e.value}`,
            actorId: self.id,
        })
    },
    add_buff({ eff, self, engine }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'add_buff' }>
        const key = `${e.buffId}::${self.id}`
        engine.state.pendingBuffs.set(key, { restoreValue: e.stacks ?? 1 })
        engine.emitLog({
            type: 'system',
            message: `[${getBuff(e.buffId)?.name ?? e.buffId}] ${self.name} 获得状态`,
            actorId: self.id,
        })
        engine.emit('on_buff', self, engine.state.characters.find((c) => c.id !== self.id)!, e.buffId)
        // 自动调度 tick（buff 有 tickInterval 时）
        const def = getBuff(e.buffId)
        if (def?.tickInterval) {
            engine.state.turn.scheduleSystemEventAt(
                `tick_buff_${key}`,
                engine.state.turn.currentTime + def.tickInterval,
                'tick_buff',
            )
        }
    },
    remove_buff({ eff, self, engine }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'remove_buff' }>
        const key = `${e.buffId}::${self.id}`
        engine.state.pendingBuffs.delete(key)
        engine.emitLog({
            type: 'system',
            message: `[${getBuff(e.buffId)?.name ?? e.buffId}] ${self.name} 状态消失`,
            actorId: self.id,
        })
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
                extra: { bleedTriggerCount: 0, source: self.name, sourceId: self.id },
            })
        }
        engine.emit('on_debuff', self, enemy)
    },
    sand_blind({ enemy, engine }: Ctx) {
        const key = `sand_blind::${enemy.id}`
        if (engine.state.pendingBuffs.has(key)) return
        const buffDef = getBuff('sand_blind')
        const delta = buffDef?.attrMods?.insight ?? -4
        enemy.attrs.modify('insight', delta)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'insight', delta, label: '迷眼' })
        const duration = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        engine.state.pendingBuffs.set(key, { restoreValue: 1, mods: { insight: delta } })
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, engine.state.turn.currentTime + duration, 'buff_end')
    },
    knockdown({ enemy, engine, tMs }: Ctx) {
        const buffDef = getBuff('knockdown')
        const agiDelta = buffDef?.attrMods?.agility ?? -4
        enemy.attrs.modify('agility', agiDelta)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'agility', delta: agiDelta, label: '倒地' })
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))
        const appId = genAppId(tMs)
        const key = `knockdown::${enemy.id}::${appId}`
        const duration = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        engine.state.pendingBuffs.set(key, { restoreValue: 1, mods: { agility: agiDelta } })
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, engine.state.turn.currentTime + duration, 'buff_end')
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
                extra: { source: self.name, sourceId: self.id },
            })
        }
        const total = existing ? existing.restoreValue : stacks
        const dmg = total * 2
        enemy.takeDamage(dmg)
        engine.emitLog({ type: 'system', message: `[中毒] ${enemy.name} ${total}层×2=${dmg}伤害`, actorId: enemy.id })
        engine.emit('on_poison', self, enemy)
        engine.emit('on_debuff', self, enemy)
        // 移除旧 tick 事件，防双重触发
        engine.state.turn.removeEvents(`tick_poison_${enemy.id}`)
        const interval = calcPoisonTickInterval(total)
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
                extra: { source: self.name, burnBaseDamage: 5, remainingTicks: stacks, sourceId: self.id },
            })
        }
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000, 'tick_burn')
    },
    paralyze({ eff, enemy, engine, tMs }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'status' }>
        const { stacks } = e
        const attrMods = getBuff('paralyze')!.attrMods!
        const duration = calcDebuffDuration(1800, enemy.attrs.get('vitality'))
        const appId = genAppId(tMs)
        const layerKey = `paralyze::${enemy.id}::${appId}`
        const mods: Record<string, number> = {}
        for (const [attr, rate] of Object.entries(attrMods)) {
            const delta = -Math.floor(Math.abs(rate) * stacks)
            enemy.attrs.modify(attr as AttrName, delta)
            mods[attr] = delta
            engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr, delta, label: '麻痹' })
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
    },
    frost({ eff, enemy, engine, tMs }: Ctx) {
        const e = eff as Extract<EffectDef, { type: 'status' }>
        const { stacks } = e
        const buffDef = getBuff('frost')
        const agiPerStack = buffDef?.attrMods?.agility ?? -0.2
        const delta = -Math.round(stacks * Math.abs(agiPerStack) * 10) / 10
        if (delta === 0) return
        const duration = calcDebuffDuration(3000, enemy.attrs.get('vitality'))
        const appId = genAppId(tMs)
        const layerKey = `frost::${enemy.id}::${appId}`
        enemy.attrs.modify('agility', delta)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'agility', delta, label: '霜冻' })
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))
        engine.state.pendingBuffs.set(layerKey, {
            restoreValue: stacks,
            mods: { agility: delta },
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + duration,
            'buff_end',
        )
    },
    frost_step({ self, engine }: Ctx) {
        const dist = engine.state.distance.current
        if (dist < 2 || dist > 12) {
            engine.emitLog({ type: 'system', message: `${self.name} 距离不合适`, actorId: self.id })
            return
        }
        const perAp = Math.max(0.5, self.attrs.get('agility') / 20)
        const targetDist = 1
        const moveDist = dist - targetDist
        const apCost = Math.ceil(moveDist / perAp)
        if (self.ap < apCost) {
            engine.emitLog({ type: 'system', message: `${self.name} AP不足 无法踏雪`, actorId: self.id })
            return
        }
        self.spendAp(apCost)
        engine.state.distance.move(-moveDist)
        engine.emitLog({
            type: 'move',
            sourceId: self.id,
            delta: -moveDist,
            newDistance: engine.state.distance.current,
            apCost,
            apRemaining: self.ap,
        })
    },
    stun({ eff, enemy, engine, tMs }: Ctx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const STUN_DURATION = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        const STUN_RESET_WINDOW = 5000

        // 连续递减追踪
        const trackKey = `stun_track::${enemy.id}`
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
        if (agiDelta !== 0) {
            enemy.attrs.modify('agility', agiDelta)
            engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'agility', delta: agiDelta, label: '眩晕' })
        }
        if (insDelta !== 0) {
            enemy.attrs.modify('insight', insDelta)
            engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'insight', delta: insDelta, label: '眩晕' })
        }
        engine.state.turn.recalcInterval(enemy.id, enemy.attrs.get('agility'))

        const appId = genAppId(tMs)
        const layerKey = `stun::${enemy.id}::${appId}`
        engine.state.pendingBuffs.set(layerKey, {
            buffId: 'stun',
            restoreValue: stacks,
            mods: { agility: agiDelta, insight: insDelta },
        })
        engine.state.turn.scheduleSystemEventAt(
            `buff_end_${layerKey}`,
            engine.state.turn.currentTime + STUN_DURATION,
            'buff_end',
        )
    },
}

function handleStatusEffect(ctx: Omit<Ctx, 'tag' | 'actionId'> & { eff: EffectDef & { type: 'status' } }): void {
    const { eff, self, enemy, engine, tMs } = ctx
    const { success } = calcRoll(eff.chance)
    if (!success) return

    const st = eff.status
    // ── 免疫检查（冰心诀：仅灼烧/冰霜/麻痹） ──
    if (
        engine.state.pendingBuffs.has(`elemental_immunity::${enemy.id}`) &&
        (st === 'burn' || st === 'frost' || st === 'paralyze')
    ) {
        engine.emitLog({ type: 'system', message: `[冰心] ${enemy.name} 免疫 ${st}`, actorId: enemy.id })
        return
    }
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
        handler({ eff, self, enemy, engine, tMs, log: engine.state.log } as Ctx)
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
    _tMs: number,
    tag?: string,
    actionId?: string,
): void {
    const handler = effectHandlers[eff.type]
    if (handler) handler({ eff, self, enemy, engine, tMs: _tMs, log: engine.state.log, tag, actionId })
}

/** 处理 status tick（毒/灼烧），从 pendingBuffs 读取层数，返回 damage 和下次间隔 */
export function processStatusTick(
    charId: string,
    char: Character,
    engine: BattleEngine,
    _tMs: number,
    type: 'poison' | 'burn',
): { damage: number; nextInterval: number } {
    const key = `${type}::${charId}`
    const entry = engine.state.pendingBuffs.get(key)
    if (!entry) return { damage: 0, nextInterval: 0 }

    if (type === 'poison') {
        const stacks = entry.restoreValue
        const dmg = stacks * 2
        char.takeDamage(dmg)
        const nextInterval = calcPoisonTickInterval(stacks)
        const buffName = getBuff('poison')?.name ?? '中毒'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'poison',
            actionName: buffName,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
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
        const buffName = getBuff('burn')?.name ?? '灼烧'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'burn',
            actionName: buffName,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
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
    _tMs: number,
    engine: BattleEngine,
): boolean {
    engine.emit('on_attack', self, enemy)
    const hc =
        _action.chance ??
        calcHitChance({
            attackerDexterity: self.attrs.get('dexterity'),
            attackerInsight: self.attrs.get('insight'),
            defenderAgility: enemy.attrs.get('agility'),
            defenderInsight: enemy.attrs.get('insight'),
            defenderDodgeMod:
                enemy.dodgeMod +
                (engine.state.pendingBuffs.has(`ranged_dodge::${enemy.id}`) && engine.state.distance.current >= 5
                    ? 0.15
                    : 0),
        })
    const hitResult = calcRoll(hc)
    r.hit = hitResult.success
    engine.emitLog({
        type: 'check_hit',
        sourceId: self.id,
        targetId: enemy.id,
        hitChance: hc,
        roll: hitResult.roll,
        result: hitResult.success,
    })
    if (!r.hit) {
        engine.emitLog({ type: 'dodged', sourceId: self.id, targetId: enemy.id })
        engine.emit('on_dodged', self, enemy)
        engine.emit('on_dodge', enemy, self)
        return false
    }

    return true
}

// ── Bleed ──

/** 对目标执行流血伤害 */
export function processBleedDamage(owner: Character, _tMs: number, engine: BattleEngine): void {
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
        const buffName = getBuff('bleed')?.name ?? '流血'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'bleed',
            actionName: buffName,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: owner.id,
            status: buffName,
            amount: dmg,
        })
    }
}

// ── 通用伤害修正 ──

/** 遍历双方 buff 的 onDamage 钩子，自动修正伤害 */
function applyDamageModifiers(
    final: number,
    target: Character,
    attacker: Character,
    engine: BattleEngine,
    actionId?: string,
): number {
    for (const [key, layer] of engine.state.pendingBuffs) {
        const parts = key.split('::')
        if (parts.length < 2) continue
        if (parts[1] !== target.id && parts[1] !== attacker.id) continue
        const def = getBuff(parts[0])
        if (!def?.onDamage) continue
        final = def.onDamage(final, { final, target, attacker, engine, actionId, layer, buffOwnerId: parts[1] })
    }
    return final
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
    const tag = getBuff(buffId)?.name ?? buffId

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

    if (char && layer.mods) {
        for (const [attr, delta] of Object.entries(layer.mods)) {
            engine.emitLog({ type: 'stat_change', targetId: char.id, attr, delta: -(delta as number), label: tag })
        }
    }

    engine.state.pendingBuffs.delete(buffKey)
}
