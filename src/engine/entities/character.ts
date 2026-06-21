import { ATTR_MIN, AttributeSet, type AttrName } from './attributes'
import { Action, type ActionDefinition, type EffectDef } from './action'
import type { CharacterBuild } from './character-build'
import type { Passive, Talent } from './passive'
import type { Artifact } from './artifact'
import type { TriggerSlot } from './trigger'
import type { WeaponDef } from '../data/weapons'
import { getAction as getActionDef } from '../data/actions'
import { getWeapon } from '../data/weapons'
import { getPassive } from '../data/passives'
import { getArtifact } from '../data/artifacts'
import { MAX_CHAN } from '../constants'

export function calcMaxHp(vitality: number): number {
    return 20 + vitality * 18
}

/** 根据体质计算最大 AP */
export function calcMaxAp(vitality: number, mod = 0): number {
    return Math.round(4 + vitality * 0.25) + mod
}

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

    /** 已解析的被动对象列表 */
    passiveDefs: Passive[] = []
    /** 被动注入的额外 trigger（不污染 build.triggers） */
    passiveTriggers: TriggerSlot[] = []
    /** 武器定义的 clone（含被动修改） */
    weaponDef?: WeaponDef
    /** 已解析的奇物/义体列表 */
    artifactDefs: Artifact[] = []
    /** 义体/效果修正 */
    maxApMod = 0
    maxHpMod = 0

    /** 移动效率倍率（0.2 = +20% 每AP移动距离） */
    moveEfficiency = 0
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

        // 3. 解析被动/奇物 ID → 定义
        this.passiveDefs = gainedPassives.map((id) => getPassive(id)).filter((p): p is Passive => p !== undefined)
        this.artifactDefs = gainedArtifacts.map((id) => getArtifact(id)).filter((a): a is Artifact => a !== undefined)

        // 4. 应用被动/奇物/武器效果
        for (const p of this.passiveDefs) this.applyPassive(p)
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
        }

        // 5. 缓存招式
        this.#actionCache = gainedActions
            .map((id) => {
                const def = getActionDef(id)
                return def ? new Action(def) : null
            })
            .filter((a): a is Action => a !== null)

        // 通用招式强化：被动钩子
        for (const p of this.passiveDefs) {
            if (!p.actionEnhancer) continue
            this.#actionCache = this.#actionCache.map((a) => {
                const modified = p.actionEnhancer!(a.def)
                return modified !== a.def ? new Action(modified) : a
            })
        }
        // 通用招式强化：义体钩子
        for (const a of this.artifactDefs) {
            if (!a.actionEnhancer) continue
            this.#actionCache = this.#actionCache.map((act) => {
                const modified = a.actionEnhancer!(act.def)
                return modified !== act.def ? new Action(modified) : act
            })
        }

        // 非空手角色自动获取捡武器招式
        if (
            weapon.id !== 'bare_hands' &&
            !this.#actionCache.some((a) => a.id === 'pickup_weapon' || a.id === 'retrieve_blade')
        ) {
            const pw = getActionDef('pickup_weapon')
            if (pw) this.#actionCache.push(new Action(pw))
        }

        this.ap = this.maxAp
        this.hp = calcMaxHp(this.attrs.get('vitality')) + this.maxHpMod
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
        const wis = this.attrs.get('wisdom')
        const maxSlots = Math.max(1, Math.floor(wis / 4)) + this.triggerSlotMod
        const buildSlots = this.build.triggers.slice(0, maxSlots)
        if (buildSlots.length < this.build.triggers.length) {
            console.warn(
                `[${this.name}] WIS=${wis} 仅 ${maxSlots} 个触发槽，`,
                `丢弃 ${this.build.triggers.length - maxSlots} 个招式触发`,
            )
        }
        return [...buildSlots, ...this.passiveTriggers]
    }

    /** 实时计算 haste（固定值 + 所有 eval 回调求值） */
    getHaste(): number {
        return this.haste + this.hasteCallbacks.reduce((sum, cb) => sum + cb(this), 0)
    }

    /** 运行时添加功法（自爆后获得独臂等），返回是否成功添加 */
    addPassive(id: string): boolean {
        if (this.passiveDefs.some((p) => p.id === id)) return false
        const def = getPassive(id) as Passive | undefined
        if (!def) return false
        this.passiveDefs.push(def)
        this.applyPassive(def)
        if (def.actionEnhancer) {
            this.#actionCache = this.#actionCache.map((a) => {
                const modified = def.actionEnhancer!(a.def)
                return modified !== a.def ? new Action(modified) : a
            })
        }
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

    takeDamage(amount: number): void {
        this.hp = Math.max(0, this.hp - amount)
    }
    heal(amount: number): void {
        this.hp = Math.min(this.maxHp, this.hp + amount)
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
        return true
    }

    /** 封顶当前 AP 不超过 maxAp（属性变动后调用） */
    capAp(): void {
        if (this.ap > this.maxAp) this.ap = this.maxAp
    }

    /** 增加缠劲（不超过上限） */
    addChan(amount: number): void {
        this.chan = Math.min(MAX_CHAN, this.chan + amount)
    }

    /** 消耗缠劲（不低于0） */
    spendChan(cost: number): void {
        this.chan = Math.max(0, this.chan - cost)
    }

    toJSON() {
        return {
            build: this.build,
            hp: this.hp,
            ap: this.ap,
            lastActionEndMs: this.lastActionEndMs,
        }
    }

    static fromJSON(data: ReturnType<Character['toJSON']>): Character {
        const c = new Character(data.build)
        c.hp = data.hp
        c.ap = data.ap
        c.lastActionEndMs = data.lastActionEndMs
        return c
    }

    /** 创建战斗用副本（所有数据独立，不污染原始） */
    cloneForBattle(): Character {
        const c = new Character(this.build)
        c.hp = this.maxHp
        c.ap = this.maxAp // 战斗开始满 AP
        c.lastActionEndMs = 0
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
            const next = Math.max(ATTR_MIN, cur + delta)
            char.attrs.set(attr as AttrName, next)
        }
    },
    stat_restriction(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'stat_restriction' }>
        char.statRestrictionChecks.push(e.check)
    },
    summon_damage_bonus(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'summon_damage_bonus' }>
        const weapon = getWeapon(char.build.weapon)
        if (weapon.summon) {
            const orig = getActionDef(weapon.summon.actionId)
            if (orig) {
                const clonedAction: ActionDefinition = {
                    ...orig,
                    effects: orig.effects?.map((ef) =>
                        ef.type === 'fixed_damage' ? { ...ef, value: ef.value + e.value } : ef,
                    ),
                }
                // 克隆武器，嵌入修改后的召唤动作
                char.weaponDef = { ...weapon, summon: { ...weapon.summon, action: clonedAction } }
            }
        }
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
    permanent_burn() {
        // 运行时由 engine 处理
    },
    crit_chance(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'crit_chance' }>
        if (e.reset) {
            char.critChance = 0
        } else {
            char.critChance += e.value
        }
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
    stat_parry_dodge(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'stat_parry_dodge' }>
        if (e.parryScale) char.parryMod += Math.round(char.attrs.get('dexterity') * e.parryScale * 100) / 100
        if (e.dodgeScale) char.dodgeMod += Math.round(char.attrs.get('agility') * e.dodgeScale * 100) / 100
    },
    weapon_range_bonus(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'weapon_range_bonus' }>
        const weapon = getWeapon(char.build.weapon)
        char.weaponDef = {
            ...weapon,
            range: [weapon.range[0], Math.min(10, weapon.range[1] + e.value)] as [number, number],
        }
    },
    trigger_slot_mod(char, eff) {
        const e = eff as Extract<EffectDef, { type: 'trigger_slot_mod' }>
        char.triggerSlotMod += e.value
    },
}
