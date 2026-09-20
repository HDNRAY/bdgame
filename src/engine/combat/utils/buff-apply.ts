import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import type { BattleState, BuffLayer } from '../types'
import type { BuffDef } from '../../../data/buffs'
import { genAppId } from '../../util/buff-utils'
import { applyScaledAttrMods, scheduleBuffEnd, removeBuffLayer } from './buff-layer'
import { forEachBuffOf, forEachHookOf } from './buff-loop'
import { notifyRegenChanged, affectsApRegen } from './ap-regen'
import { BattleLog } from '../battle-log'

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

/**
 * 本次施加的**层数上限覆盖**：取身上所有 `onBuffApply` 钩子的返回值里最大的那个（如「真假无用」上限翻倍）。
 *
 * 与 `applyStackGainCost` 一样，是 `add_buff` 效果与**附着 buff 物化**共用的同一份口径 ——
 * 两条路径都必须传，否则同一条数据在开局（物化）与战斗中（add_buff）表现不一致。
 */
export function getBuffMaxOverride(buff: BuffDef, engine: BattleEngine, charId: string): number {
    const raw = buff.stacking?.type === 'additive' ? (buff.stacking.max ?? Infinity) : Infinity
    let override: number | null = null
    forEachHookOf(engine.state.pendingBuffs, 'onBuffApply', charId, (bDef) => {
        const char = engine.getCharacter(charId)
        if (!char) return
        if (bDef.onBuffApply) {
            const val = bDef.onBuffApply(raw, char, engine)
            if (val > (override ?? 0)) override = val
        }
    })
    return override ?? raw
}

/** 收集角色身上所有 onStackGain 限制，取最小允许的 delta（0=拦截叠层；无钩子时仍按整数层取整） */
export function applyStackGainCost(engine: BattleEngine, char: Character, buffId: string, delta: number): number {
    let allowed = delta
    forEachHookOf(engine.state.pendingBuffs, 'onStackGain', char.id, (bDef) => {
        if (bDef.onStackGain) {
            const v = bDef.onStackGain({ char, buffId, delta: allowed, engine })
            if (v < allowed) allowed = v
        }
    })
    return Math.max(0, Math.floor(allowed))
}

/**
 * 把按层数缩放的属性修正**请求值**合并进 `layer.mods`（并记下 `modsPerStack`），返回本次明细。
 *
 * 存请求值而不是"实际生效量"：重算按请求值回放，掉层时按 `modsPerStack × 层数` 重算即可，
 * 不需要任何夹取感知的回退记账。
 */
export function mergeScaledMods(
    layer: BuffLayer,
    buff: BuffDef,
    stacks: number,
    char: Character,
    state: BattleState,
): { mods: Record<string, number>; details: string[] } {
    const result = applyScaledAttrMods(buff, stacks, char, state)
    if (!layer.mods) layer.mods = {}
    layer.modsPerStack = layer.modsPerStack ?? { ...result.perStack }
    for (const [attr, v] of Object.entries(result.requested)) {
        layer.mods[attr] = (layer.mods[attr] ?? 0) + (v as number)
    }
    return { mods: result.requested, details: result.details }
}

/** 累加 buff 的 AP 上限修正到角色与层数据（首次建层按 ×1，叠层按 ×stacks，与既有行为一致） */
export function applyMaxApMod(target: Character, layer: BuffLayer, buff: BuffDef, stacks: number): void {
    if (!buff.maxApMod || stacks <= 0) return
    target.maxApMod += buff.maxApMod * stacks
    if (!layer.mods) layer.mods = {}
    layer.mods.maxApMod = (layer.mods.maxApMod ?? 0) + buff.maxApMod * stacks
}

/** 统计某角色某 independent buff 的当前总层数（只遍历该角色自己的层，走 byOwner 索引） */
export function countIndependentLayers(state: BattleState, buffId: string, charId: string): number {
    let n = 0
    forEachBuffOf(state.pendingBuffs, charId, (_def, _layer, id, key) => {
        // independent 的 key 是 `buff::charId::appId`；非 independent 的同名层不算（与旧实现的前缀口径一致）
        if (id !== buffId) return
        if (key.indexOf('::', key.indexOf('::') + 2) < 0) return
        n++
    })
    return n
}

