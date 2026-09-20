import type { BattleEngine } from '../engine'
import type { Character } from '../../entities/character'
import { ATTR_CN, type AttrName } from '../../entities/attributes'
import type { BattleState, BuffLayer } from '../types'
import type { BuffDef } from '../../../data/buffs'
import { forEachBuffOf, forEachHookOf } from './buff-loop'
import { BattleLog } from '../battle-log'
import type { TriggerEvent } from '../../entities/trigger'
import { calcDebuffDuration, calcBuffDuration } from '../../calc/damage'
import { MAX_HP_PER_VIT } from '../../calc/stats'
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

/** 一次属性修正的结果：requested 进层账（重算按它回放），applied 只用于日志 */
export interface AttrModResult {
    /** 请求写入的修正（过限制器之后、上下限夹取之前） */
    requested: Record<string, number>
    /** 实际写进 attrs 的增减（夹取之后） */
    applied: Record<string, number>
}

/**
 * 批量应用属性修正，合并为一条日志。
 *
 * 返回值分两笔：`requested` 是**请求值**（层里存这个，重算按它回放），`applied` 是本次实际
 * 生效量（只用于日志/展示）。**不要拿 applied 做回滚记账** —— 夹取后的数字一旦上下文变化就
 * 对不上（见 `LayerBase.mods` 的说明）。
 */
