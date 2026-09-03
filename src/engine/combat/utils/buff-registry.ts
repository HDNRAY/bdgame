import type { BuffDef } from '../../../data/buffs/types'
import { getBuff } from '../../../data/buffs'
import type { BuffLayer } from '../types'

/**
 * Buff 注册表：替代裸 Map<string, BuffLayer> 的 buff 存储。
 *
 * 三个结构同步维护：
 *  1. byKey    — 真源（Map 本体，key = "buffId::ownerId[:appId]"，快照直接 entries）
 *  2. byOwner  — ownerId → 该角色的 keys（按 owner 直达，不再全表扫 + 解析 key）
 *  3. hooks    — hook 类型 → 带该钩子的层条目（结算直达：onDealDamage 等只需遍历带此钩子的层）
 *
 * 注册时机：建层/叠层时按 def 有哪些钩子登记；移除时按 key 注销。
 * 不注册的钩子（建层/叠层/移除时单点调用，不靠遍历找）：onBuffApplied / onStackGain /
 * onDebuffApply / onReceiveDebuff / onBuffApply / onRuntimeAction / getExtraAttack / canTriggerAction /
 * logFormat / onDebuffApplied（由攻击方触发时单点）等——凡「结算时遍历某角色所有层找钩子」的才注册。
 */

/** 需要注册的「结算遍历类」钩子字段（遍历某角色层找带此钩子的 buff 调用） */
const REGISTERED_HOOKS = [
    'onAfterCritDamage',
    'onPostCritDamage',
    'onCritical',
    'onAfterDealDamage',
    'onCanBeParried',
    'onCanParry',
    'onParryChance',
    'onParry',      // 自己成功招架（遍历防御方 buff）
    'onParried',    // 对方招架了我的攻击（遍历攻击方 buff）
    'onParryReduction',
    'onParryPenetration',
    'onDealDamage',
    'onTakeDamage',
    'onAbsorb',
    'onDodgeChance',
    'onDodge',      // 自己成功闪避（遍历防御方 buff）
    'onDodged',     // 对方闪避了我的攻击（遍历攻击方 buff）
    'onHitChance',
    'onCritChance',
    'onCritTakenChance',
    'onCritDamage',
    'onCritTakenDamage',
    'onActionCost',
    'onAction',
    'onOpponentAction',
    'onApSpent',
    'onTurnEnd',    'onReceiveHeal',
    'onChanOverflow',
    'onSummonInterval',
    'onHaste',
    'onMoveEfficiency',
    'onDisarmChance',
    'onDebuffTick',
    'apRegenPerSec',
    'chanRegenPerSec',
] as const

export type RegisteredHook = (typeof REGISTERED_HOOKS)[number]

/** def → 它拥有的注册钩子列表缓存（def 静态，避免每次建层扫 33 个字段判断） */
const hookListCache = new WeakMap<BuffDef, RegisteredHook[]>()

/** 取某 def 拥有的注册钩子列表（带缓存） */
function hooksOfDef(buff: BuffDef): RegisteredHook[] {
    let list = hookListCache.get(buff)
    if (list) return list
    list = []
    for (const hook of REGISTERED_HOOKS) {
        if (typeof (buff as unknown as Record<string, unknown>)[hook] === 'function') list.push(hook)
    }
    hookListCache.set(buff, list)
    return list
}

/** 注册条目：缓存放层时已解析的 buffId/ownerId/def，遍历/结算不用再 getBuff + 抠 key */
export interface BuffEntry {
    key: string
    buffId: string
    ownerId: string
    def: BuffDef
    layer: BuffLayer
}

/** 从 key 解析 ownerId：`buffId::ownerId` 或 `buffId::ownerId::appId`；无 `::` 返回 '' */
export function parseOwnerFromKey(key: string): string {
    const sep = key.indexOf('::')
    if (sep < 0) return ''
    const rest = key.slice(sep + 2)
    const sep2 = rest.indexOf('::')
    return sep2 < 0 ? rest : rest.slice(0, sep2)
}