/** super_armor 施加时清除目标身上的硬控（只遍历该角色的层，先收集再删） */
export function clearCcOnSuperArmor(engine: BattleEngine, charId: string): void {
    const keys: string[] = []
    forEachBuffOf(engine.state.pendingBuffs, charId, (_def, _layer, buffId, key) => {
        if ((CC_DEBUFF_IDS as readonly string[]).includes(buffId)) keys.push(key)
    })
    for (const key of keys) removeBuffLayer(engine, key)
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
    /** 附着 buff：属性已折进来源层账，这里只建层承载 hooks（不再应用 attrMods） */
    skipAttrMods?: boolean
    /** 层归属的来源（'artifact:x' / 'weapon:y'），撤源时按它整批删 */
    originId?: string
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
    const { buff, target, stacks, tMs, sourceId, max, stackGate, capFirstApply = false, skipAttrMods, originId } = opts
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
        // 附着 buff 的层不碰属性（属性归来源层账），叠层只加层数
        const { details } = skipAttrMods ? { details: [] } : mergeScaledMods(existing, buff, allowed, target, state)
        if (skipAttrMods) existing.attrsInLedger = true
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
    const first = skipAttrMods
        ? { perStack: {}, requested: {}, applied: {}, details: [] }
        : applyScaledAttrMods(buff, applied, target, state)
    const layer: BuffLayer = skipAttrMods
        ? { restoreValue: applied, attrsInLedger: true }
        : { restoreValue: applied, mods: { ...first.requested }, modsPerStack: { ...first.perStack } }
    if (sourceId) layer.sourceId = sourceId
    if (originId) layer.originId = originId
    applyMaxApMod(target, layer, buff, 1) // 首次建层按 ×1（与既有 add_buff 行为一致）
    state.pendingBuffs.register(key, layer, buff)
    if (buff.onBuffApplied) {
        buff.onBuffApplied({ self: target, engine, state, layer, buffId: buff.id })
    }
    // 附着 buff 的"生效时刻"回调（恒有 engine）——attrMods 表达不了的生效行为写这里
    if (buff.onActivate) {
        buff.onActivate({ final: 0, raw: 0, target, attacker: target, engine, state, layer })
    }
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
 * 部分移除 buff 层：层数减 `removed`，按 `modsPerStack × 新层数` 重算请求值，然后重算属性。
 *
 * 例：2 层 vigor_stance 每层 +4力/-2敏，移除 1 层 → 请求值变 +4/-2，属性由重算得出
 * （不走"按比例回退 + 夹取感知记账"，也就不会在属性上下限边界上漂）。
 */
export function removeBuffStacks(state: BattleState, key: string, removed: number): void {
    const layer = state.pendingBuffs.get(key)
    if (!layer) return
    const char = state.characters.find((c) => c.id === key.split('::')[1])
    layer.restoreValue = Math.max(0, layer.restoreValue - removed)
    if (layer.modsPerStack) {
        layer.mods = {}
        for (const [attr, per] of Object.entries(layer.modsPerStack)) {
            const total = Math.round(per * layer.restoreValue * 10) / 10
            if (total !== 0) layer.mods[attr] = total
        }
    }
    if (char) char.rebuildDerived(state)
}

/**
 * 物化**附着 buff**（源顶层 `effects:[add_buff]`）：建层 + 与 `add_buff` 同款的「获得状态」日志与事件。
 *
 * 属性已折进来源层账（`skipAttrMods`），这里只建运行时层；日志/事件必须补齐，否则回放里这些
 * buff 会「凭空出现」（它们以前是触发槽挂的，那次会打日志）。
 *
 * `max` / `stackGate` 必须与 `add_buff` 效果处理器**同源**：这两项决定"本次实际叠了几层"
 * （上限覆盖 `onBuffApply`、资源门槛 `onStackGain` 的整数取整与缠劲消耗）。少传就会让同一条数据
 * 在开局（物化）与战斗中（add_buff）表现不一致 —— 例如 `nei_xi_peng_pai` 的 2.5 层不再被取整成 2。
 */
export function materializeAttachedBuff(
    engine: BattleEngine,
    target: Character,
    buff: BuffDef,
    stacks: number,
    originId: string,
): void {
    const r = applyBuffLayer(engine, {
        buff,
        target,
        stacks,
        tMs: engine.state.turn.currentTime,
        originId,
        skipAttrMods: true,
        max: getBuffMaxOverride(buff, engine, target.id),
        stackGate: (delta) => applyStackGainCost(engine, target, buff.id, delta),
    })
    if (r.noop) return
    // 真的建出层了 → 清掉"曾被移除"的记录，属性随之回来（再次装备 = 重新生效）
    target.reattachAttachedBuff(originId, buff.id)
    // 纯内部标记（hidden，如居合准备）只建层承载行为，不播报 —— 它的效果由 onActivate 触发的
    // 招式自己打日志/广播事件。纯属性携带者不建层（needsRuntimeLayer 为假），根本不走这里。
    if (buff.hidden) return
    const label = buff.name ?? buff.id
    const lv =
        buff.stacking?.type === 'additive'
            ? ` Lv.${r.added}${buff.stacking?.max ? `/${buff.stacking.max}` : ''}`
            : buff.stacking?.type === 'independent'
              ? ` 第${r.totalIndependent}层`
              : ''
    const desc = r.layer && buff.logFormat ? buff.logFormat(r.layer, target.name, target) : undefined
    engine.emitLog({
        type: 'system',
        message: r.created
            ? `${BattleLog.buffApply(label, target.name, desc ?? buff.description)}${lv}`
            : `${BattleLog.buffApply(label, target.name)} Lv.${r.layer?.restoreValue ?? 0}${r.max < Infinity ? `/${r.max}` : ''}`,
        actorId: target.id,
    })
    const opponent = engine.state.characters.find((c) => c.id !== target.id)
    if (opponent) {
        engine.emit('on_buff', target, opponent, buff.id)
        if (buff.tags?.includes('stance')) engine.emit('on_stance', target, opponent, buff.id)
    }
    if (affectsApRegen(buff.id)) notifyRegenChanged(engine.state, target)
}
