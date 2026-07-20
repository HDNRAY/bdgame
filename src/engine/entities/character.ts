import { AttributeSet, type AttrName } from './attributes'
import { Action, type ActionDefinition, type EffectDef } from './action'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { ActionConfig } from '../../game/entities/action-config'
import type { Passive, Talent } from './passive'
import type { Artifact } from './artifact'
import type { TriggerSlot } from './trigger'
import type { Tag } from './tag'
import type { WeaponDef } from '../../data/weapons/weapons'
import type { AttackStyle } from '../ai/move-planner'
import { classifyAttackStyle } from '../ai/move-planner'
import { calcMaxHp, calcMaxAp } from '../calc/stats'
import { getAction as getActionDef } from '../../data/actions'
import { getWeapon } from '../../data/weapons/weapons'
import { getPassive } from '../../data/passives'
import { getArtifact } from '../../data/artifacts'
import { getBuff } from '../../data/buffs'
import { TRIGGER_CONDITIONS } from '../../data/triggers'
import { MAX_CHAN } from '../constants'
import type { BattleEngine } from '../combat/engine'

export class Character {
    readonly build: CharacterBuild
    readonly id: string
    name: string
    attrs: AttributeSet
    hp: number
    ap: number
    /** 缠劲层数 */
    chan = 0
    /** 上次行动结束的绝对时间 (ms)，0=未行动过 */
    lastActionEndMs = 0
    /** 上次召唤物 AP 恢复时间 */
    lastApUpdate = 0
    /** 永久灼烧值（power_furnace），engine 初始化时转为 buff */
    permanentBurn = 0

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
    /** 待应用的 weapon_tag（构造时先记录，武器设置后统一应用） */
    pendingWeaponTags: Tag[] = []
    /** 已解析的奇物/义体列表 */
    artifactDefs: Artifact[] = []
    /** 义体/效果修正 */
    maxApMod = 0
    maxHpMod = 0

    /** 移动效率倍率（0.2 = +20% 每AP移动距离） */
    moveEfficiency = 0
    /** 战斗风格（构建时按武器自动决定，不走 build.battleStyle fallback） */
    battleStyle: AttackStyle
    /** 身法相关独立加速（凌波微步等） */
    haste = 0
    /** haste eval 回调列表（构造期收集，getHaste 时求值） */
    hasteCallbacks: Array<(char: Character) => number> = []
    /** 额外暴击率 */
    critChance = 0
    /** 额外暴击伤害倍率 */
    critDamageMod = 0
    /** 额外触发槽位（奇物提供） */
    triggerSlotMod = 0
    /** stat_restriction 回调列表 */
    statRestrictionChecks: Array<
        (
            char: Character,
            attr: string,
            current: number,
            delta: number,
            sourceTags?: string[],
        ) => { skip?: boolean; delta?: number } | null
    > = []
    /** 闪避修正 */
    dodgeMod = 0
    /** 招架修正 */
    parryMod = 0