/** 浅克隆单个 buff layer（与旧 cloneBuffLayer 语义一致：mods/extra 各一层，extra 数组复制） */
export function cloneBuffLayer(l: BuffLayer): BuffLayer {
    const c: BuffLayer = { ...l }
    if (l.mods) c.mods = { ...l.mods }
    if (l.extra) {
        const extra: BuffLayer['extra'] = {}
        for (const [k, v] of Object.entries(l.extra)) {
            extra[k] = Array.isArray(v) ? ([...v] as number[] | string[]) : v
        }
        c.extra = extra
    }
    return c
}

export class BuffRegistry extends Map<string, BuffLayer> {
    /** ownerId → 该角色层 key 集合 */
    private byOwner = new Map<string, Set<string>>()
    /** hook 类型 → 注册条目（含 def，结算直达） */
    private hooks = new Map<RegisteredHook, BuffEntry[]>()
    /** key → 该层注册到了哪些 hook（移除时注销用） */
    private keyToHooks = new Map<string, RegisteredHook[]>()
    /** key → ownerId 缓存（set 高频路径避免重复 slice 解析） */
    private ownerCache = new Map<string, string>()

    /** 建层/叠层：写入真源并同步 byOwner/hooks（真源写入走 super.set 避免重复解析 owner） */
    register(key: string, layer: BuffLayer, buff: BuffDef): void {
        this.#setRaw(key, layer)
        this.#syncHooks(key, layer, buff, 'add')
    }

    /** 移除：同步注销（revertBuffMods 由调用方处理） */
    unregister(key: string): boolean {
        this.#syncHooks(key, undefined, undefined, 'remove')
        return this.#deleteRaw(key)
    }

    /** 按 owner 直达：该角色所有层的 key */
    keysOfOwner(ownerId: string): IterableIterator<string> {
        const keys = this.byOwner.get(ownerId)
        return keys ? keys.keys() : [][Symbol.iterator]()
    }

    /** ownerId → keys 是否存在（hasNoStance 等只想知道有无） */
    hasOwner(ownerId: string): boolean {
        return this.byOwner.has(ownerId)
    }

    /** 遍历某角色（们）的层，回调 (def, layer, buffId, key, ownerId)。语义与旧 forEachBuffOf 一致 */
    forEachBuffOf(
        ownerIds: string | readonly string[],
        fn: (def: BuffDef | undefined, layer: BuffLayer, buffId: string, key: string, ownerId: string) => void | false,
    ): void {
        const single = typeof ownerIds === 'string'
        const ids = single ? [ownerIds as string] : (ownerIds as readonly string[])
        for (const ownerId of ids) {
            const keys = this.byOwner.get(ownerId)
            if (!keys) continue
            for (const key of keys) {
                const layer = super.get(key)
                if (!layer) continue
                const sep = key.indexOf('::')
                const buffId = sep < 0 ? key : key.slice(0, sep)
                if (fn(getBuff(buffId), layer, buffId, key, ownerId) === false) return
            }
        }
    }

    /** 结算直达：遍历带指定钩子的层（ownerIds 可选过滤）。回调 (def, layer, ownerId, key) */
    forEachHook(
        hook: RegisteredHook,
        ownerIds: string | readonly string[] | undefined,
        fn: (def: BuffDef, layer: BuffLayer, ownerId: string, key: string) => void | false,
    ): void {
        const entries = this.hooks.get(hook)
        if (!entries) return
        const filterOwner = ownerIds === undefined ? null : Array.isArray(ownerIds) ? ownerIds : [ownerIds]
        for (const e of entries) {
            if (filterOwner && !filterOwner.includes(e.ownerId)) continue
            if (fn(e.def, e.layer, e.ownerId, e.key) === false) return
        }
    }

    /**
     * 只克隆指定角色的层（AI 评估沙盒：钩子只读写这些角色的层），返回独立 BuffRegistry。
     * 注意：克隆只同步 byOwner 索引，不重建 hook 注册表——沙盒内用 forEachBuffOf（走 byOwner）遍历，
     * 避免每层 getBuff + 33 次钩子字段判断的全量重建开销（热路径，frost×33 等层多场景差异显著）。
     * 真实战斗结算用 forEachHook 前若发现克隆缺注册，可调 resyncAllHooks() 补齐。
     */
    cloneFor(charIds: readonly string[]): BuffRegistry {
        const out = new BuffRegistry()
        for (const ownerId of charIds) {
            const keys = this.byOwner.get(ownerId)
            if (!keys) continue
            for (const key of keys) {
                const layer = super.get(key)
                if (!layer) continue
                out.set(key, cloneBuffLayer(layer))
            }
        }
        return out
    }

