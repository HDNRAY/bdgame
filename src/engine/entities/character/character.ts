import { ALL_ATTRS, ATTR_ABSOLUTE_MIN, AttributeSet, type AttrName } from '../attributes'
import { Action, type ActionDefinition, type EffectDef } from '../action'
import type { CharacterBuild } from '../../../game/entities/character-build'
import type { ActionConfig } from '../../../game/entities/action-config'
import type { Passive, Talent } from '../passive'
import type { Artifact } from '../artifact'
import type { EffectSlot } from '../trigger'
import type { Tag } from '../tag'
import type { WeaponDef } from '../../../data/weapons/weapons'
import type { AttackStyle } from '../../ai/planner'
import { calcMaxHp, calcMaxAp } from '../../calc/stats'
import { calcActionCostAfterSpeed } from '../../calc/damage'
import { getAction as getActionDef } from '../../../data/actions'
import { getWeapon } from '../../../data/weapons/weapons'
import { getPassive } from '../../../data/passives'
import { getArtifact } from '../../../data/artifacts'
import { forEachBuffOf, forEachHookOf, calcExtraHaste, dropBuffLayer } from '../../combat/utils'
import { materializeAttachedBuff } from '../../combat/utils/buff-apply'
import { getBuff } from '../../../data/buffs'
import { MAX_CHAN } from '../../constants'
import type { BattleEngine } from '../../combat/engine'
import type { BattleState, ModTable } from '../../combat/types'
import type { BuffHookCtx, RuntimeAction } from '../../../data/buffs/types'
import { convertAttrAmount, round1 } from '../../util/math'
import { emptyResourceTally, type ResourceTally } from './resource-tally'

import { collectRewards } from './reward-collect'
import { buildActionCache } from './action-cache'
import { buildConfigTriggers } from './trigger-slots'
import { constructEffectsOf, runtimeSlotsOf } from '../trigger'
import {
    buildSourceLayer,
    isApOnlyCarrier,
    needsRuntimeLayer,
    type SourceKind,
    type SourceLayer,
    type StatRestrictionCheck,
} from './source-layer'

export class Character {
    readonly build: CharacterBuild
    readonly id: string
    name: string
    attrs: AttributeSet
    /** 当前 HP（赋值自动保留 1 位小数） */
    private _hp = 0
    get hp(): number {
        return this._hp
    }
    set hp(v: number) {
        this._hp = Math.round(v * 10) / 10
    }
    /** 当前 AP（赋值自动保留 1 位小数） */
    private _ap = 0
    get ap(): number {
        return this._ap
    }
    set ap(v: number) {
        this._ap = Math.round(v * 10) / 10
    }
    /** 缠劲层数 */
    chan = 0
    /** 本场资源流水（内息 / 缠劲的获得、消耗、溢出）——战斗统计读取，见 `ResourceTally` */
    res: ResourceTally = emptyResourceTally()
    /** 上次行动结束的绝对时间 (ms)，0=未行动过 */
    lastActionEndMs = 0
    /** 上次召唤物 AP 恢复时间 */
    lastApUpdate = 0

    /** 已解析的被动对象列表 */
    passiveDefs: Passive[] = []
    /** 被动注入的额外 trigger */
    passiveTriggers: EffectSlot[] = []
    /** 缓存：从 actionConfigs 解析的触发条件 */
    #configTriggers: EffectSlot[] = []
    /** 构造时固定的触发槽上限 */
    #maxTriggerSlots = 0
    /** 武器定义的 clone（含被动修改） */
    weaponDef?: WeaponDef
    /** 当前主手武器 id（换武/缴械/捡回都改它；weaponDef 与来源层账都由它派生） */
    currentWeaponId: string
    /** 副手武器定义缓存（构造时解析；主手可能在战斗中切换，副手武器一般固定） */
    private offhandDef?: WeaponDef
    /**
     * 战斗期对主手武器的临时改写（目前唯一用例：附炁与刃补 `qi` 标签 + 射程下限抬到 3）。
     *
     * **不能改写 `weaponDef` 本身**：它由 `derivedWeaponDef()` 派生，任何一次 `rebuildDerived()`
     * （战斗层建/删/叠层、血量副作用、探云手…）都会把它重算回「基础武器 + 来源层 weaponTags」，
     * 手写的标签/射程会被静默抹掉（宁浩然「炁意」失效、胜率掉 15pp 的直接原因）。
     * 换武（`setWeapon`）时随旧武器一起丢弃 —— 与改造前 `switch_weapon` 整体覆盖 weaponDef 同口径。
     */
    private weaponPatch?: { tags?: readonly Tag[]; range?: [number, number] }
    /** 已解析的奇物/义体列表 */
    artifactDefs: Artifact[] = []
    /** 义体/效果修正 */
    maxApMod = 0
    maxHpMod = 0