export function applyAttrMods(
    char: Character,
    state: BattleState,
    modsIn: Record<string, number>,
    _label: string,
    sourceTags?: string[],
): AttrModResult {
    const requested: Record<string, number> = {}
    const applied: Record<string, number> = {}
    for (const [attr, value] of Object.entries(modsIn)) {
        if (value === 0) continue
        let delta = value
        const cur = char.attrs.get(attr as AttrName)
        for (const check of char.statRestrictionChecks ?? []) {
            const result = check(char, attr, cur, delta, sourceTags, state)
            if (!result) continue
            if (result.skip) {
                delta = 0
                break
            }
            if (result.delta !== undefined) delta = result.delta
        }
        if (delta === 0) continue
        requested[attr] = delta
        const before = char.attrs.get(attr as AttrName)
        char.attrs.modify(attr as AttrName, delta)
        const after = char.attrs.get(attr as AttrName)
        const actual = after - before
        if (actual !== 0) applied[attr] = actual
    }
    // 根骨增加 → 按比例增加剩余血量（切走时不降）
    if ('vitality' in applied && applied.vitality > 0) {
        const oldMax = char.maxHp - applied.vitality * MAX_HP_PER_VIT
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
    return { requested, applied }
}

/**
 * 移除一层 buff：删层 → 重算该角色属性。
 *
 * **不要直接 `pendingBuffs.delete(key)`** —— 那会把这层加过的属性永久留在角色身上
 * （身法/灵巧/推演被悄悄吃掉，且回不来）。净化、霸体清硬控、消耗型 buff 都踩过这个坑。
 *
 * 这里没有"反函数"：属性 = base 按序回放（来源层 ops → 战斗层 mods），删层后重算即可，
 * 夹取边界上也不会像按 `applied` 回退那样漂。
 */
export function removeBuffLayer(engine: BattleEngine, key: string): void {
    dropBuffLayer(engine.state, key)
}

/**
 * 删层 + 重算属性，但**不跑属性变化副作用**（血比例调整 / 推演变化重排 AP 回复）。
 *
 * 只给「被汲取方的配对账」（`stat_transfer_drain::`）用：它记录的是对方被扣走的那笔属性，
 * 到期还回去时与改造前（HEAD 的 `target.attrs.modify` 直写）同口径 —— 不额外通知 AP 回复重排，
 * 也不按根骨变化回调血比例。不这么写会让同一笔属性在两个版本里对 AP 时间轴产生不同影响。
 */
export function dropBuffLayerQuiet(state: BattleState, key: string): void {
    const layer = state.pendingBuffs.get(key)
    if (!layer) return
    state.pendingBuffs.delete(key)
    state.turn.removeEvents('buff_end_' + key)
    const owner = state.characters.find((c) => c.id === key.split('::')[1])
    owner?.rebuildDerived(state)
}

/**
 * 删层 + 重算（不需要 engine 的版本，数据层 hook 只有 `state` 时用这个）。
 *
 * 属性由「base 按序回放」得出，所以删层只需删条目 —— 没有 `revertBuffMods` 那种逆运算，
 * 也不会像按 `applied` 回退那样在属性上下限边界上漂。
 */
export function dropBuffLayer(state: BattleState, key: string): void {
    const layer = state.pendingBuffs.get(key)
    if (!layer) return
    const owner = state.characters.find((c) => c.id === key.split('::')[1])
    // maxApMod 不在六属性里、`rebuildDerived` 也不回放它（`applyMaxApMod` 直接记在角色字段上），
    // 所以删层时必须在这里单独退——附着 buff 的 AP 上限载体（占内息上限）也走这条账。
    if (owner && typeof layer.mods?.maxApMod === 'number') owner.maxApMod -= layer.mods.maxApMod
    const hpBefore = owner?.hp ?? 0
    const maxHpBefore = owner?.maxHp ?? 0
    const vitBefore = owner?.attrs.get('vitality') ?? 0
    const wisBefore = owner?.attrs.get('wisdom') ?? 0
    // 附着 buff（有 originId）被运行时移除（消耗/净化/到期）→ 它在来源层账上的属性也要停掉
    if (owner && layer.originId) owner.detachAttachedBuff(layer.originId, key.split('::')[0])
    state.pendingBuffs.delete(key)
    state.turn.removeEvents('buff_end_' + key)
    if (owner) {
        owner.rebuildDerived(state)
        applyAttrChangeSideEffects(owner, state, hpBefore, maxHpBefore, vitBefore, wisBefore)
    }
}

/**
 * 动态属性修正的唯一入口（数据层 hook 用）：把**请求值**写进层，然后重算。
 *
 * 取代旧的「`revertBuffMods` 退掉旧值 → `applyAttrMods` 写新值 → `layer.mods = applied`」三步 ——
 * 那套记的是夹取后的实际量，重算时对不上（见 `LayerBase.mods`）。
 */
export function setLayerMods(
    layer: BuffLayer,
    char: Character,
    state: BattleState,
    mods: Record<string, number>,
): void {
    // 限制器只在"真正改这一层"的时刻跑一次（带概率的限制器会消耗随机数，不能每次重算都掷）；
    // 结果存进 layer.mods，重算回放时直接写，不再过限制器。
    const clean: Record<string, number> = {}
    for (const [attr, v] of Object.entries(mods)) {
        // maxApMod 不在六属性里，走 applyMaxApMod 单独记账
        if (v === 0 || attr === 'maxApMod') continue
        let delta = v
        for (const check of char.statRestrictionChecks ?? []) {
            const r = check(char, attr, char.attrs.get(attr as AttrName), delta, undefined, state)
            if (!r) continue
            if (r.skip) {
                delta = 0
                break
            }
            if (r.delta !== undefined) delta = r.delta
        }
        if (delta !== 0) clean[attr] = delta
    }
    const hpBefore = char.hp
    const maxHpBefore = char.maxHp
    const vitBefore = char.attrs.get('vitality')
    const wisBefore = char.attrs.get('wisdom')
    layer.mods = Object.keys(clean).length > 0 ? clean : undefined
    char.rebuildDerived(state)
    applyAttrChangeSideEffects(char, state, hpBefore, maxHpBefore, vitBefore, wisBefore)
}

/**
 * 属性变化的两条副作用，与旧实现同一口径（重算路径也必须补上，否则动态属性修正会比旧实现
 * 凭空少回血/回炁，或者只上不下、血量随时间往上爬）：
 *  - 上限掉了（根骨降低）→ 按比例掉血（旧 `revertBuffMods`：`hp × 新上限/旧上限`，保底 1）
 *  - 根骨增加 → 按比例增加剩余血量（旧 `applyAttrMods`：按 `新上限 − Δ根骨×每点根骨气血` 估旧上限，比例 ≥1 即回满）
 *  - 推演变化 → AP 回复率变化，重算该角色下次行动时间
 */
export function applyAttrChangeSideEffects(
    char: Character,
    state: BattleState,
    hpBefore: number,
    maxHpBefore: number,
    vitBefore: number,
    wisBefore: number,
): void {
    const vitAfter = char.attrs.get('vitality')
    if (char.maxHp < maxHpBefore && maxHpBefore > 0) {
        char.hp = Math.max(1, Math.round(hpBefore * (char.maxHp / maxHpBefore)))
    } else if (vitAfter > vitBefore) {
        const dVit = vitAfter - vitBefore
        const oldMaxEstimate = char.maxHp - dVit * MAX_HP_PER_VIT
        const ratio = oldMaxEstimate > 0 ? hpBefore / oldMaxEstimate : 1
        char.hp = Math.round(char.maxHp * Math.min(ratio, 1))
    }
    if (char.attrs.get('wisdom') !== wisBefore) notifyRegenChanged(state, char)
}

/** `setLayerMods` 的累加版（神照这类按阶段追加洞察的 buff） */
export function addLayerMods(
    layer: BuffLayer,
    char: Character,
    state: BattleState,
    mods: Record<string, number>,
): void {
    const merged: Record<string, number> = { ...(layer.mods ?? {}) }
    for (const [attr, v] of Object.entries(mods)) {
        if (attr === 'maxApMod') continue
        const next = (merged[attr] ?? 0) + v
        if (next === 0) delete merged[attr]
        else merged[attr] = next
    }
    setLayerMods(layer, char, state, merged)
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
    const hpBefore = target.hp
    target.heal(amount)
    const healed = Math.round((target.hp - hpBefore) * 10) / 10
    reduceBleedOnHeal(engine, target.id, amount)
    engine.emitLog({
        type: 'heal',
        actionId: action?.id ?? '_heal',
        actionName: action?.name ?? '治疗',
        sourceId: target.id,
        targetId: target.id,
        amount,
        effective: healed,
        overheal: Math.round((amount - healed) * 10) / 10,
    })
    // 通知所有 buff 持有者收到治疗
    forEachHookOf(engine.state.pendingBuffs, 'onReceiveHeal', target.id, (def, layer) => {
        if (def.onReceiveHeal) {
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

/** 一个待消耗的层：除 key 外还带层对象本身，收尾时用来确认「还是当时那一层」 */
export interface ConsumedBuffRef {
    key: string
    layer: BuffLayer
    buffId: string
    ownerId: string
    name: string
}

/**
 * 收集该角色身上「应被 `trigger` 消耗」的层，但**不删**（配套 `removeCollectedBuffs`）。
 *
 * 给「反应先跑、消耗收尾」的时机（目前只有招架）：同时声明 `expiry.consumed/on_parry`
 * 和 `onParry` 钩子的 buff（听潮式=招架回气），若先删层，它自己的钩子就永远等不到。
 */
export function collectConsumedBuffs(charId: string, engine: BattleEngine, trigger: TriggerEvent): ConsumedBuffRef[] {
    const refs: ConsumedBuffRef[] = []
    forEachBuffOf(engine.state.pendingBuffs, charId, (def, layer, buffId, key, ownerId) => {
        if (def?.expiry?.type !== 'consumed' || def.expiry.trigger !== trigger) return
        refs.push({ key, layer, buffId, ownerId, name: def.name ?? buffId })
    })
    return refs
}

/**
 * 删除 `collectConsumedBuffs` 收集到的层，并补一条「状态消耗」日志。
 *
 * 只删「还是当时那一层」的条目：收集与删除之间会跑反应（触发器招式 / buff 钩子），
 * 反应里若重新施加了同一 id 的 buff（招架后重新起式那类），那是**新层**，不能被误删。
 */
export function removeCollectedBuffs(engine: BattleEngine, refs: readonly ConsumedBuffRef[]): void {
    for (const ref of refs) {
        if (engine.state.pendingBuffs.get(ref.key) !== ref.layer) continue
        removeBuffLayer(engine, ref.key)
        // 触发型消耗：记录一条「状态消耗」日志（惊击/心眼/看破 等一次性 buff 被触发消耗）
        engine.emitLog({
            type: 'system',
            message: BattleLog.msg(ref.name, engine.getCharacter(ref.ownerId)?.name ?? ref.ownerId, '状态消耗'),
            actorId: ref.ownerId,
        })
    }
}

/** 根据 trigger 消耗该角色的 consumed buff（收集完立刻删） */
export function consumeBuffsByTrigger(charId: string, engine: BattleEngine, trigger: TriggerEvent): void {
    removeCollectedBuffs(engine, collectConsumedBuffs(charId, engine, trigger))
}

/**
 * 缩放并应用属性修正，返回 `{ perStack, requested, applied, details }`。
 *
 * `perStack` 是**每层请求值**（层里存进 `modsPerStack`，掉层时按它重算 `mods`）；
 * `requested` = 本次全部层数的请求值；`applied` = 本次实际生效量（只用于日志）。
 */
export function applyScaledAttrMods(
    buff: BuffDef,
    stacks: number,
    char: Character,
    state: BattleState,
): { perStack: Record<string, number>; requested: Record<string, number>; applied: Record<string, number>; details: string[] } {
    const details: string[] = []
    if (!buff.attrMods) return { perStack: {}, requested: {}, applied: {}, details }
    const perStack: Record<string, number> = {}
    const scaled: Record<string, number> = {}
    for (const [attr, val] of Object.entries(buff.attrMods)) {
        perStack[attr] = round1(val as number)
        scaled[attr] = round1((val as number) * stacks)
    }
    const { requested, applied } = applyAttrMods(char, state, scaled, buff.name, buff.tags)
    // 日志优先报实际生效量；被完全夹掉（applied 里没有）时退回请求值，别让玩家看到空行
    for (const attr of Object.keys(requested)) {
        const rounded = round1(applied[attr] ?? requested[attr])
        details.push(`${ATTR_CN[attr] ?? attr}${rounded > 0 ? '+' : ''}${rounded}`)
    }
    return { perStack, requested, applied, details }
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
