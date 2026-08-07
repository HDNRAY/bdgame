import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import { ATTR_CN, type AttrName } from '../../entities/attributes'
import type { BattleState, BuffLayer } from '../types'
import type { BuffDef } from '../../../data/buffs'
import { forEachBuffOf } from './buff-loop'
import { BattleLog } from '../battle-log'
import type { TriggerEvent } from '../../entities/trigger'
import { calcDebuffDuration, calcBuffDuration } from '../../calc/damage'
import { notifyRegenChanged } from './ap-regen'
import { round1 } from '../../util/math'

/** 调度 buff 过期事件 */
export function scheduleBuffExpiry(engine: BattleEngine, layerKey: string, duration: number): void {
    engine.state.turn.scheduleSystemEventAt(
        `buff_end_${layerKey}`,
        engine.state.turn.currentTime + duration,
        'buff_end',
    )
}

/**
 * 批量应用属性修正，合并为一条日志。
 * @returns 实际应用的 mods 记录（用于 later reversal）
 */
export function applyAttrMods(
    char: Character,
    state: BattleState,
    modsIn: Record<string, number>,
    _label: string,
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
        const before = char.attrs.get(attr as AttrName)
        char.attrs.modify(attr as AttrName, delta)
        const after = char.attrs.get(attr as AttrName)
        const actual = after - before
        if (actual === 0) continue
        applied[attr] = actual
    }
    // 根骨增加 → 按比例增加剩余血量（切走时不降）
    if ('vitality' in applied && applied.vitality > 0) {
        const oldMax = char.maxHp - applied.vitality * 18
        const ratio = oldMax > 0 ? char.hp / oldMax : 1
        char.hp = Math.round(char.maxHp * Math.min(ratio, 1))
    }
    // 推演变化 → AP 回复率变化，重算该角色下次行动时间
    if ('wisdom' in applied) {
        notifyRegenChanged(state, char)
    }
    // 属性变化后封顶 hp/ap
    if (char.hp > char.maxHp) char.hp = char.maxHp
    if (char.ap > char.maxAp) char.ap = char.maxAp
    return applied
}

/** 反转 buff 的属性修正 */
export function revertBuffMods(layer: BuffLayer | undefined, char: Character, state: BattleState): void {
    if (!layer?.mods) return
    const oldMaxHp = char.maxHp
    let wisdomChanged = false
    for (const [attr, delta] of Object.entries(layer.mods)) {
        char.attrs.modify(attr as AttrName, -(delta as number))
        if (attr === 'wisdom') wisdomChanged = true
    }
    if (wisdomChanged) notifyRegenChanged(state, char)
    // 根骨减少 → 按比例减少血量
    if (oldMaxHp > char.maxHp) {
        char.hp = Math.max(1, Math.round(char.hp * (char.maxHp / oldMaxHp)))
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

/** 应用一次治疗：回血 + 减流血 + 治疗日志 + 通知所有 buff 的 onReceiveHeal */
export function applyHeal(
    engine: BattleEngine,
    target: Character,
    amount: number,
    action?: { id?: string; name?: string },
): void {
    if (amount <= 0) return
    target.heal(amount)
    reduceBleedOnHeal(engine, target.id, amount)
    engine.emitLog({
        type: 'heal',
        actionId: action?.id ?? '_heal',
        actionName: action?.name ?? '治疗',
        sourceId: target.id,
        targetId: target.id,
        amount,
    })
    // 通知所有 buff 持有者收到治疗
    forEachBuffOf(engine.state.pendingBuffs, target.id, (def, layer) => {
        if (def?.onReceiveHeal) {
            def.onReceiveHeal({
                final: amount,
                raw: amount,
                target,
                attacker: target,
                engine,
                state: engine.state,
                layer,
            })
        }
    })
}

/** 检查某人是否有架势 buff（tag 含 'stance'） */
export function hasNoStance(pendingBuffs: Map<string, unknown>, charId: string): boolean {
    let hasStance = false
    forEachBuffOf(pendingBuffs as Map<string, BuffLayer>, charId, (def) => {
        if (def?.tags.includes('stance')) {
            hasStance = true
            return false
        }
    })
    return !hasStance
}

/** 根据 trigger 消耗该角色的 consumed buff */
export function consumeBuffsByTrigger(charId: string, engine: BattleEngine, trigger: TriggerEvent): void {
    forEachBuffOf(engine.state.pendingBuffs, charId, (def, _layer, _buffId, key) => {
        if (def?.expiry?.type !== 'consumed' || def.expiry.trigger !== trigger) return
        engine.state.pendingBuffs.delete(key)
    })
}

/** 缩放并应用 attrMods，返回 { mods, details } */
export function applyScaledAttrMods(
    buff: BuffDef,
    stacks: number,
    char: Character,
    state: BattleState,
): { mods: Record<string, number>; details: string[] } {
    const mods: Record<string, number> = {}
    const details: string[] = []
    if (!buff.attrMods) return { mods, details }
    const scaled: Record<string, number> = {}
    for (const [attr, val] of Object.entries(buff.attrMods)) {
        scaled[attr] = round1((val as number) * stacks)
    }
    const result = applyAttrMods(char, state, scaled, buff.name, buff.tags)
    for (const [attr, v] of Object.entries(result)) {
        const rounded = round1(v as number)
        details.push(`${ATTR_CN[attr] ?? attr}${rounded > 0 ? '+' : ''}${rounded}`)
        mods[attr] = rounded
    }
    return { mods, details }
}

/** 根据 buff expiry 类型调度到期事件 */
export function scheduleBuffEnd(engine: BattleEngine, key: string, buff: BuffDef, char: Character): void {
    const now = engine.state.eventTime
    // 炁蕴绵长等：推演延长自身增益时长（减益不长，敌方减益不受影响）
    const mult = buff.tags?.includes('debuff') ? 1 : char.getBuffDurationMult()
    if (buff.expiry?.type === 'duration') {
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, now + Math.round(buff.expiry.ms * mult), 'buff_end')
    } else if (buff.expiry?.type === 'duration_by_attr') {
        const duration = calcDebuffDuration(buff.expiry.multiplier, char.attrs.get(buff.expiry.attr))
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, now + Math.round(duration * mult), 'buff_end')
    } else if (buff.expiry?.type === 'attr_mult') {
        const duration = calcBuffDuration(char.attrs.get(buff.expiry.attr), buff.expiry.multiplier)
        engine.state.turn.scheduleSystemEventAt(`buff_end_${key}`, now + Math.round(duration * mult), 'buff_end')
    }
}
