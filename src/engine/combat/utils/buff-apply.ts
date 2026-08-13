import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { AttrName } from '../../entities/attributes'
import type { BattleState, BuffLayer } from '../types'
import type { BuffDef } from '../../../data/buffs'
import { genAppId } from '../../util/buff-utils'
import { applyScaledAttrMods, scheduleBuffEnd } from './buff-layer'

/** super_armor 施加时清除的硬控 debuff */
const CC_DEBUFF_IDS = ['stun', 'knockdown', 'disarmed'] as const

/** 计算 buff 层存储 key：independent 叠层带 appId 后缀，其余为 `buffId::charId` */
export function buffLayerKey(buffId: string, charId: string, stacking: BuffDef['stacking'], tMs: number): string {
    const keyBase = `${buffId}::${charId}`
    return stacking?.type === 'independent' ? `${keyBase}::${genAppId(tMs)}` : keyBase
}

/** additive 叠层已存在时：增加层数后统一刷新持续时间（仅 duration 过期需要） */
export function refreshBuffExpiry(engine: BattleEngine, key: string, buff: BuffDef, char: Character): void {
    if (buff.expiry?.type === 'duration') {
        engine.state.turn.removeEvents(`buff_end_${key}`)
        scheduleBuffEnd(engine, key, buff, char)
    }
}

/** 将按层数缩放的属性修正合并进已有 layer.mods，返回本次 mods 明细（供日志使用） */
export function mergeScaledMods(
    layer: BuffLayer,
    buff: BuffDef,
    stacks: number,
    char: Character,
    state: BattleState,
): { mods: Record<string, number>; details: string[] } {
    const result = applyScaledAttrMods(buff, stacks, char, state)
    if (!layer.mods) layer.mods = {}
    for (const [attr, v] of Object.entries(result.mods)) {
        layer.mods[attr] = (layer.mods[attr] ?? 0) + (v as number)
    }
    return result
}

/** 累加 buff 的 AP 上限修正到角色与层数据（首次建层按 ×1，叠层按 ×stacks，与既有行为一致） */
export function applyMaxApMod(target: Character, layer: BuffLayer, buff: BuffDef, stacks: number): void {
    if (!buff.maxApMod || stacks <= 0) return
    target.maxApMod += buff.maxApMod * stacks
    if (!layer.mods) layer.mods = {}
    layer.mods.maxApMod = (layer.mods.maxApMod ?? 0) + buff.maxApMod * stacks
}

/** 统计某角色某 independent buff 的当前总层数 */
export function countIndependentLayers(state: BattleState, buffId: string, charId: string): number {
    const prefix = `${buffId}::${charId}::`
    let n = 0
    for (const k of state.pendingBuffs.keys()) if (k.startsWith(prefix)) n++
    return n
}

/** super_armor 施加时清除目标身上的硬控 */
export function clearCcOnSuperArmor(engine: BattleEngine, charId: string): void {
    for (const id of CC_DEBUFF_IDS) {
        const ck = `${id}::${charId}`
        if (engine.state.pendingBuffs.has(ck)) {
            engine.state.pendingBuffs.delete(ck)
            engine.state.turn.removeEvents('buff_end_' + ck)
        }
    }
}

/** 有 tickInterval 的 buff 建层后调度 tick 事件 */
export function scheduleBuffTick(engine: BattleEngine, key: string, buff: BuffDef): void {
    if (!buff.tickInterval) return
    engine.state.turn.removeEvents(`tick_buff_${key}`)
    engine.state.turn.scheduleSystemEventAt(
        `tick_buff_${key}`,
        engine.state.turn.currentTime + buff.tickInterval,
        'tick_buff',
    )
}

export interface ApplyBuffLayerOptions {
    buff: BuffDef
    /** 被施加者（add_buff=self，add_debuff=enemy） */
    target: Character
    /** 请求层数（add_debuff 为 roll 后成功层数；add_buff 为 e.stacks ?? 1） */
    stacks: number
    tMs: number
    /** 记录施法者 id（add_debuff 传 self.id） */
    sourceId?: string
    /** 叠加上限（缺省用 buff.stacking.max ?? Infinity） */
    max?: number
    /** 每叠一层的资源门槛（add_buff 传 applyStackGainCost 包装；返回实际允许层数，0=拦截） */
    stackGate?: (delta: number) => number
    /** additive 首次建层是否按上限截断（add_buff=false 保留历史行为；add_debuff=true） */
    capFirstApply?: boolean
}

export type ApplyNoopReason = 'none_exists' | 'max' | 'gated' | 'zero' | null

