import type { Character } from '../../entities/character'
import type { BattleEngine } from '../engine'
import type { EffectDef } from '../../entities/action'
import type { AttrName } from '../../entities/attributes'
import {
    calcRoll,
    calcPoisonTickInterval,
    calcDebuffDuration,
    calcStunAttrRatio,
    calcStunAttrDelta,
} from '../../calc/damage'
import { getBuff } from '../../data/buffs'
import { genAppId } from '../../util/buff-utils'
import { triggerBleed } from '../../entities/status'
import { BattleLog } from '../battle-log'
import type { BuffLayer } from '../types'
import type { EffectCtx } from './types'

// ── Status 子分发表 ──

const statusHandlers: Record<string, (ctx: EffectCtx) => void> = {
    bleed({ eff, self, enemy, engine }: EffectCtx) {
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
        const total = existing ? existing.restoreValue : stacks
        engine.emitLog({
            type: 'system',
            message: `[流血] ${BattleLog.name(enemy.name)} ${existing ? '叠层' : '获得'}→${total}层`,
            actorId: enemy.id,
        })
        engine.emit('on_debuff', self, enemy)
    },
    sand_blind({ enemy, engine }: EffectCtx) {
        const key = `sand_blind::${enemy.id}`
        if (engine.state.pendingBuffs.has(key)) return
        const buffDef = getBuff('sand_blind')
        const delta = buffDef?.attrMods?.insight ?? -4
        enemy.attrs.modify('insight', delta)
        engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr: 'insight', delta, label: '迷眼' })
        const duration = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        engine.state.pendingBuffs.set(key, { restoreValue: 1, mods: { insight: delta } })
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, engine.state.turn.currentTime + duration, 'buff_end')
        engine.emitLog({
            type: 'system',
            message: `[迷眼] ${BattleLog.name(enemy.name)} 1层`,
            actorId: enemy.id,
        })
    },
    knockdown({ enemy, engine, tMs }: EffectCtx) {
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
        engine.emitLog({
            type: 'system',
            message: `[倒地] ${BattleLog.name(enemy.name)} 1层`,
            actorId: enemy.id,
        })
    },
    poison({ eff, self, enemy, engine, tMs }: EffectCtx) {
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
        engine.emitLog({
            type: 'system',
            message: BattleLog.msg('中毒', enemy.name, `${total}层×2=${dmg}伤害`),
            actorId: enemy.id,
        })
        engine.emit('on_poison', self, enemy)
        engine.emit('on_debuff', self, enemy)
        engine.state.turn.removeEvents(`tick_poison_${enemy.id}`)
        const interval = calcPoisonTickInterval(total)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval, 'tick_poison')
    },
    burn({ eff, self, enemy, engine, tMs }: EffectCtx) {
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
        const total = existing ? existing.restoreValue : stacks
        engine.emitLog({
            type: 'system',
            message: `[灼烧] ${BattleLog.name(enemy.name)} ${existing ? '叠层' : '获得'}→${total}层`,
            actorId: enemy.id,
        })
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000, 'tick_burn')
    },
    paralyze({ eff, enemy, engine, tMs }: EffectCtx) {
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
            engine.emitLog({ type: 'stat_change', targetId: enemy.id, attr, delta, label: `麻痹(${stacks}层)` })
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
    frost({ eff, enemy, engine, tMs }: EffectCtx) {
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
    stun({ eff, enemy, engine, tMs }: EffectCtx) {
        const { stacks } = eff as Extract<EffectDef, { type: 'status' }>
        const STUN_DURATION = calcDebuffDuration(2000, enemy.attrs.get('vitality'))
        const STUN_RESET_WINDOW = 5000

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
        const mods: Record<string, number> = {}
        if (agiDelta !== 0) mods.agility = agiDelta
        if (insDelta !== 0) mods.insight = insDelta
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
        engine.emitLog({
            type: 'system',
            message: `[眩晕] ${BattleLog.name(enemy.name)} ${stacks}层`,
            actorId: enemy.id,
        })
    },
}

// ── 状态分发 ──

function handleStatusEffect(ctx: EffectCtx & { eff: EffectDef & { type: 'status' } }): void {
    const { eff, self, enemy, engine, tMs } = ctx
    const { success } = calcRoll(eff.chance)
    if (!success) return

    const st = eff.status
    if (
        engine.state.pendingBuffs.has(`elemental_immunity::${enemy.id}`) &&
        (st === 'burn' || st === 'frost' || st === 'paralyze')
    ) {
        engine.emitLog({ type: 'system', message: `[冰心] ${enemy.name} 免疫 ${st}`, actorId: enemy.id })
        return
    }
    if (engine.state.pendingBuffs.has(`paralyze_immunity::${enemy.id}`) && st === 'paralyze') {
        engine.emitLog({ type: 'system', message: `[雷体] ${enemy.name} 免疫麻痹`, actorId: enemy.id })
        return
    }

    const handler = statusHandlers[eff.status]
    if (handler) {
        handler({ eff, self, enemy, engine, tMs })
    } else {
        console.warn(`[effects] 未注册的 status 类型: ${eff.status}`)
    }
}

export { statusHandlers, handleStatusEffect }

// ── Status tick ──

/** 处理 status tick（毒/灼烧），从 pendingBuffs 读取层数 */
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
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
        if (dmg > 0) {
            engine.emit('on_took_damage', char, char)
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
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
        if (dmg > 0) {
            engine.emit('on_took_damage', char, char)
        }
        return { damage: dmg, nextInterval: remainingTicks - 1 > 0 ? 1000 : 0 }
    }

    return { damage: 0, nextInterval: 0 }
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
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.extra?.sourceId as string) ?? '?',
            targetId: owner.id,
            status: buffName,
            amount: dmg,
        })
    }
}
