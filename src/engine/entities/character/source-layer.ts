import type { AttrName } from '../attributes'
import type { EffectDef } from '../action'
import type { Tag } from '../tag'
import type { Character } from '.'
import type { BattleState, LayerBase, ModTable } from '../../combat/types'
import { forEachBuffOf } from '../../combat/utils/buff-loop'
import { getBuff, type BuffDef } from '../../../data/buffs'
import { round1 } from '../../util/math'

/** 构造期属性限制回调（stat_restriction） */
export type StatRestrictionCheck = (
    char: Character,
    attr: string,
    current: number,
    delta: number,
    sourceTags?: string[],
    state?: BattleState,
) => { skip?: boolean; delta?: number } | null

/** 来源种类（层账里记录，便于调试与按来源撤销） */
export type SourceKind = 'passive' | 'talent' | 'artifact' | 'weapon' | 'offhand'

/**
 * 一条来源内的**有序操作**。
 *
 * 为什么必须保序：旧实现是「按 effects 声明顺序逐条应用」，而 `stat_restriction` 是**注册后**才对
 * 后续 mod 生效的（例如渊渟岳峙的「力道/身法/灵巧不可降低」只在它被 push 之后才拦得住灵器共鸣的 -2）。
 * 因此层里除了聚合字段，还要留下这份有序操作表，重算时按它回放才能与旧行为逐字节一致。
 */
export type SourceOp =
    | { kind: 'convert'; from: AttrName; to: AttrName[]; ratio: number; mode: 'round' | 'floor' }
    /** `fromBuff` = 这条修正来自该来源自带的哪条附着 buff（运行时被消耗/移除时要能单独撤掉） */
    | { kind: 'mod'; attr: AttrName; value: number; fromBuff?: string }
    | { kind: 'restriction'; check: StatRestrictionCheck }

/** 属性换算（attr_convert）：重算时读「已应用到此」的属性值，与旧的逐条应用语义一致 */
export interface SourceConvert {
    from: AttrName
    to: AttrName[]
    ratio: number
    mode: 'round' | 'floor'
}

/**
 * 一条来源带来的**全部构造期修正**（功法/天赋/奇物/武器各一条）。
 *
 * 以前这些修正是直接改角色字段（attrs / maxHpMod / triggerSlotMod / 武器 tag /
 * statRestrictionChecks / buffDurationCallbacks）、没有账本，所以撤不掉（探云手偷奇物后对方还留着加成、
 * 切武器只能手写反函数）。现在它们统一记在层账上：
 *   attrs = baseAttrs + Σ 各层修正，撤销 = 删层 + 重算。
 * 各字段都是「请求值」；重算按 `ops` 顺序回放（restriction 夹取后写入 attrs）并回填 `applied`。
 */
export interface SourceLayer extends LayerBase {
    /** 统一标识 = sourceId（与 LayerBase.id 同值，便于两边用同一套读代码） */
    id: string
    origin: 'source'
    sourceId: string
    kind: SourceKind
    /** 重算时**实际生效**的属性增减（夹取/取整之后；展示用，重算一律按 `ops` 回放） */
    applied: ModTable
    /** 有序操作（重算按此回放）：mods → converts → restriction，顺序即语义 */
    ops: SourceOp[]
    maxHpMod: number
    triggerSlotMod: number
    weaponTags: Tag[]
    durationMults: ((char: Character) => number)[]
    /** 传给属性限制回调的来源标签（武器用 ['weapon']，其余空） */
    sourceTags?: string[]
    /**
     * 这条来源**自带的 buff**（顶层 `effects:[add_buff]`）—— 记录**全部**（含纯属性携带者）。
     *
     * 属性部分已经折进 `mods`/`ops`（构造期生效）；这份记录有两个用途：
     *  1) 物化：`materializeAttached` 只对 `needsRuntimeLayer(def)` 为真的建战斗层（承载 hooks）；
     *  2) 展示：`Engine.getBuffsForDisplay` 把「账上有、但没建层」的补进战斗界面 buff 列表。
     */
    attachedBuffs: { buffId: string; stacks: number }[]
}

