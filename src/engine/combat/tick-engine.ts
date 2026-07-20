import type { Character } from '../entities/character'
import type { BattleEngine } from './engine'
import { calcPoisonTickInterval, calcStunAttrRatio, calcStunAttrDelta, calcBleedDamage } from '../calc/damage'
import { getBuff } from '../../data/buffs'
import type { BuffDef } from '../../data/buffs'
import { BattleLog } from './battle-log'
import { applyAttrMods } from './utils/buff-layer'
import type { BuffLayer } from './types'
import { ATTR_CN } from '../entities/attributes'
import { DMG_PER_POISON_TICK } from '../constants'
import { round1 } from '../util/math'

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
                return this.#afterApplyBurn(enemy, engine)
        }
    }

    #afterApplyStun(enemy: Character, engine: BattleEngine, _tMs: number, _stacks: number, layer: BuffLayer): void {
        const STUN_RESET_WINDOW = 15000
        const trackKey = `stun_track::${enemy.id}`
        const lastData = engine.state.pendingBuffs.get(trackKey)
        const now = engine.state.turn.currentTime
        let consecutive = 0
        if (lastData && now - lastData.restoreValue < STUN_RESET_WINDOW) {
            consecutive = (lastData.extra?.consecutive as number) ?? 0
        }
        consecutive++
        engine.state.pendingBuffs.set(trackKey, { restoreValue: now, extra: { consecutive } })
        // 刷新递减窗口（移除旧的 reset 事件，重新调度）
        engine.state.turn.removeEvents(`stun_reset_${enemy.id}`)
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
            const result = applyAttrMods(enemy, engine.state, stunMods, '眩晕')
            // 存入 layer.mods 供 processBuffEnd 正确回退
            if (!layer.mods) layer.mods = {}
            Object.assign(layer.mods, result)
            const details = Object.entries(result)
                .map(([a, v]) => `${ATTR_CN[a] ?? a}${v > 0 ? '+' : ''}${v}`)
                .join(', ')
            if (details) {
                engine.emitLog({
                    type: 'system',
                    message: `[眩晕] ${BattleLog.name(enemy.name)} ${details}`,
                    actorId: enemy.id,
                })
            }
        }

        // 眩晕日志已通过 applyAttrMods 输出属性变化，不再重复输出"获得状态"
    }

    #afterApplyPoison(enemy: Character, engine: BattleEngine, tMs: number, layer: BuffLayer): void {
        if (!layer) {
            console.error(enemy, layer)
        }
        const stacks = layer.restoreValue ?? 0
        const mult = (layer.extra?.poisonMult as number) ?? 1
        let dmg = stacks * DMG_PER_POISON_TICK * mult
        if (engine.state.pendingBuffs.has(`poison_resist::${enemy.id}`)) {
            dmg = Math.round(dmg * 0.3 * 10) / 10
        }
        enemy.takeDamage(dmg)
        const buffName = getBuff('poison')?.name ?? '中毒'
        engine.emitLog({
            type: 'system',
            message: BattleLog.msg(
                buffName,
                enemy.name,
                `${stacks}层×${DMG_PER_POISON_TICK}${mult > 1 ? `×${mult}` : ''}=${dmg}伤害`,
            ),
            actorId: enemy.id,
        })
        // 每层各扣 1 跳
        if (layer.extra) {
            const ticks: number[] = (layer.extra.remainingTicks as number[]) ?? []
            let expired = 0
            const next = ticks
                .map((t) => t - 1)
                .filter((t) => {
                    if (t <= 0) {
                        expired++
                        return false
                    }
                    return true
                })
            if (next.length === 0) {
                engine.state.pendingBuffs.delete(`poison::${enemy.id}`)
                engine.state.turn.removeEvents(`tick_poison_${enemy.id}`)
                return
            }
            layer.restoreValue -= expired
            layer.extra = { ...layer.extra, remainingTicks: next }
        }
        // 调度 tick
        engine.state.turn.removeEvents(`tick_poison_${enemy.id}`)
        const interval = calcPoisonTickInterval(stacks)
        engine.state.turn.scheduleSystemEventAt(`tick_poison_${enemy.id}`, tMs + interval, 'tick_poison')
    }

    #afterApplyBurn(enemy: Character, engine: BattleEngine): void {
        // 已有 tick 在队列中时不再重复调度
        const existing = engine.state.turn.entries.find((e) => e.type === 'system' && e.id === `tick_burn_${enemy.id}`)
        if (existing) return
        // 用 eventTime + actionTimeOffset 算实际执行时间，而非 _tMs（不含 offset）
        const now = engine.state.eventTime + engine.state.actionTimeOffset
        engine.state.turn.scheduleSystemEventAt(`tick_burn_${enemy.id}`, now + 1000, 'tick_burn')
    }

    /** 中毒 tick 伤害 */
    onPoisonTick(charId: string, engine: BattleEngine): { nextInterval: number } {
        const key = `poison::${charId}`
        const entry = engine.state.pendingBuffs.get(key)
        if (!entry) return { nextInterval: 0 }

        const stacks = entry.restoreValue
        const mult = (entry.extra?.poisonMult as number) ?? 1
        let dmg = stacks * DMG_PER_POISON_TICK * mult
        if (engine.state.pendingBuffs.has(`poison_resist::${charId}`)) {
            dmg = round1(dmg * 0.4)
        }
        const char = engine.getCharacter(charId)
        if (!char) return { nextInterval: 0 }
        // onDebuffTick：遍历目标 buff 修改 DOT 伤害
        let finalDmg = dmg
        for (const [bk] of engine.state.pendingBuffs) {
            const [buffId, charId2] = bk.split('::')
            if (charId2 !== charId) continue
            const bDef = getBuff(buffId)
            if (!bDef?.onDebuffTick) continue
            const layer2 = engine.state.pendingBuffs.get(bk)
            if (!layer2) continue
            const result = bDef.onDebuffTick({
                debuffId: 'poison',
                target: char,
                damage: finalDmg,
                engine,
                layer: layer2,
            })
            if (result !== undefined) finalDmg = result
        }
        char.takeDamage(finalDmg)

        const buffName = getBuff('poison')?.name ?? '中毒'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'poison',
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
        if (dmg > 0) {
            engine.emit('on_took_damage', char, char)
        }

        // 每层各扣 1 跳
        const ticks: number[] = (entry.extra?.remainingTicks as number[]) ?? []
        let expired = 0
        const next = ticks
            .map((t) => t - 1)
            .filter((t) => {
                if (t <= 0) {
                    expired++
                    return false
                }
                return true
            })
        if (next.length === 0) {
            engine.state.pendingBuffs.delete(key)
            engine.state.turn.removeEvents(`tick_poison_${charId}`)
            engine.emitLog({
                type: 'system',
                message: `[${buffName}] ${BattleLog.name(char.name)} 毒素消退`,
                actorId: charId,
            })
            return { nextInterval: 0 }
        }
        entry.restoreValue -= expired
        entry.extra = { ...entry.extra, remainingTicks: next }

        const nextInterval = calcPoisonTickInterval(entry.restoreValue)
        return { nextInterval }
    }

    /** 灼烧 tick 伤害 */
    onBurnTick(charId: string, engine: BattleEngine): { nextInterval: number } {
        const key = `burn::${charId}`
        const entry = engine.state.pendingBuffs.get(key)
        if (!entry) return { nextInterval: 0 }

        const stacks = entry.restoreValue
        if (stacks <= 0) return { nextInterval: 0 }
        const dmg = 2 * stacks
        entry.restoreValue = stacks - 1
        const char = engine.getCharacter(charId)
        if (!char) return { nextInterval: 0 }
        char.takeDamage(dmg)
        // 石肤：灼烧伤害减半
        if (engine.state.pendingBuffs.has(`stone_skin::${charId}`)) {
            const halved = Math.round(dmg * 0.5)
            const diff = dmg - halved
            char.hp = Math.min(char.maxHp, char.hp + diff)
            engine.emitLog({
                type: 'system',
                message: `[石肤] ${char.name} 灼烧减半 ${halved}（减免${diff}）`,
                actorId: charId,
            })
        }
        const buffName = getBuff('burn')?.name ?? '灼烧'
        engine.emitLog({
            type: 'damage_over_time',
            actionId: 'burn',
            actionName: `${buffName}(${stacks}层)`,
            sourceId: (entry.sourceId as string) ?? '?',
            targetId: char.id,
            status: buffName,
            amount: dmg,
        })
        if (dmg > 0) {
            engine.emit('on_took_damage', char, char)
        }

        if (entry.restoreValue > 0) {
            return { nextInterval: 1000 }
        }
        // 灼烧结束，清除
        engine.state.pendingBuffs.delete(key)
        engine.state.turn.removeEvents(`tick_burn_${charId}`)
        return { nextInterval: 0 }
    }

    /** 行动触发流血伤害 */
    onBleedTrigger(owner: Character, engine: BattleEngine): void {
        const key = `bleed::${owner.id}`
        const entry = engine.state.pendingBuffs.get(key)
        if (!entry) return
        const stacks = entry.restoreValue
        const dmg = calcBleedDamage(stacks)
        if (dmg > 0) {
            // onDebuffTick：遍历目标 buff 修改 DOT 伤害
            let finalDmg = dmg
            for (const [bk] of engine.state.pendingBuffs) {
                const [buffId, charId2] = bk.split('::')
                if (charId2 !== owner.id) continue
                const bDef = getBuff(buffId)
                if (!bDef?.onDebuffTick) continue
                const layer2 = engine.state.pendingBuffs.get(bk)
                if (!layer2) continue
                const result = bDef.onDebuffTick({
                    debuffId: 'bleed',
                    target: owner,
                    damage: finalDmg,
                    engine,
                    layer: layer2,
                })
                if (result !== undefined) finalDmg = result
            }
            owner.takeDamage(finalDmg)
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
                sourceId: (entry.sourceId as string) ?? '?',
                targetId: owner.id,
                status: buffName,
                amount: dmg,
            })
        }
    }
}

export const tickEngine = new TickEngine()