    constructor(build: CharacterBuild) {
        this.build = build
        this.id = build.id
        this.name = build.name

        // 1. 直接使用最终属性值
        this.attrs = new AttributeSet(build.baseAttrs)

        // 2. 编译非属性奖励 → 分类收集
        const gainedPassives: string[] = []
        const gainedArtifacts: string[] = []
        const gainedActions: string[] = []
        for (const r of build.rewards) {
            if (r.type === 'passive') gainedPassives.push(r.id)
            else if (r.type === 'artifact') gainedArtifacts.push(r.id)
            else if (r.type === 'action') gainedActions.push(r.id)
        }

        // 2a. 检查重复奖励（功法/奇物/招式）
        const checkDup = (items: string[], label: string): void => {
            const seen = new Set<string>()
            const dups: string[] = []
            for (const id of items) {
                if (seen.has(id)) dups.push(id)
                seen.add(id)
            }
            if (dups.length > 0) {
                throw new Error(
                    `[${build.name}] 发现重复${label}: ${[...new Set(dups)].join(', ')}。` +
                        `请检查奖励列表，每个${label}最多出现一次。`,
                )
            }
        }
        checkDup(gainedPassives, '功法')
        checkDup(gainedArtifacts, '奇物')
        checkDup(gainedActions, '招式')

        // 3. 解析被动/奇物 ID → 定义
        this.passiveDefs = gainedPassives.map((id) => getPassive(id)).filter((p): p is Passive => p !== undefined)
        this.artifactDefs = gainedArtifacts.map((id) => getArtifact(id)).filter((a): a is Artifact => a !== undefined)

        // 4. 应用被动/奇物/武器效果
        for (const p of this.passiveDefs) {
            this.applyPassive(p)
            // 功法赋予的招式
            if (p.grantsActions) gainedActions.push(...p.grantsActions)
        }
        for (const a of this.artifactDefs) {
            for (const eff of a.effects ?? []) {
                const handler = passiveEffectHandlers[eff.type]
                if (handler) handler(this, eff)
            }
            for (const t of a.triggers ?? []) this.passiveTriggers.push(t)
            // 义体赋予的招式
            if (a.grantsActions) gainedActions.push(...a.grantsActions)
        }
        const weapon = getWeapon(build.weapon)
        this.weaponDef = weapon
        // 应用被动的 weapon_tag
        for (const tag of this.pendingWeaponTags) {
            if (!weapon.tags.includes(tag)) {
                this.weaponDef = { ...weapon, tags: [...weapon.tags, tag] }
            }
        }
        // 自动决定战斗风格
        this.battleStyle = build.battleStyle ?? classifyAttackStyle(this.weaponDef?.range ?? [0, 2])
        // 武器属性要求检测
        const weaponOk =
            !weapon.requireAttrsMin ||
            Object.entries(weapon.requireAttrsMin).every(([attr, req]) => this.attrs.get(attr as AttrName) >= req!)
        if (weaponOk) {
            const activeWeapon = this.weaponDef ?? weapon
            for (const eff of activeWeapon.effects ?? []) {
                const handler = passiveEffectHandlers[eff.type]
                if (handler) handler(this, eff)
            }
            for (const t of activeWeapon.triggers ?? []) this.passiveTriggers.push(t)
            if (activeWeapon.grantsActions) gainedActions.push(...activeWeapon.grantsActions)
        }

        // 5. 缓存招式
        this.#actionCache = gainedActions
            .map((id) => {
                const def = getActionDef(id)
                return def ? new Action(def) : null
            })
            .filter((a): a is Action => a !== null)

        // 5b. 补充触发招式（被动/奇物/actionConfig 引用的内部招式）到缓存，供 maxUses 追踪
        const triggerActionIds = new Set<string>()
        for (const p of this.passiveDefs) {
            for (const t of p.triggers ?? []) if (t.actionId) triggerActionIds.add(t.actionId)
        }
        for (const a of this.artifactDefs) {
            for (const t of a.triggers ?? []) if (t.actionId) triggerActionIds.add(t.actionId)
        }
        for (const ac of build.actionConfigs ?? []) {
            if (ac.actionId) triggerActionIds.add(ac.actionId)
        }
        const existingIds = new Set(this.#actionCache.map((a) => a.id))
        for (const id of triggerActionIds) {
            if (!existingIds.has(id)) {
                const def = getActionDef(id)
                if (def) this.#actionCache.push(new Action(def))
            }
        }

        // 通用招式强化：被动钩子
        for (const p of this.passiveDefs) {
            if (p.actionEnhancer) this.#applyActionEnhancer(p.actionEnhancer)
        }
        // 通用招式强化：义体钩子
        for (const a of this.artifactDefs) {
            if (a.actionEnhancer) this.#applyActionEnhancer(a.actionEnhancer)
        }

        // 非空手、非御物角色自动获取捡武器招式
        if (
            weapon.id !== 'bare_hands' &&
            !weapon.tags.includes('imperial') &&
            !this.#actionCache.some((a) => a.id === 'pickup_weapon' || a.id === 'retrieve_blade')
        ) {
            const pw = getActionDef('pickup_weapon')
            if (pw) this.#actionCache.push(new Action(pw))
        }

        this.ap = this.maxAp
        this.hp = calcMaxHp(this.attrs.get('vitality')) + this.maxHpMod

        // 按 actionConfigs 排序
        if (build.actionConfigs) {
            const order = new Map(build.actionConfigs.map((c, i) => [c.actionId, i]))
            this.#actionCache.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
        }

        // 初始化触发条件缓存（战斗期间固定，不随属性变化）
        const initWis = this.attrs.get('wisdom')
        this.#maxTriggerSlots = Math.max(1, Math.floor(initWis / 4)) + this.triggerSlotMod
        this.#configTriggers = this.#buildConfigTriggers()
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

    get passives(): Passive[] {
        return this.passiveDefs
    }

    /** 应用被动：达标检测 → effects + triggers */
    applyPassive(p: Passive): void {
        // 属性要求检测（不达标则不生效）
        if (p.requireAttrsMin) {
            const ok = Object.entries(p.requireAttrsMin).every(([attr, req]) => this.attrs.get(attr as AttrName) >= req)
            if (!ok) return
        }
        // Talent requireAttrsMax
        if ('requireAttrsMax' in p) {
            const t = p as unknown as Talent
            const maxOk = Object.entries(t.requireAttrsMax!).every(
                ([attr, req]) => this.attrs.get(attr as AttrName) <= req,
            )
            if (!maxOk) return
        }
        // effects
        for (const eff of p.effects ?? []) {
            const handler = passiveEffectHandlers[eff.type]
            if (handler) handler(this, eff)
        }
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

    #buildConfigTriggers(): TriggerSlot[] {
        const result: TriggerSlot[] = []
        const seenTriggers = new Set<string>()
        for (const ac of this.build.actionConfigs ?? []) {
            if (!ac.triggerId) continue
            if (seenTriggers.has(ac.triggerId)) {
                throw new Error(
                    `重复触发条件: ${ac.triggerId}（招式「${ac.actionId}」），每个触发条件只能被一个招式使用`,
                )
            }
            seenTriggers.add(ac.triggerId)
            const tc = TRIGGER_CONDITIONS.find((t) => t.id === ac.triggerId)
            if (!tc) continue
            result.push({
                condition: { type: tc.type, buffId: tc.buffId, check: tc.check },
                actionId: ac.actionId,
            })
        }
        return result
    }

    /** 获取招式配置 */
    getConfig(actionId: string): ActionConfig | undefined {
        return this.build.actionConfigs?.find((c) => c.actionId === actionId)
    }

    /** 实时计算 haste（固定值 + 所有 eval 回调求值） */
    getHaste(): number {
        return this.haste + this.hasteCallbacks.reduce((sum, cb) => sum + cb(this), 0)
    }

    /** 获取所有招式中最远射程（用于 dash targetDist: -1 解析，仅统计非辅助招式） */
    getMaxActionRange(): number {
        const weapon = this.weaponDef ?? getWeapon(this.build.weapon)
        return Math.max(
            ...this.actions
                .filter((a) => !a.def.tags.includes('pre_action') && !a.def.tags.includes('post_action'))
                .map((a) => {
                    const r = a.def.getRange?.(weapon.range, this) ?? weapon.range
                    return r[1]
                }),
        )
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

    /** 运行时添加功法（自爆后获得独臂等），返回是否成功添加 */
    addPassive(id: string): boolean {
        if (this.passiveDefs.some((p) => p.id === id)) return false
        const def = getPassive(id) as Passive | undefined
        if (!def) return false
        this.passiveDefs.push(def)
        this.applyPassive(def)
        if (def.actionEnhancer) this.#applyActionEnhancer(def.actionEnhancer)
        return true
    }

    /** 运行时添加奇物 */
    addArtifact(id: string): boolean {
        if (this.artifactDefs.some((a) => a.id === id)) return false
        const def = getArtifact(id)
        if (!def) return false
        this.artifactDefs.push(def)
        for (const eff of def.effects ?? []) {
            const handler = passiveEffectHandlers[eff.type]
            if (handler) handler(this, eff)
        }
        for (const t of def.triggers ?? []) this.passiveTriggers.push(t)
        if (def.actionEnhancer) this.#applyActionEnhancer(def.actionEnhancer)
        return true
    }

    /** 检查是否拥有指定天赋（基于 passiveDefs，构造期/运行时均可用） */
    hasTalent(id: string): boolean {
        return this.passiveDefs.some((p) => p.id === id)
    }

    get artifacts(): Artifact[] {
        return this.artifactDefs
    }

    #actionCache: Action[] = []
    get actions(): Action[] {
        return this.#actionCache
    }

    takeDamage(amount: number, engine?: BattleEngine): void {
        const prevHp = this.hp
        this.hp = Math.max(0, this.hp - amount)
        const dealt = prevHp - this.hp
        if (dealt > 0 && engine) {
            this.addChan(Math.round(dealt * 0.3 * 10) / 10)
            engine.checkChanOverflow(this.id)
        }
        if (engine && dealt > 0) this.#fireHpChange(engine)
    }
    heal(amount: number, engine?: BattleEngine): void {
        const prevHp = this.hp
        this.hp = Math.min(this.maxHp, this.hp + amount)
        if (engine && this.hp > prevHp) this.#fireHpChange(engine)
    }

    /** 触发 onHpChange 钩子 */
    #fireHpChange(engine: BattleEngine): void {
        for (const [key, layer] of engine.state.pendingBuffs) {
            const parts = key.split('::')
            if (parts.length < 2 || parts[1] !== this.id) continue
            const def = getBuff(parts[0])
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
        }
    }
    isAlive(): boolean {
        return this.hp > 0
    }

    /** 重置为满 AP（初始化用） */
    resetAp(): void {
        this.ap = this.maxAp
    }

    spendAp(cost: number): boolean {
        if (this.ap < cost) return false
        this.ap -= cost
        this.addChan(cost)
        return true
    }

    /** 封顶当前 AP 不超过 maxAp（属性变动后调用） */
    capAp(): void {
        if (this.ap > this.maxAp) this.ap = this.maxAp
    }

    /** 增加缠劲（不超过上限） */
    addChan(amount: number): void {
        this.chan = Math.min(MAX_CHAN, Math.round((this.chan + amount) * 10) / 10)
    }

    /** 消耗缠劲（不低于0） */
    spendChan(cost: number): void {
        this.chan = Math.max(0, Math.round((this.chan - cost) * 10) / 10)
    }

    toJSON() {
        return {
            build: this.build,
            hp: this.hp,
            ap: this.ap,
            lastActionEndMs: this.lastActionEndMs,
            lastApUpdate: this.lastApUpdate,
        }
    }

    static fromJSON(data: ReturnType<Character['toJSON']>): Character {
        const c = new Character(data.build)
        c.hp = data.hp
        c.ap = data.ap
        c.lastActionEndMs = data.lastActionEndMs
        c.lastApUpdate = data.lastApUpdate
        return c
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

    get snapshot() {
        return {
            hp: this.hp,
            maxHp: this.maxHp,
            ap: this.ap,
        }
    }
}

// ── 被动效果分发表（构造期执行，无战斗上下文） ──

const passiveEffectHandlers: Record<string, (char: Character, eff: EffectDef) => void> = {
    haste(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'haste' }>
        if (e.value) char.haste += e.value
        if (e.eval) char.hasteCallbacks.push(e.eval)
    },
    attr_floor(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'attr_floor' }>
        for (const [attr, value] of Object.entries(e.attrs)) {
            char.attrs.minValues[attr as AttrName] = value
        }
    },
    stat_buff(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'stat_buff' }>
        for (const [attr, value] of Object.entries(e.attrs)) {
            let delta = value as number
            for (const check of char.statRestrictionChecks ?? []) {
                const cur = char.attrs.get(attr as AttrName)
                const result = check(char, attr, cur, delta)
                if (!result) continue
                if (result.skip) {
                    delta = 0
                    break
                }
                if (result.delta !== undefined) delta = result.delta
            }
            if (delta === 0) continue
            const cur = char.attrs.get(attr as AttrName)
            char.attrs.set(attr as AttrName, cur + delta)
        }
    },
    stat_ratio(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'stat_ratio' }>
        for (const [attr, ratio] of Object.entries(e.attrs)) {
            const base = char.build.baseAttrs[attr as AttrName] ?? 0
            const keep = Math.floor(base * (ratio as number))
            const reduction = base - keep
            if (reduction > 0) char.attrs.modify(attr as AttrName, -reduction)
        }
    },
    stat_restriction(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'stat_restriction' }>
        char.statRestrictionChecks.push(e.check)
    },
    // 义体效果（构造期执行）
    max_ap_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'max_ap_mod' }>
        char.maxApMod += e.value
    },
    max_hp_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'max_hp_mod' }>
        char.maxHpMod += e.value
    },
    move_efficiency(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'move_efficiency' }>
        char.moveEfficiency += e.value
    },
    trigger_slot_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'trigger_slot_mod' }>
        if (e.fn) {
            char.triggerSlotMod += e.fn(char)
        } else {
            char.triggerSlotMod += e.value ?? 0
        }
    },
    dex_to_str(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'dex_to_str' }>
        const bonus = Math.floor(char.attrs.get('dexterity') * e.ratio)
        char.attrs.modify('strength', bonus)
    },
    wisdom_stat_buff(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'wisdom_stat_buff' }>
        const wis = char.attrs.get('wisdom')
        for (const attr of e.attrs) {
            const delta = Math.round(wis * e.ratio)
            char.attrs.modify(attr as AttrName, delta)
        }
    },
    permanent_burn(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'permanent_burn' }>
        char.permanentBurn = (char.permanentBurn ?? 0) + e.value
    },
    crit_damage(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'crit_damage' }>
        if (e.reset) {
            char.critDamageMod = 0
        } else {
            char.critDamageMod += e.value
        }
    },
    dodge_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'dodge_mod' }>
        char.dodgeMod += e.value
    },
    parry_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'parry_mod' }>
        char.parryMod += e.value
    },
    weapon_tag(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'weapon_tag' }>
        char.pendingWeaponTags.push(e.tag)
        const weapon = char.weaponDef ?? getWeapon(char.build.weapon)
        if (!weapon.tags.includes(e.tag)) {
            char.weaponDef = { ...weapon, tags: [...weapon.tags, e.tag] }
        }
    },
    weapon_range_bonus(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'weapon_range_bonus' }>
        const weapon = getWeapon(char.build.weapon)
        if (e.requireWeaponTag && !weapon.tags.includes(e.requireWeaponTag as Tag)) return
        char.weaponDef = {
            ...weapon,
            range: [weapon.range[0], Math.min(10, weapon.range[1] + e.value)] as [number, number],
        }
    },
}