/**
 * 这条附着 buff 是否需要**运行时实例**（战斗层）。
 *
 * 纯属性携带者（只有 `attrMods`、无钩子/时长/叠层/maxApMod 等）不需要建层：属性已经折进来源层账，
 * 建出来只会是一层空壳。判据 = 任何可能在战斗中表现出的行为（钩子、非永久时长、AP 上限、tick、
 * 回复、叠层），或数据显式声明的 `needsLayer` —— 后者用于「无钩子但被引擎按 `pendingBuffs` 探测
 * （`min_move_cost`）或会被 `remove_buff` 消耗（`sangui_yuanqi`）、物化时要播报
 * （`muscle_degradation`）」这类没有别的运行时特征的标记 buff。
 *
 * **不再看 `hidden`**：`hidden` 只表示"不进 buff 列表"（展示口径），与是否建层无关。纯属性 buff
 * 现在会显示（`getBuffsForDisplay` 从账上补），但依然不建层。
 */
export function needsRuntimeLayer(def: BuffDef): boolean {
    if (def.needsLayer) return true
    if (def.expiry && def.expiry.type !== 'permanent') return true
    if (def.maxApMod || def.tickInterval) return true
    if (def.apRegenPerSec || def.chanRegenPerSec) return true
    if (def.stacking && def.stacking.type !== 'none') return true
    if (Object.keys(def).some((k) => /^on[A-Z]/.test(k))) return true
    return false
}

/**
 * 「只承载 AP 上限」的附着 buff：除 `maxApMod` 外没有任何运行时特征（`ap_drain` 那种带叠层的
 * 不算——它有自己的战斗层与播报）。
 *
 * 为什么单独认这一类：旧实现把「占内息上限」写成 `battle_start → max_ap_mod` 槽，它在
 * `materializeAttached` **之前**生效；现在它是顶层附着 buff，默认会在自己的来源位置才物化，
 * 开局几条「获得状态」日志里的 `maxAp` 会晚一格。`Character.materializeApCarriers` 因此
 * 在物化前先把这类载体应用掉，逐事件快照与改造前一致。
 */
export function isApOnlyCarrier(def: BuffDef): boolean {
    if (!def.maxApMod) return false
    if (def.needsLayer) return false
    if (def.expiry && def.expiry.type !== 'permanent') return false
    if (def.tickInterval || def.apRegenPerSec || def.chanRegenPerSec) return false
    if (def.stacking && def.stacking.type !== 'none') return false
    if (Object.keys(def).some((k) => /^on[A-Z]/.test(k))) return false
    return true
}

/**
 * 把来源声明的 effects 翻译成一条层账（构造期唯一入口）。
 *
 * 这就是「来源 buff 的 onInit」：只在来源建立时跑一次，**只写账、不碰角色字段**。
 * 源顶层 `effects` 只认 `add_buff`（其余类型写在顶层就是死数据 —— 引擎不会执行）；构造期的一切
 * 贡献都从该 `BuffDef` 派生：`attrMods` / `maxHpMod` / `triggerSlotMod` / `attrConvert` /
 * `weaponTags` / `buffDurationFn` / `statRestriction`。
 *
 * `char` 只在附着 buff 的动态钩子（`triggerSlotModFn` / `buffDurationFn`）求值时用到 ——
 * 与旧实现一致，求值发生在「轮到这条来源」的时刻。
 * 返回 null 表示这条来源没有任何附着 buff（不必占一层）。
 */
