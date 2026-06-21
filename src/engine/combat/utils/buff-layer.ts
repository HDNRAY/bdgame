import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { BuffLayer } from '../types'
import { getBuff } from '../../data/buffs'
import { ATTR_CN } from '../../entities/attributes'
import { BattleLog } from '../battle-log'
import type { TriggerEvent } from '../../entities/trigger'

/** 调度 buff 过期事件 */
export function scheduleBuffExpiry(engine: BattleEngine, layerKey: string, duration: number): void {
    engine.state.turn.scheduleSystemEventAt(
        `buff_end_${layerKey}`,
        engine.state.turn.currentTime + duration,
        'buff_end',
    )
}

/**
 * 批量应用属性修正，合并为一条日志，自动触发相关副作用（recalcInterval 等）。
 * @returns 实际应用的 mods 记录（用于 later reversal）
 */
export function applyAttrMods(
    char: Character,
    engine: BattleEngine,
    modsIn: Record<string, number>,
    label: string,
    sourceTags?: string[],
): Record<string, number> {
    const applied: Record<string, number> = {}
    for (const [attr, value] of Object.entries(modsIn)) {
        if (value === 0) continue
        let delta = value
        const cur = char.attrs.get(attr as AttrName)
        for (const check of char.statRestrictionChecks ?? []) {
            const result = check(char, attr, cur, delta, sourceTags)
            if (!result) continue
            if (result.skip) {
                delta = 0
                break
            }
            if (result.delta !== undefined) delta = result.delta
        }
        if (delta === 0) continue
        char.attrs.modify(attr as AttrName, delta)
        applied[attr] = delta
    }
    // 合并为一条日志
    const details = Object.entries(applied)
        .map(([a, v]) => `${ATTR_CN[a] ?? a}${v > 0 ? '+' : ''}${v}`)
        .join(', ')
    engine.emitLog({
        type: 'system',
        message: `[${label}] ${BattleLog.name(char.name)} ${details}`,
        actorId: char.id,
    })
    // 根骨增加 → 按比例增加剩余血量（切走时不降）
    if ('vitality' in applied && applied.vitality > 0) {
        const oldMax = char.maxHp - applied.vitality * 18
        const ratio = oldMax > 0 ? char.hp / oldMax : 1
        char.hp = Math.round(char.maxHp * Math.min(ratio, 1))
    }
    // 身法变化 → 重新计算回合间隔
    if ('agility' in applied) {
        engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'), char.getHaste())
    }
    // 属性变化后封顶 hp/ap
    if (char.hp > char.maxHp) char.hp = char.maxHp
    if (char.ap > char.maxAp) char.ap = char.maxAp
    return applied
}

/** 反转 buff 的属性修正 */
export function revertBuffMods(layer: BuffLayer | undefined, char: Character, engine: BattleEngine): void {
    if (!layer?.mods) return
    for (const [attr, delta] of Object.entries(layer.mods)) {
        char.attrs.modify(attr as AttrName, -(delta as number))
        if (attr === 'agility') engine.state.turn.recalcInterval(char.id, char.attrs.get('agility'), char.getHaste())
    }
    // 属性下降后封顶 hp/ap
    if (char.hp > char.maxHp) char.hp = char.maxHp
    if (char.ap > char.maxAp) char.ap = char.maxAp
}

/** 治疗时减少流血层数：每 healPerStack 点治疗减少 1 层，溢出不累计 */
export function reduceBleedOnHeal(engine: BattleEngine, charId: string, amount: number, healPerStack = 8): void {
    if (amount < healPerStack) return
    const bleedKey = `bleed::${charId}`
    const bleedLayer = engine.state.pendingBuffs.get(bleedKey)
    if (!bleedLayer || bleedLayer.restoreValue <= 0) return
    const reduce = Math.min(bleedLayer.restoreValue, Math.floor(amount / healPerStack))
    if (reduce <= 0) return
    bleedLayer.restoreValue -= reduce
    const char = engine.getCharacter(charId)
    engine.emitLog({
        type: 'system',
        message: `[治疗] ${BattleLog.name(char?.name ?? '')} 流血-${reduce}层`,
        actorId: charId,
    })
}

/** 检查某人是否有某 buff */
export function hasBuff(engine: BattleEngine, charId: string, buffId: string): boolean {
    return engine.state.pendingBuffs.has(`${buffId}::${charId}`)
}

/** 根据 trigger 消耗该角色的 consumed buff */
export function consumeBuffsByTrigger(charId: string, engine: BattleEngine, trigger: TriggerEvent): void {
    for (const [k] of engine.state.pendingBuffs) {
        const parts = k.split('::')
        if (parts.length < 2 || parts[1] !== charId) continue
        const def = getBuff(parts[0])
        if (def?.expiry?.type !== 'consumed' || def.expiry.trigger !== trigger) continue
        engine.state.pendingBuffs.delete(k)
    }
}