    /** 全量重建所有层的 hook 注册（cloneFor 后如需 forEachHook 直达时调用） */
    resyncAllHooks(): void {
        for (const [key, layer] of super.entries()) {
            const buffId = key.slice(0, key.indexOf('::'))
            const def = getBuff(buffId)
            if (def) this.#syncHooks(key, layer, def, 'add')
        }
    }

    /** 重建指定层的 hook 注册（武器切换/缴械后层结构变化时调用） */
    resyncHooks(key: string, layer: BuffLayer | undefined): void {
        this.#syncHooks(key, layer, undefined, 'remove')
        if (!layer) return
        const buffId = key.slice(0, key.indexOf('::'))
        const def = getBuff(buffId)
        if (def) this.#syncHooks(key, layer, def, 'add')
    }

    // ── Map 覆写：直接 set/delete 也同步 byOwner（hooks 需 def，走 register/resyncHooks） ──

    override set(key: string, layer: BuffLayer): this {
        // 直接 set（无 def 的散落层，如追踪标记）：同步 byOwner 即可，hooks 由 register 负责
        this.#setRaw(key, layer)
        return this
    }

    override delete(key: string): boolean {
        // 直接 delete（无 def 散落层的移除）：注销 hooks（若有）+ 同步 byOwner
        this.#syncHooks(key, undefined, undefined, 'remove')
        return this.#deleteRaw(key)
    }

    // ── 内部 ──

    /** 解析 ownerId 并缓存（set/delete/遍历高频路径避免重复 slice） */
    #ownerOf(key: string): string {
        let owner = this.ownerCache.get(key)
        if (owner !== undefined) return owner
        owner = parseOwnerFromKey(key)
        this.ownerCache.set(key, owner)
        return owner
    }

    /** 真源写入 + byOwner 同步（不建 hooks） */
    #setRaw(key: string, layer: BuffLayer): void {
        super.set(key, layer)
        const owner = this.#ownerOf(key)
        if (owner) {
            let keys = this.byOwner.get(owner)
            if (!keys) {
                keys = new Set()
                this.byOwner.set(owner, keys)
            }
            keys.add(key)
        }
    }

    /** 真源删除 + byOwner 同步（不注销 hooks，调用方负责 #syncHooks remove） */
    #deleteRaw(key: string): boolean {
        const owner = this.#ownerOf(key)
        if (owner) {
            const keys = this.byOwner.get(owner)
            if (keys) {
                keys.delete(key)
                if (keys.size === 0) this.byOwner.delete(owner)
            }
        }
        return super.delete(key)
    }

    /** 按 key 的 buffId 拿 def，把层登记/注销到它拥有的每个 hook 桶 */
    #syncHooks(key: string, layer: BuffLayer | undefined, buff: BuffDef | undefined, mode: 'add' | 'remove'): void {
        // remove 模式需要该层此前登记的 hook 列表（keyToHooks）；add 模式由 def 的钩子字段决定
        if (mode === 'remove') {
            const registered = this.keyToHooks.get(key)
            if (!registered) return
            for (const hook of registered) {
                const bucket = this.hooks.get(hook)
                if (!bucket) continue
                const idx = bucket.findIndex((e) => e.key === key)
                if (idx >= 0) bucket.splice(idx, 1)
                if (bucket.length === 0) this.hooks.delete(hook)
            }
            this.keyToHooks.delete(key)
            return
        }
        // add：登记 def 有的每个注册钩子
        if (!layer || !buff) return
        const buffId = key.slice(0, key.indexOf('::'))
        const ownerId = parseOwnerFromKey(key)
        const registered = hooksOfDef(buff)
        if (registered.length === 0) return
        for (const hook of registered) {
            let bucket = this.hooks.get(hook)
            if (!bucket) {
                bucket = []
                this.hooks.set(hook, bucket)
            }
            bucket.push({ key, buffId, ownerId, def: buff, layer })
        }
        this.keyToHooks.set(key, registered)
    }
}
