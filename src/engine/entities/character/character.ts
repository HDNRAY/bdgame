import { ALL_ATTRS, ATTR_ABSOLUTE_MIN, AttributeSet, type AttrName } from '../attributes'
import { Action, type ActionDefinition, type EffectDef } from '../action'
import type { CharacterBuild } from '../../../game/entities/character-build'
import type { ActionConfig } from '../../../game/entities/action-config'
import type { Passive, Talent } from '../passive'
import type { Artifact } from '../artifact'
import type { TriggerSlot } from '../trigger'
import type { Tag } from '../tag'
import type { WeaponDef } from '../../../data/weapons/weapons'
import type { AttackStyle } from '../../ai/planner'
import { calcMaxHp, calcMaxAp } from '../../calc/stats'
import { calcActionCostAfterSpeed } from '../../calc/damage'
import { getAction as getActionDef } from '../../../data/actions'
import { getWeapon } from '../../../data/weapons/weapons'
import { getPassive } from '../../../data/passives'
import { getArtifact } from '../../../data/artifacts'
import { forEachBuffOf, calcExtraHaste, processOnEquipEffects } from '../../combat/utils'
import { MAX_CHAN } from '../../constants'
import type { BattleEngine } from '../../combat/engine'
import type { BattleState } from '../../combat/types'
import type { BuffHookCtx, RuntimeAction } from '../../../data/buffs/types'
import { round1 } from '../../util/math'
import { emptyResourceTally, type ResourceTally } from './resource-tally'
import { collectRewards } from './reward-collect'
import { buildActionCache } from './action-cache'
import { buildConfigTriggers } from './trigger-slots'
import {
    buildSourceLayer,
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
    passiveTriggers: TriggerSlot[] = []
    /** 缓存：从 actionConfigs 解析的触发条件 */
    #configTriggers: TriggerSlot[] = []
    /** 构造时固定的触发槽上限 */
    #maxTriggerSlots = 0
    /** 武器定义的 clone（含被动修改） */
    weaponDef?: WeaponDef
    /** 副手武器定义缓存（构造时解析；主手可能在战斗中切换，副手武器一般固定） */
    private offhandDef?: WeaponDef
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
            this.addSource(`artifact:${a.id}`, 'artifact', a.effects)
            for (const t of a.triggers ?? []) this.passiveTriggers.push(t)
            // 义体赋予的招式
            if (a.grantsActions) gainedActions.push(...a.grantsActions)
        }
        const weapon = getWeapon(build.weapon)
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
            this.addSource(`weapon:${build.weapon}`, 'weapon', weapon.effects, ['weapon'])
            for (const t of weapon.triggers ?? []) this.passiveTriggers.push(t)
            if (weapon.grantsActions) gainedActions.push(...weapon.grantsActions)
        }

        // 副手武器：只处理 effects/triggers/grantsActions，不处理 tag，不含 range/战斗逻辑
        if (build.offhand) {
            const offhand = getWeapon(build.offhand)
            this.addSource(`offhand:${build.offhand}`, 'offhand', offhand.effects, ['weapon'])
            for (const t of offhand.triggers ?? []) this.passiveTriggers.push(t)
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
     * 等价于旧的逐条 `applyPassiveEffect`，区别是写进层账再重算 —— 因此可以整体撤销、也不会因为
     * 手写反函数而夹取漂移。同名来源重复加入时覆盖（容错）。
     */
    addSource(sourceId: string, kind: SourceKind, effects: EffectDef[] | undefined, sourceTags?: string[]): void {
        const layer = buildSourceLayer(sourceId, kind, effects, this, sourceTags)
        if (!layer) return
        const idx = this.sourceLayers.findIndex((l) => l.sourceId === sourceId)
        if (idx >= 0) this.sourceLayers[idx] = layer
        else this.sourceLayers.push(layer)
        this.rebuildSourceDerived()
    }

    /** 撤销一个来源的全部构造期修正（探云手偷走奇物 / 换武器 / 卸下被动） */
    removeSource(sourceId: string): boolean {
        const idx = this.sourceLayers.findIndex((l) => l.sourceId === sourceId)
        if (idx < 0) return false
        this.sourceLayers.splice(idx, 1)
        this.rebuildSourceDerived()
        return true
    }

    /** 层账 → 武器定义（基础武器 + 各层 weapon_tag）；武器属性门槛与展示都读它 */
    private derivedWeaponDef(): WeaponDef {
        const base = getWeapon(this.build.weapon)
        const extra = this.sourceLayers.flatMap((l) => l.weaponTags).filter((t) => !base.tags.includes(t))
        return extra.length > 0 ? { ...base, tags: [...base.tags, ...extra] } : base
    }

    /**
     * 重算层账：attrs = baseAttrs + Σ各层（每层先 converts、再 mods，mods 按 stat_restriction 夹取），
     * 然后汇总派生值（maxHpMod / triggerSlotMod / 武器 tag / 限制器 / 时长回调 / 触发槽上限）。
     *
     * 幂等：一律从 baseAttrs 起算、只用层上的**请求值**，所以删层后必然精确回退（不依赖任何反函数）。
     * 当前 hp/ap 不回填，只在 maxAp 变小时夹住（与既有 `max_ap_mod` 的 `capAp` 口径一致）。
     */
    private rebuildSourceDerived(): void {
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
        for (const layer of this.sourceLayers) {
            // 按层内声明的操作顺序回放：restriction 注册后只拦后面的 mod（与旧逐条应用一致）
            for (const op of layer.ops) {
                if (op.kind === 'restriction') {
                    checks.push(op.check)
                    continue
                }
                if (op.kind === 'convert') {
                    const src = this.attrs.get(op.from)
                    const delta = op.mode === 'floor' ? Math.floor(src * op.ratio) : Math.round(src * op.ratio)
                    for (const to of op.to) {
                        const beforeTo = this.attrs.get(to)
                        if (delta !== 0) this.attrs.modify(to, delta)
                        layer.applied[to] = (layer.applied[to] ?? 0) + (this.attrs.get(to) - beforeTo)
                    }
                    continue
                }
                const attr = op.attr
                let delta = op.value
                // 与旧 stat_buff 同一个夹取口径：限制器可 skip（归零）或用 delta 覆盖
                for (const check of checks) {
                    const result = check(this, attr, this.attrs.get(attr), delta, layer.sourceTags)
                    if (!result) continue
                    if (result.skip) {
                        delta = 0
                        break
                    }
                    if (result.delta !== undefined) delta = result.delta
                }
                const before = this.attrs.get(attr)
                if (delta !== 0) this.attrs.modify(attr, delta)
                layer.applied[attr] = (layer.applied[attr] ?? 0) + (this.attrs.get(attr) - before)
            }
            maxHpMod += layer.maxHpMod
            triggerSlotMod += layer.triggerSlotMod
            tags.push(...layer.weaponTags)
        }
        this.statRestrictionChecks = checks
        this.maxHpMod = maxHpMod
        this.triggerSlotMod = triggerSlotMod
        this.weaponDef = this.derivedWeaponDef()
        this.#maxTriggerSlots = Math.max(1, Math.floor(this.attrs.get('wisdom') / 4)) + this.triggerSlotMod
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
        this.addSource(
            `passive:${p.id}`,
            p.tags.includes('talent') ? 'talent' : 'passive',
            p.effects,
        )
        // triggers
        for (const slot of p.triggers ?? []) this.passiveTriggers.push(slot)
    }

    get maxHp(): number {
        return calcMaxHp(this.attrs.get('vitality')) + this.maxHpMod
    }

    get maxAp(): number {
        return calcMaxAp(this.attrs.get('vitality'), this.maxApMod)
    }

    get triggers(): TriggerSlot[] {
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
            forEachBuffOf(state.pendingBuffs, this.id, (buff, layer) => {
                if (!buff?.onRuntimeAction) return
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
     * 传了 engine 就补触发一遍装备期效果（`on_equip`）—— 与开局 `processOnEquipEffects` 同一个入口，
     * 否则偷来的奇物只有 `effects` 生效、装备期 buff 静默丢掉（金丝手套的招架率就属于后者）。
     */
    addArtifact(id: string, engine?: BattleEngine): boolean {
        if (this.artifactDefs.some((a) => a.id === id)) return false
        const def = getArtifact(id)
        if (!def) return false
        this.artifactDefs.push(def)
        this.addSource(`artifact:${id}`, 'artifact', def.effects)
        for (const t of def.triggers ?? []) this.passiveTriggers.push(t)
        if (engine) processOnEquipEffects(engine, this, [def], engine.state.turn.currentTime)

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
     *  仍触发 onHpChange（血战到底等随血量变化的 buff 联动）。血祭/血滴子/血炁护体等卖血用。 */
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
        forEachBuffOf(engine.state.pendingBuffs, this.id, (def, layer) => {
            if (def?.onHpChange) {
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