export function buildSourceLayer(
    sourceId: string,
    kind: SourceKind,
    effects: EffectDef[] | undefined,
    char: Character,
    sourceTags?: string[],
): SourceLayer | null {
    // 单遍：只有真的带附着 buff 才建层（纯效果为空的来源不占层）
    if (!(effects ?? []).some((e) => e.type === 'add_buff')) return null
    const layer: SourceLayer = {
        id: sourceId,
        origin: 'source',
        sourceId,
        kind,
        applied: {},
        ops: [],
        maxHpMod: 0,
        triggerSlotMod: 0,
        weaponTags: [],
        durationMults: [],
        sourceTags,
        attachedBuffs: [],
    }
    for (const eff of effects ?? []) {
        if (eff.type !== 'add_buff') continue
        const def = getBuff(eff.buffId)
        if (!def) {
            console.warn(`[source-layer] ${sourceId} 引用了不存在的 buff: ${eff.buffId}`)
            continue
        }
        const stacks = eff.stacks ?? 1
        // 记录全部（含纯属性携带者）：物化时再按 `needsRuntimeLayer` 决定是否建层，
        // 没建层的由 `getBuffsForDisplay` 从这份记录补进展示列表
        layer.attachedBuffs.push({ buffId: eff.buffId, stacks })
        // 层内 ops 顺序固定为 mods → converts → restriction，与旧「按 effects 声明顺序逐条应用」等价：
        // 数据里 7 个限制器要么排在同一来源的属性修正之后，要么本就排在最前（与转换/限制互不交叠）。
        // 属性部分折进账（构造期就生效）；战斗层物化时只承载 hooks，不再二次应用
        for (const [attr, val] of Object.entries(def.attrMods ?? {})) {
            const a = attr as AttrName
            const value = round1((val as number) * stacks)
            if (value === 0) continue
            layer.ops.push({ kind: 'mod', attr: a, value, fromBuff: eff.buffId })
        }
        // 最大气血：与 attrMods 同口径折进来源层（`rebuildDerived` 汇总成 char.maxHpMod）
        if (def.maxHpMod) layer.maxHpMod += def.maxHpMod * stacks
        // 触发槽：静态值优先，动态钩子在此刻求值一次（与旧 `trigger_slot_mod.fn(char)` 同一时刻）
        layer.triggerSlotMod += def.triggerSlotMod ?? def.triggerSlotModFn?.(char) ?? 0
        // 属性转化：按声明顺序 push（保序回放；重算时读「已应用到此」的属性值）
        for (const cv of def.attrConvert ?? []) {
            const convert: SourceConvert = {
                from: cv.from,
                to: cv.to,
                ratio: cv.ratio,
                mode: cv.mode === 'floor' ? 'floor' : 'round',
            }
            layer.ops.push({ kind: 'convert', ...convert })
        }
        for (const t of def.weaponTags ?? []) layer.weaponTags.push(t)
        if (def.buffDurationFn) {
            const fn = def.buffDurationFn
            layer.durationMults.push((c) => fn(c))
        }
        if (def.statRestriction) layer.ops.push({ kind: 'restriction', check: def.statRestriction })
    }
    return layer
}

/** 某个角色身上的一条层（来源层与战斗层的只读合并视图） */
export interface LayerView {
    /** 来源层 = sourceId；战斗层 = buffId */
    id: string
    origin: 'battle' | 'source'
    /** 该层实际生效的属性增减（来源层取 applied，战斗层取 mods） */
    mods: ModTable
    /** 来源层本体（origin === 'source' 时） */
    sourceLayer?: SourceLayer
    /** 战斗层本体与其 registry key（origin === 'battle' 时，需传 state） */
    buffLayer?: import('../../combat/types').BuffLayer
    key?: string
}

/**
 * 读出某角色身上的**全部层**：构造期来源层（`Character.sourceLayers`）+ 战斗期 buff 层（`state.pendingBuffs`）。
 *
 * 用途：凡是"遍历某角色的层"的代码（属性来源展示、AI 估算、将来的钩子求值）都走这里，
 * 不必关心层住在哪个存储里。只读，不改任何状态。
 */
export function layersOf(char: Character, state?: BattleState): LayerView[] {
    const out: LayerView[] = []
    for (const l of char.sourceLayers) {
        out.push({ id: l.sourceId, origin: 'source', mods: l.applied, sourceLayer: l })
    }
    if (state) {
        forEachBuffOf(state.pendingBuffs, char.id, (def, layer, buffId, key) => {
            out.push({
                id: layer.buffId ?? buffId,
                origin: layer.origin ?? 'battle',
                mods: layer.mods ?? {},
                buffLayer: layer,
                key,
            })
            void def
        })
    }
    return out
}