    /** 战斗风格（build.battleStyle 显式必填，不再自动判定） */
    battleStyle: AttackStyle
    /** buff 时长倍率回调列表（炁蕴绵长等功法，构造期收集，乘算） */
    buffDurationCallbacks: Array<(char: Character) => number> = []
    /** 额外触发槽位（奇物提供） */
    triggerSlotMod = 0
    /** stat_restriction 回调列表（由来源层账推导，不再逐条 push，因此可整体撤销） */
    statRestrictionChecks: StatRestrictionCheck[] = []
    /**
     * 构造期来源层账（顺序 = 加入顺序）：attrs = baseAttrs + Σ 各层修正。
     * 公开是为了 `forkForSim` 能给沙盒一份自己的数组副本（层对象只读共享）。
     */
    sourceLayers: SourceLayer[] = []
    /**
     * 运行时被消耗/移除掉的附着 buff（`${sourceId}::${buffId}`）。
     *
     * 附着 buff 的属性折在**来源层账**里，所以运行时移除它必须同时把账上那部分也停掉
     * （否则「三分归元」消耗掉 sangui_yuanqi 后 +1 四维会永久留下）。重新物化（再次装备）时清除。
     */
    #detachedAttached = new Set<string>()
    constructor(build: CharacterBuild) {
        this.build = build
        this.id = build.id
        this.name = build.name

        // 1. 直接使用最终属性值
        this.attrs = new AttributeSet(build.baseAttrs)

        // 2. 奖励分类 + 天赋解锁 + 重复检查（见 reward-collect.ts）
        const rewards = collectRewards(build)
        const gainedActions = rewards.actions

        // 3. 解析被动/奇物 ID → 定义
        this.passiveDefs = rewards.passives.map((id) => getPassive(id)).filter((p): p is Passive => p !== undefined)
        this.artifactDefs = rewards.artifacts.map((id) => getArtifact(id)).filter((a): a is Artifact => a !== undefined)

        // 4. 应用被动/奇物/武器效果
        for (const p of this.passiveDefs) {
            this.applyPassive(p)
            // 功法赋予的招式
            if (p.grantsActions) gainedActions.push(...p.grantsActions)
        }
        for (const a of this.artifactDefs) {
            this.addSource(`artifact:${a.id}`, 'artifact', constructEffectsOf(a))
            for (const t of runtimeSlotsOf(a)) this.passiveTriggers.push(t)
            // 义体赋予的招式
            if (a.grantsActions) gainedActions.push(...a.grantsActions)
        }
        const weapon = getWeapon(build.weapon)
        this.currentWeaponId = build.weapon
        // weaponDef（含被动 weapon_tag）由层账重算得出
        this.weaponDef = this.derivedWeaponDef()
        // 副手武器定义缓存（build.offhand 固定；战斗中切主手不影响副手定义）
        if (build.offhand) {
            this.offhandDef = getWeapon(build.offhand)
        }
        // 战斗风格显式必填(build.battleStyle),不再按武器自动判定
        this.battleStyle = build.battleStyle
        // 武器属性要求检测（不达标则武器自带的效果/触发/招式都不生效）
        const weaponOk =
            !weapon.requireAttrsMin ||
            Object.entries(weapon.requireAttrsMin).every(([attr, req]) => this.attrs.get(attr as AttrName) >= req!)
        if (weaponOk) {
            this.addSource(`weapon:${build.weapon}`, 'weapon', constructEffectsOf(weapon), ['weapon'])
            for (const t of runtimeSlotsOf(weapon)) this.passiveTriggers.push(t)
            if (weapon.grantsActions) gainedActions.push(...weapon.grantsActions)
        }

        // 副手武器：只处理 effects/triggers/grantsActions，不处理 tag，不含 range/战斗逻辑
        if (build.offhand) {
            const offhand = getWeapon(build.offhand)
            this.addSource(`offhand:${build.offhand}`, 'offhand', constructEffectsOf(offhand), ['weapon'])
            for (const t of runtimeSlotsOf(offhand)) this.passiveTriggers.push(t)
            if (offhand.grantsActions) gainedActions.push(...offhand.grantsActions)
        }

        // 5. 招式缓存（触发招 / 通用强化 / 捡武器 / 排序，见 action-cache.ts）
        const enhancers = [
            ...this.passiveDefs.map((p) => p.actionEnhancer),
            ...this.artifactDefs.map((a) => a.actionEnhancer),
        ].filter((f): f is (def: ActionDefinition) => ActionDefinition => !!f)
        this.#actionCache = buildActionCache(build, gainedActions, this.passiveTriggers, (def) =>
            enhancers.reduce((d, f) => f(d), def),
        )

        this.ap = this.maxAp
        this.hp = calcMaxHp(this.attrs.get('vitality')) + this.maxHpMod