export interface ApplyBuffLayerResult {
    key: string
    layer?: BuffLayer
    /** 是否首次建层 */
    created: boolean
    /** 本次实际应用层数（无变更=0） */
    added: number
    /** 完全未变更的原因（null = 已生效） */
    noop: ApplyNoopReason
    /** 本次 attrMods 明细（日志用） */
    modsDetails: string[]
    /** independent 建层后的总层数 */
    totalIndependent: number
    /** 本次生效所用的叠加上限 */
    max: number
}

/**
 * 统一的 buff 层应用核心：封装 pendingBuffs 的全部读写
 * （key 解析 / 幂等跳过 / additive 叠层 / 首次建层 / 上限截断 / 资源门槛 /
 *  属性缩放 / AP 上限修正 / 过期调度 / 硬控清除 / tick 调度）。
 * add_buff 与 add_debuff 共用，返回结构化结果供上层做日志与事件广播。
 */
export function applyBuffLayer(engine: BattleEngine, opts: ApplyBuffLayerOptions): ApplyBuffLayerResult {
    const { buff, target, stacks, tMs, sourceId, max, stackGate, capFirstApply = false } = opts
    const state = engine.state
    const stacking = buff.stacking?.type ?? 'none'
    const key = buffLayerKey(buff.id, target.id, buff.stacking, tMs)
    const isIndependent = stacking === 'independent'
    const existing = !isIndependent ? state.pendingBuffs.get(key) : undefined
    const effectiveMax = max ?? (buff.stacking?.type === 'additive' ? (buff.stacking.max ?? Infinity) : Infinity)

    const noneResult = (noop: ApplyNoopReason): ApplyBuffLayerResult => ({
        key,
        created: false,
        added: 0,
        noop,
        modsDetails: [],
        totalIndependent: 0,
        max: effectiveMax,
    })

    // 已有且不可叠层（none）→ 幂等跳过
    if (existing && stacking !== 'additive') return noneResult('none_exists')

    // 已有 additive → 叠层
    if (existing && stacking === 'additive') {
        const newStacks = Math.min(effectiveMax, existing.restoreValue + stacks)
        const delta = newStacks - existing.restoreValue
        if (delta <= 0) {
            refreshBuffExpiry(engine, key, buff, target) // 已达上限，仍刷新时长
            return noneResult('max')
        }
        const allowed = stackGate ? stackGate(delta) : delta
        if (allowed <= 0) return noneResult('gated')
        existing.restoreValue += allowed
        refreshBuffExpiry(engine, key, buff, target)
        const { details } = mergeScaledMods(existing, buff, allowed, target, state)
        applyMaxApMod(target, existing, buff, allowed)
        return {
            key,
            layer: existing,
            created: false,
            added: allowed,
            noop: null,
            modsDetails: details,
            totalIndependent: countIndependentLayers(state, buff.id, target.id),
            max: effectiveMax,
        }
    }

    // 首次建层
    // 注意：stackGate（onStackGain 资源门槛）只对 additive 生效——其内部 Math.floor 会把
    // 非 additive 的分数层（如御物耗炁 yuwu_cost stacks:0.4）floor 成 0，导致耗炁失效
    let applied = stacking === 'additive' ? (capFirstApply ? Math.min(stacks, effectiveMax) : stacks) : stacks
    if (stackGate && stacking === 'additive') applied = stackGate(applied)
    if (stacking === 'additive' && applied <= 0) return noneResult('zero')
    const first = applyScaledAttrMods(buff, applied, target, state)
    const layer: BuffLayer = { restoreValue: applied, mods: { ...first.mods } }
    if (sourceId) layer.sourceId = sourceId
    applyMaxApMod(target, layer, buff, 1) // 首次建层按 ×1（与既有 add_buff 行为一致）
    state.pendingBuffs.set(key, layer)
    scheduleBuffEnd(engine, key, buff, target)
    if (buff.tags?.includes('super_armor')) clearCcOnSuperArmor(engine, target.id)
    scheduleBuffTick(engine, key, buff)
    return {
        key,
        layer,
        created: true,
        added: applied,
        noop: null,
        modsDetails: first.details,
        totalIndependent: isIndependent ? countIndependentLayers(state, buff.id, target.id) : applied,
        max: effectiveMax,
    }
}

/**
 * 部分移除 buff 层时按实际累积 mods（layer.mods）比例回退属性。
 * removed 为正数（移除层数）；例：2 层 vigor_stance 累积 +8力/-4敏，移除 1 层回退一半 +4/-2。
 */
export function partialRevertMods(layer: BuffLayer, removed: number, char: Character): void {
    const before = layer.restoreValue
    layer.restoreValue -= removed
    if (!layer.mods) return
    const ratio = removed / before
    for (const attr of Object.keys(layer.mods)) {
        const cur = layer.mods[attr] as number
        if (cur === 0) continue
        const revertVal = Math.round(cur * ratio)
        if (revertVal === 0) continue
        char.attrs.modify(attr as AttrName, -revertVal)
        layer.mods[attr] = cur - revertVal
    }
}
