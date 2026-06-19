import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import { calcPoisonTickInterval, calcStunAttrRatio, calcStunAttrDelta } from '../calc/damage'
import { getBuff } from '../data/buffs'
import type { BuffDef } from '../data/buffs'
import { BattleLog } from './battle-log'
import { applyAttrMods } from './utils/buff-layer'
import type { BuffLayer } from './types'

/** 流血伤害计算 */
function triggerBleed(stacks: number): number {
    return Math.floor(stacks * 1.5)
}

export interface AfterApplyDebuffCtx {
    enemy: Character
    engine: BattleEngine
    tMs: number
    buffDef: BuffDef
    stacks: number
    layerKey: string
    layer: BuffLayer
}

export class TickEngine {
    /** debuff 应用后处理（stun 连续计数/poison 首 tick/burn 调度 tick） */
    afterApplyDebuff(ctx: AfterApplyDebuffCtx): void {
        const { enemy, engine, tMs, buffDef, stacks, layer } = ctx
        switch (buffDef.id) {
            case 'stun':
                return this.#afterApplyStun(enemy, engine, tMs, stacks, layer)
            case 'poison':
                return this.#afterApplyPoison(enemy, engine, tMs, layer)
            case 'burn':
                return this.#afterApplyBurn(enemy, engine, tMs)
        }
    }

    #afterApplyStun(enemy: Character, engine: BattleEngine, _tMs: number, _stacks: number, layer: BuffLayer): void {
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
        const stunMods: Record<string, number> = {}
        if (agiDelta !== 0) stunMods.agility = agiDelta
        if (insDelta !== 0) stunMods.insight = insDelta
        if (Object.keys(stunMods).length > 0) {
            const result = applyAttrMods(enemy, engine, stunMods, '眩晕')
            // 存入 layer.mods 供 processBuffEnd 正确回退
            if (!layer.mods) layer.mods = {}
            Object.assign(layer.mods, result)
        }

        // 眩晕日志已通过 applyAttrMods 输出属性变化，不再重复输出"获得状态"
    }

    #afterApplyPoison(enemy: Character, engine: BattleEngine, tMs: number, layer: BuffLayer): void {
        const totalStacks = layer.restoreValue
        let dmg = totalStacks * 2
        if (engine.state.pendingBuffs.has(`poison_resist::${enemy.id}`)) {
            dmg = Math.round(dmg * 0.3 * 10) / 10
        }
        enemy.takeDamage(dmg)
        const buffName = getBuff('poison')?.name ?? '中毒'
        engine.emitLog({
            type: 'system',
            message: BattleLog.msg(buffName, enemy.name, `${totalStacks}层×2=${dmg}伤害`),
            actorId: enemy.id,
        })
        // 调度 tick
        engine.state.turn.removeEvents(`tick_poison_${enemy.id}`)
        const interval = calcPoisonTickInterval(totalStacks)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval, 'tick_poison')
    }

    #afterApplyBurn(enemy: Character, engine: BattleEngine, tMs: number): void {
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, tMs + 1000, 'tick_burn')
    }

    /** 中毒 tick 伤害 */
    onPoisonTick(charId: string, engine: BattleEngine): { nextInterval: number } {
        const key = `poison::${charId}`
        const entry = engine.state.pendingBuffs.get(key)
        if (!entry) return { nextInterval: 0 }

        const stacks = entry.restoreValue
        let dmg = stacks * 2
        if (engine.state.pendingBuffs.has(`poison_resist::${charId}`)) {
            dmg = Math.round(dmg * 0.3 * 10) / 10
        }
        const char = engine.getCharacter(charId)
        if (!char) return { nextInterval: 0 }
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
        return { nextInterval }
    }

    /** 灼烧 tick 伤害 */
    onBurnTick(charId: string, engine: BattleEngine): { nextInterval: number } {
        const key = `burn::${charId}`
        const entry = engine.state.pendingBuffs.get(key)
        if (!entry) return { nextInterval: 0 }

        const stacks = entry.restoreValue
        const burnBaseDamage = (entry.extra?.burnBaseDamage as number) ?? 0
        const remainingTicks = (entry.extra?.remainingTicks as number) ?? 0
        if (!burnBaseDamage || !remainingTicks) return { nextInterval: 0 }
        const dmg = Math.round(burnBaseDamage * (stacks / (stacks + remainingTicks)))
        entry.extra = { ...entry.extra, remainingTicks: remainingTicks - 1 }
        entry.restoreValue = Math.max(0, stacks - 1)
        const char = engine.getCharacter(charId)
        if (!char) return { nextInterval: 0 }
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
        return { nextInterval: remainingTicks - 1 > 0 ? 1000 : 0 }
    }

    /** 行动触发流血伤害 */
    onBleedTrigger(owner: Character, engine: BattleEngine): void {
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
}

export const tickEngine = new TickEngine()