        // 初始化触发条件缓存（战斗期间固定，不随属性变化）
        const initWis = this.attrs.get('wisdom')
        this.#maxTriggerSlots = Math.max(1, Math.floor(initWis / 4)) + this.triggerSlotMod
        this.#configTriggers = buildConfigTriggers(build)
        if (this.#configTriggers.length > this.#maxTriggerSlots) {
            console.warn(
                `[${this.name}] WIS=${initWis} 仅 ${this.#maxTriggerSlots} 个触发槽，`,
                `丢弃 ${this.#configTriggers.length - this.#maxTriggerSlots} 个触发条件`,
            )
        }
    }

    /** 触发槽上限（由推演 + 功法/奇物效果决定） */
    get maxTriggerSlots(): number {
        return this.#maxTriggerSlots
    }

    /**
     * 记入一个来源的构造期修正（功法/天赋/奇物/武器/副手）。
     *
     * `constructEffects` 由 `constructEffectsOf(source)` 从该源的 `on_construct` 槽取出（唯一读取点）。
     * 等价于旧的逐条 `applyPassiveEffect`，区别是写进层账再重算 —— 因此可以整体撤销、也不会因为
     * 手写反函数而夹取漂移。同名来源重复加入时覆盖（容错）。
     */
    addSource(
        sourceId: string,
        kind: SourceKind,
        constructEffects: EffectDef[] | undefined,
        sourceTags?: string[],
        state?: BattleState,
    ): void {
        const layer = buildSourceLayer(sourceId, kind, constructEffects, this, sourceTags)
        if (!layer) return
        const idx = this.sourceLayers.findIndex((l) => l.sourceId === sourceId)
        if (idx >= 0) this.sourceLayers[idx] = layer
        else this.sourceLayers.push(layer)
        this.rebuildDerived(state)
    }

    /**
     * 撤销一个来源的全部构造期修正（探云手偷走奇物 / 换武器 / 卸下被动）。
     *
     * 战斗中调用必须传 `state`（有 engine 的地方都能拿到）：重算是「来源层 ops + 战斗层 mods」
     * 一起回放，不传 state 会把战斗层的属性贡献漏掉（内劲/汲取这类当场消失）。
     * 传了 state 还会把这条来源**附着 buff 物化出来的战斗层**一起删掉（按 originId）。
     */
    removeSource(sourceId: string, state?: BattleState): boolean {
        const idx = this.sourceLayers.findIndex((l) => l.sourceId === sourceId)
        if (idx < 0) return false
        this.sourceLayers.splice(idx, 1)
        if (state) {
            for (const key of state.pendingBuffs.keysOfOrigin(sourceId)) dropBuffLayer(state, key)
        }
        this.rebuildDerived(state)
        return true
    }

    /**
     * 换主手武器：撤旧来源层 → 挂新来源层 → 重建 weaponDef → 物化新武器自带的 buff。
     *
     * 这是换武/缴械的唯一入口。旧实现手写逆运算（`revertWeaponStatBuffs` + 直接改 attrs +
     * 手工换触发），账里仍是旧武器 —— 之后任何一次重算（探云手就会触发）都会把换武悄悄回滚。
     */
    setWeapon(weaponId: string, engine?: BattleEngine): void {
        const oldId = this.currentWeaponId
        this.weaponPatch = undefined // 换武丢弃附炁改写（旧实现整体覆盖 weaponDef，同口径）
        this.removeSource(`weapon:${oldId}`, engine?.state)
        for (const t of runtimeSlotsOf(getWeapon(oldId))) {
            const idx = this.passiveTriggers.indexOf(t)
            if (idx !== -1) this.passiveTriggers.splice(idx, 1)
        }
        this.currentWeaponId = weaponId
        const weapon = getWeapon(weaponId)
        // 御物（imperial）武器不自带属性效果：旧 switch_weapon 跳过它们的 stat_buff，这里保持同一口径
        const effects = weapon.tags.includes('imperial') ? [] : constructEffectsOf(weapon)
        this.addSource(`weapon:${weaponId}`, 'weapon', effects, ['weapon'], engine?.state)
        for (const t of runtimeSlotsOf(weapon)) this.passiveTriggers.push(t)
        this.weaponDef = this.derivedWeaponDef()
        if (engine) this.materializeAttached(engine)
    }

    /** 运行时移除了一条附着 buff 的战斗层 → 连它在来源层账上的属性一起停掉（幂等） */
    detachAttachedBuff(sourceId: string, buffId: string): void {
        this.#detachedAttached.add(`${sourceId}::${buffId}`)
    }

    /** 重新物化（再次装备）时把"已移除"的记录清掉，属性随之回来 */
    reattachAttachedBuff(sourceId: string, buffId: string): void {
        this.#detachedAttached.delete(`${sourceId}::${buffId}`)
    }

    /**
     * 该附着 buff 是否已被运行时移除（如「三分归元」消耗掉 `sangui_yuanqi`）—— 账上属性已停掉。
     *
     * 供 `getBuffsForDisplay` 用：被移除的附着 buff 不能再从 `attachedBuffs` 补进展示列表。
     */
    isAttachedBuffDetached(sourceId: string, buffId: string): boolean {
        return this.#detachedAttached.has(`${sourceId}::${buffId}`)
    }

    /**
     * 先物化「只承载 AP 上限」的附着 buff（`isApOnlyCarrier`，hidden 的内部载体）。
     *
     * 这类载体等价于旧的 `battle_start → max_ap_mod` 槽：必须在任何「获得状态」日志**之前**生效，
     * 否则开局几条日志快照里的 `maxAp` 会晚一格（回放逐帧对不上）。`engine.init` 对双方各调一次，
     * 分别早于各自的 `materializeAttached`。
     */
    materializeApCarriers(engine: BattleEngine): void {
        for (const layer of this.sourceLayers) {
            for (const { buffId, stacks } of layer.attachedBuffs) {
                const def = getBuff(buffId)
                if (!def || !isApOnlyCarrier(def)) continue
                const prefix = `${buffId}::${this.id}`
                const owned = engine.state.pendingBuffs.keysOfOrigin(layer.sourceId)
                if (owned.some((k) => k === prefix || k.startsWith(`${prefix}::`))) continue
                materializeAttachedBuff(engine, this, def, stacks, layer.sourceId)
            }
        }
    }

    /**
     * 把各来源**自带的 buff**（`on_construct` 槽的 `apply:[add_buff]`）物化成战斗层：开局、换装、被偷到手时调用。
     *
     * 附着表记的是**全部**附着 buff（含纯属性携带者，供 buff 列表展示），这里**按需物化**：
     * 只对 `needsRuntimeLayer(def)` 为真的建层，其余跳过（属性已在来源层账上，建出来只是空壳）。
     * 「只承载 AP 上限」的载体（`isApOnlyCarrier`）**只在开局**由 `materializeApCarriers` 应用：
     * 它等价于旧的 `battle_start → max_ap_mod` 槽，换装/被偷到手时那个槽本来就不会触发。
     *
     * 层上打 `originId = sourceId`、标 `attrsInLedger`（属性已折进来源层账，不再二次应用），
     * 只承载 hooks；撤源时按 originId 整批删。
     *
     * 幂等判定必须**带上拥有者**：`originId` 只是来源 id（如 `artifact:金丝手套`），双方各持同一件奇物时
     * 会共用同一个 originId，只看 `buffId::` 前缀会把对方已有的层当成自己的而跳过（层 key 是
     * `buffId::角色id`，所以按「`buffId::自己` 或 `buffId::自己::…`」判重）。
     *
     * 统一按**来源注册序**物化（来源自带 buff 只在开局、换装、被偷到这三条路径生效）。
     */
    materializeAttached(engine: BattleEngine): void {
        for (const layer of this.sourceLayers) {
            for (const { buffId, stacks } of layer.attachedBuffs) {
                const def = getBuff(buffId)
                if (!def) continue
                // 纯属性携带者不建层（记录在案，展示由 getBuffsForDisplay 从账上补）
                if (!needsRuntimeLayer(def)) continue
                // AP 上限载体只在开局生效（见上：与旧 battle_start 槽同口径）
                if (isApOnlyCarrier(def)) continue
                const owned = engine.state.pendingBuffs.keysOfOrigin(layer.sourceId)
                const prefix = `${buffId}::${this.id}`
                if (owned.some((k) => k === prefix || k.startsWith(`${prefix}::`))) continue
                materializeAttachedBuff(engine, this, def, stacks, layer.sourceId)
            }
        }
    }

    /**
     * 战斗期给主手武器打补丁（附炁与刃）。写 `weaponPatch` 而不是直接写 `weaponDef`，
     * 这样后续任何一次 `rebuildDerived()` 重算都会把补丁重新叠上去；打完立即重新派生一次，
     * 让本次动作就能读到新射程/标签。
     */
    patchWeapon(patch: { tags?: readonly Tag[]; range?: [number, number] }): void {
        this.weaponPatch = patch
        this.weaponDef = this.derivedWeaponDef()
    }

    /** 层账 → 武器定义（基础武器 + 各层 weapon_tag + 战斗期补丁）；武器属性门槛与展示都读它 */
    private derivedWeaponDef(): WeaponDef {
        const base = getWeapon(this.currentWeaponId ?? this.build.weapon)
        const extra = this.sourceLayers.flatMap((l) => l.weaponTags).filter((t) => !base.tags.includes(t))
        const patch = this.weaponPatch
        if (extra.length === 0 && !patch) return base
        const tags = patch?.tags ? [...new Set([...base.tags, ...extra, ...patch.tags])] : [...base.tags, ...extra]
        return { ...base, tags, range: patch?.range ?? base.range }
    }

    /**
     * 重算属性与派生值：`attrs = baseAttrs`，然后**按序回放**
     *   1) 来源层 ops（构造期，按层序；层内按 ops 序）
     *   2) 战斗层 mods（按建层序，需传 `state`）
     * 再汇总派生值（maxHpMod / triggerSlotMod / 武器 tag / 限制器 / 时长回调 / 触发槽上限）。
     *
     * 幂等：一律从 baseAttrs 起算、只用层上的**请求值**，所以删层后必然精确回退（不依赖任何反函数）。
     * `applied` 只记本轮实际生效量，供核对/展示，**重算不读它** —— 读它会在夹取边界上漂（棘轮）。
     * 当前 hp/ap 不回填，只在 maxAp 变小时夹住（与既有 `max_ap_mod` 的 `capAp` 口径一致）。
     */
    rebuildDerived(state?: BattleState): void {
        const base = this.build.baseAttrs as Partial<Record<AttrName, number>>
        for (const attr of ALL_ATTRS) this.attrs.set(attr, base[attr] ?? ATTR_ABSOLUTE_MIN)
        // applied 是"本轮重算的实际生效量"，每轮必须清零重记（重算会被 addSource 多次触发）
        for (const layer of this.sourceLayers) layer.applied = {}
        // 限制器 / 时长回调由层推导（旧实现是往数组里 push，撤不掉）
        this.buffDurationCallbacks = this.sourceLayers.flatMap((l) => l.durationMults)
        const checks: StatRestrictionCheck[] = []
        let maxHpMod = 0
        let triggerSlotMod = 0
        const tags: Tag[] = []
        // 写一笔属性修正：过限制器（restriction 只拦注册在它后面的）→ 夹取写入 → 记账
        // `guard=false` 用于**战斗层**回放：层的 mods 已经是"过了限制器之后"的请求值，
        // 再跑一遍限制器会重新掷骰（玄机的「推演降低 50% 被挡」这类），属性与随机数流都会跑偏。
        const applyMod = (
            attr: AttrName,
            value: number,
            layerTags: string[] | undefined,
            track?: ModTable,
            guard = true,
        ): void => {
            let delta = value
            for (const check of guard ? checks : []) {
                const result = check(this, attr, this.attrs.get(attr), delta, layerTags, state)
                if (!result) continue
                if (result.skip) {
                    delta = 0
                    break
                }
                if (result.delta !== undefined) delta = result.delta
            }
            const before = this.attrs.get(attr)
            if (delta !== 0) this.attrs.modify(attr, delta)
            if (track) track[attr] = (track[attr] ?? 0) + (this.attrs.get(attr) - before)
        }
        for (const layer of this.sourceLayers) {
            // 按层内声明的操作顺序回放：restriction 注册后只拦后面的 mod（与旧逐条应用一致）
            for (const op of layer.ops) {
                if (op.kind === 'restriction') {
                    checks.push(op.check)
                    continue
                }
                // 这条修正所属的附着 buff 已被运行时移除 → 账上这部分也停掉
                if (op.kind === 'mod' && op.fromBuff && this.#detachedAttached.has(`${layer.sourceId}::${op.fromBuff}`))
                    continue
                if (op.kind === 'convert') {
                    const src = this.attrs.get(op.from)
                    const delta = convertAttrAmount(src, op.ratio)
                    for (const to of op.to) applyMod(to, delta, layer.sourceTags, layer.applied)
                    continue
                }
                applyMod(op.attr, op.value, layer.sourceTags, layer.applied)
            }
            maxHpMod += layer.maxHpMod
            triggerSlotMod += layer.triggerSlotMod
            tags.push(...layer.weaponTags)
        }
        // 触发槽上限是**构造期口径**（设计文档：「附着 buff 的 attrMods 折进来源层账 → 触发槽上限
        // 在构造期就算对」）：只认来源层回放出来的推演，不认战斗层。战斗期推演临时增减（汲取抽取、
        // 七十二变轮转、临时增益）若参与计算，会静默把玩家配置好的触发槽切片切掉 —— 与 HEAD 不一致。
        const slotWisdom = this.attrs.get('wisdom')
        // 战斗层：按建层序回放请求值。层里存的是"请求值"，删层只需删条目再重算，没有逆运算。
        // 附着 buff 的属性已折进来源层账（attrsInLedger），这里跳过，避免二次应用。
        if (state) {
            forEachBuffOf(state.pendingBuffs, this.id, (def, layer) => {
                // 附着层的**静态**属性已折进来源层账（materialize 时 `skipAttrMods`，所以它的 mods
                // 一开始是空的）；能在这里读到 mods，只可能是运行时钩子写进去的动态修正
                // （潮汐内力每 tick 的 +3/+1、秋水轮转、七十二变…）—— 必须照常回放，不能整层跳过。
                for (const [attr, factor] of Object.entries(layer.modsMultiply ?? {})) {
                    if (!ALL_ATTRS.includes(attr as AttrName)) continue
                    const a = attr as AttrName
                    const before = this.attrs.get(a)
                    this.attrs.set(a, before * (factor as number))
                    layer.applied = layer.applied ?? {}
                    layer.applied[a] = (layer.applied[a] ?? 0) + (this.attrs.get(a) - before)
                }
                if (!layer.mods) return
                for (const [attr, value] of Object.entries(layer.mods)) {
                    if (!ALL_ATTRS.includes(attr as AttrName)) continue
                    applyMod(attr as AttrName, value as number, def?.tags, layer.applied, false)
                }
            })
        }
        this.statRestrictionChecks = checks
        this.maxHpMod = maxHpMod
        this.triggerSlotMod = triggerSlotMod
        this.weaponDef = this.derivedWeaponDef()
        this.#maxTriggerSlots = Math.max(1, Math.floor(slotWisdom / 4)) + this.triggerSlotMod
        this.capAp()
    }

    /** 应用被动：达标检测 → effects（记层账）+ triggers */
    private applyPassive(p: Passive): void {
        // 属性要求检测（不达标则不生效）。
        // 天赋只看**原始属性** baseAttrs：它由构造时的 checkTalents(baseAttrs) 决定，
        // 不能因为装备/功法的加减属性而出现或消失；其余被动沿用生效属性。
        const rawAttrs = p.tags.includes('talent') ? this.build.baseAttrs : undefined
        const attrValue = (attr: AttrName, fallback: number) =>
            rawAttrs ? (rawAttrs[attr] ?? fallback) : this.attrs.get(attr)
        if (p.requireAttrsMin) {
            const ok = Object.entries(p.requireAttrsMin).every(([attr, req]) => attrValue(attr as AttrName, 0) >= req)
            if (!ok) return
        }
        // Talent requireAttrsMax
        if ('requireAttrsMax' in p) {
            const t = p as unknown as Talent
            const maxOk = Object.entries(t.requireAttrsMax!).every(
                ([attr, req]) => attrValue(attr as AttrName, 99) <= req,
            )
            if (!maxOk) return
        }
        // effects（记入来源层账，可整体撤销）
        this.addSource(`passive:${p.id}`, p.tags.includes('talent') ? 'talent' : 'passive', constructEffectsOf(p))
        // triggers
        for (const slot of runtimeSlotsOf(p)) this.passiveTriggers.push(slot)
        // 源自带 buff 的物化槽：插在本源 trigger 的位置上，保证开局建层/日志顺序不变
    }

    get maxHp(): number {
        return calcMaxHp(this.attrs.get('vitality')) + this.maxHpMod
    }

    get maxAp(): number {
        return calcMaxAp(this.attrs.get('vitality'), this.maxApMod)
    }

    get triggers(): EffectSlot[] {
        return [...this.#configTriggers.slice(0, this.#maxTriggerSlots), ...this.passiveTriggers]
    }

    /** 获取招式配置 */
    getConfig(actionId: string): ActionConfig | undefined {
        return this.build.actionConfigs?.find((c) => c.actionId === actionId)
    }

    /** 实时计算急速：全部来自 buff 的 onHaste 钩子（没有 state 就没有急速，构造期不算） */
    getHaste(state?: BattleState): number {
        return state ? calcExtraHaste(state, this) : 0
    }

    /** buff 时长倍率（炁蕴绵长等功法，乘算，默认 1） */
    getBuffDurationMult(): number {
        return this.buffDurationCallbacks.reduce((m, cb) => m * cb(this), 1)
    }

    /** 身法/急速减免后的招式 AP 成本（召唤物不调用此方法，走原价；传 state 计入 buff onHaste 急速） */
    actionApCost(base: number, state?: BattleState): number {
        return calcActionCostAfterSpeed(base, this.attrs.get('agility'), this.getHaste(state))
    }

    /** 惰性缓存的运行时招式表（base + actionEnhancer + 所有 onRuntimeAction buff 修正，如御剑诀+2距离） */
    private _runtimeActionCache?: Map<string, ActionDefinition>
    /** 构建/取该角色所有招式的运行时版本（onRuntimeAction buff 全为 permanent、战斗内不变 → 一次构建后 O(1) 查表） */
    getRuntimeActions(state: BattleState): Map<string, ActionDefinition> {
        if (this._runtimeActionCache) return this._runtimeActionCache
        const map = new Map<string, ActionDefinition>()
        for (const a of this.actions) {
            let cur: ActionDefinition | RuntimeAction = a.def
            forEachHookOf(state.pendingBuffs, 'onRuntimeAction', this.id, (buff, layer) => {
                if (!buff.onRuntimeAction) return
                cur = buff.onRuntimeAction(
                    { final: 0, raw: 0, target: this, attacker: this, engine: undefined, state, layer } as BuffHookCtx,
                    cur,
                )
            })
            map.set(a.id, cur as ActionDefinition)
        }
        this._runtimeActionCache = map
        return map
    }

    /** 获取所有招式中最远射程（用于 dash targetDist: -1 解析，仅统计非辅助招式；传 state 时叠加 buff 的 onRuntimeAction 距离修正，如御剑诀） */
    getMaxActionRange(state?: BattleState): number {
        const effRange = this.getEffectiveRange()
        const map = state ? this.getRuntimeActions(state) : undefined
        return Math.max(
            ...this.actions
                .filter((a) => !a.def.tags.includes('pre_action') && !a.def.tags.includes('post_action'))
                .map((a) => {
                    const def = map?.get(a.id) ?? a.def
                    const r = def.getRange?.(effRange, this) ?? effRange
                    return r[1]
                }),
        )
    }

    /**
     * 有效武器射程：主手与副手射程取并集（双持时用任意一把够得着的武器出招）。
     * 无副手 = 主手射程本身。武器射程构造后基本固定（缴械/换武器会重挂 weaponDef），
     * 但本方法按需读取 weaponDef/offhandDef 引用，开销为常数（不涉及查找表遍历）。
     */
    getEffectiveRange(): [number, number] {
        const main = this.weaponDef?.range ?? getWeapon(this.build.weapon).range
        const off = this.offhandDef
        if (!off) return main
        return [Math.min(main[0], off.range[0]), Math.max(main[1], off.range[1])]
    }

    /** 主副手武器 tags 并集（招式 requiredTags 判定：双持时任一武器满足即可） */
    getWeaponTags(): Tag[] {
        const main = this.weaponDef ?? getWeapon(this.build.weapon)
        const off = this.offhandDef
        if (!off) return main.tags
        return [...new Set([...main.tags, ...off.tags])]
    }

    /** 应用 actionEnhancer，重建招式缓存时保留剩余次数 */
    #applyActionEnhancer(enhancer: (def: ActionDefinition) => ActionDefinition): void {
        this.#actionCache = this.#actionCache.map((a) => {
            const modified = enhancer(a.def)
            if (modified === a.def) return a
            const newAction = new Action(modified)
            newAction.remainingUses = a.remainingUses
            return newAction
        })
    }

    /**
     * 运行时添加奇物（探云手偷取等）。
     *
     * 传了 engine 就把该奇物自带的 buff（`on_construct` 槽的 `apply:[add_buff]`）物化成战斗层
     * （`materializeAttached`）——属性在 `addSource` 时已折进层账。
     */
    addArtifact(id: string, engine?: BattleEngine): boolean {
        if (this.artifactDefs.some((a) => a.id === id)) return false
        const def = getArtifact(id)
        if (!def) return false
        this.artifactDefs.push(def)
        this.addSource(`artifact:${id}`, 'artifact', constructEffectsOf(def), undefined, engine?.state)
        for (const t of runtimeSlotsOf(def)) this.passiveTriggers.push(t)
        if (engine) this.materializeAttached(engine)

        // 奇物赋予的招式（偷来的女儿红能喝）
        for (const g of def.grantsActions ?? []) {
            const gDef = getActionDef(g)
            if (gDef && !this.#actionCache.some((a) => a.id === g)) {
                this.#actionCache.push(new Action(gDef))
            }
        }
        if (def.actionEnhancer) this.#applyActionEnhancer(def.actionEnhancer)
        return true
    }

    /** 移除指定招式（偷取奇物时同步移除其赋予的招式，如女儿红被偷后不能再喝） */
    removeActionsByIds(ids: string[]): void {
        if (ids.length === 0) return
        this.#actionCache = this.#actionCache.filter((a) => !ids.includes(a.id))
    }

    #actionCache: Action[] = []
    get actions(): Action[] {
        return this.#actionCache
    }

    takeDamage(amount: number, engine?: BattleEngine): void {
        const prevHp = this.hp
        this.hp = Math.max(0, this.hp - amount)
        const dealt = prevHp - this.hp
        if (dealt > 0.5 && engine) {
            this.addChan(round1(dealt * 0.5))
            engine.checkChanOverflow(this.id)
        }
        if (engine && dealt > 0) this.#fireHpChange(engine)
    }
    /** 自伤：扣血但不触发受击回缠（takeDamage 的 addChan 是"被打回气"，自伤不应享受），
     *  仍触发 onHpChange（困兽犹斗等随血量变化的 buff 联动）。血祭/血滴子/血炁护体等卖血用。 */
    spendHp(amount: number, engine?: BattleEngine): void {
        const prevHp = this.hp
        this.hp = Math.max(0, this.hp - amount)
        if (engine && prevHp - this.hp > 0) this.#fireHpChange(engine)
    }
    heal(amount: number, engine?: BattleEngine): void {
        const prevHp = this.hp
        this.hp = Math.min(this.maxHp, this.hp + amount)
        if (engine && this.hp > prevHp) this.#fireHpChange(engine)
    }

    /** 触发 onHpChange 钩子 */
    #fireHpChange(engine: BattleEngine): void {
        forEachHookOf(engine.state.pendingBuffs, 'onHpChange', this.id, (def, layer) => {
            if (def.onHpChange) {
                def.onHpChange({
                    final: 0,
                    raw: 0,
                    target: this,
                    attacker: this,
                    engine,
                    state: engine.state,
                    layer,
                })
            }
        })
    }
    isAlive(): boolean {
        return this.hp > 0
    }

    spendAp(cost: number): boolean {
        if (this.ap < cost) return false
        this.ap -= cost
        this.res.apSpent += cost
        this.addChan(cost)
        return true
    }

    /** 增加内息（时间回复 / 效果回复）。返回实际增加量；超出上限的部分记为浪费。
     *  传入负数表示"净回复被压低"（御物耗炁等），视为消耗而非获得。 */
    gainAp(amount: number): number {
        const before = this.ap
        this.ap = Math.max(0, Math.min(this.maxAp, this.ap + amount))
        const delta = Math.round((this.ap - before) * 10) / 10
        if (delta >= 0) {
            this.res.apGained += delta
            this.res.apWasted += Math.max(0, Math.round((amount - delta) * 10) / 10)
        } else {
            this.res.apDrained += -delta
        }
        return delta
    }

    /** 纯扣 AP（不产生缠劲）：被打断/破气类效果用（裸绞、抽刀断水等）。
     *  扣"对方 AP"必须走这里，禁止直接改 this.ap —— 直接用 spendAp 会误送缠劲（addChan）。
     *  @param nowMs 当前时刻（引擎时间）：传入则同步重置 AP 回复参考点 lastApUpdate，
     *  让被扣的 AP 从此刻重新开始攒（否则上次行动以来的惰性回复会立刻把扣掉的补回来）。 */
    reduceAp(amount: number, nowMs?: number): number {
        const actual = Math.min(amount, this.ap)
        this.ap = Math.max(0, this.ap - actual)
        this.res.apDrained += actual
        if (nowMs !== undefined) this.lastApUpdate = nowMs
        return actual
    }

    /** 封顶当前 AP 不超过 maxAp（属性变动后调用） */
    capAp(): void {
        if (this.ap > this.maxAp) this.ap = this.maxAp
    }

    /** 增加缠劲（不超过上限）。返回被上限截断的溢出量（供溢出转化类 buff 使用，如周流不息） */
    addChan(amount: number): number {
        const before = this.chan
        this.chan = Math.min(MAX_CHAN, Math.round((this.chan + amount) * 10) / 10)
        const overflow = Math.max(0, Math.round((before + amount - this.chan) * 10) / 10)
        this.res.chanGained += Math.round((amount - overflow) * 10) / 10
        this.res.chanOverflow += overflow
        return overflow
    }

    /** 消耗缠劲（不足则返回 false 不扣，与 spendAp 一致） */
    spendChan(cost: number): boolean {
        if (this.chan < cost) return false
        this.chan = Math.round((this.chan - cost) * 10) / 10
        this.res.chanSpent += cost
        return true
    }

    /** 创建战斗用副本（所有数据独立，不污染原始） */
    cloneForBattle(): Character {
        const c = new Character(this.build)
        c.hp = this.maxHp
        c.ap = this.maxAp // 战斗开始满 AP
        c.lastActionEndMs = 0
        c.lastApUpdate = 0
        return c
    }

    /**
     * 推演用浅克隆：原型继承读、写落在自身（AI 期望伤害的沙盘，见 `ai/expected-damage.ts`）。
     *
     * 它只隔离「会被赋值的字段」（`chan`/`ap`/`hp` 这类赋值自动成为自身属性），
     * 但 `res` 是对象，钩子里的 `spendChan`/`addChan` 会**原地**改它 —— 所以沙盒必须自带一份，
     * 否则推演出的资源流水会累加进真实角色的统计（表现为缠劲消耗虚高、对不上账）。
     */
    forkForSim(): Character {
        const c = Object.create(this) as Character
        c.res = emptyResourceTally()
        // 层账也不能被沙盒污染（同 res 那个坑）：沙盒自带一份数组（层对象只读共享，沙盒不重算也不改层）
        c.sourceLayers = [...this.sourceLayers]
        return c
    }
}
