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
 * onDebuffApply / onReceiveDebuff / onBuffApply / getExtraAttack / canTriggerAction /
 * logFormat 等——凡「结算时遍历某角色所有层找钩子」的才注册。
 * 例外：onDebuffApplied / onRuntimeAction 结算时不走 hooks 遍历直达（由攻方单点调用），
 * 但 AI 期望伤害评估的按钩子受限克隆（cloneForHooks）需要按桶选中它们，故也登记。
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
    'onActionChanCost',
    'onAction',
    'onRuntimeAction',
    'onOpponentAction',
    'onApSpent',
    'onTurnEnd',    'onReceiveHeal',
    'onChanOverflow',
    'onSummonInterval',
    'onHaste',
    'onMoveEfficiency',
    'onDisarmChance',
    'onDebuffTick',
    'onDebuffApplied',
    'apRegenPerSec',
    'chanRegenPerSec',
] as const

export type RegisteredHook = (typeof REGISTERED_HOOKS)[number]

/**
 * 钩子存在性掩码：注册钩子有 38 个，超出单个 int32 的 31 个可用正位，故拆成 lo(索引 0..30) /
 * hi(索引 31..) 两段。目的是让「这一组钩子里有没有任意一个」在热路径用两次位与回答（零分配、零字符串比较）。
 */
export interface HookMask {
    readonly lo: number
    readonly hi: number
}

/** 钩子 → 位掩码（模块级预计算，索引顺序即 REGISTERED_HOOKS 顺序） */
const HOOK_BIT_OF = new Map<RegisteredHook, HookMask>(
    REGISTERED_HOOKS.map((hook, i) => [hook, i < 31 ? { lo: 1 << i, hi: 0 } : { lo: 0, hi: 1 << (i - 31) }]),
)

/** 把一组钩子编译成掩码（调用方在模块级预计算一次，热路径只做位与） */
export function hookMaskOf(hooks: readonly RegisteredHook[]): HookMask {
    let lo = 0
    let hi = 0
    for (const hook of hooks) {
        const bit = HOOK_BIT_OF.get(hook)
        if (!bit) continue
        lo |= bit.lo
        hi |= bit.hi
    }
    return { lo, hi }
}

/**
 * 钩子存在性视图：回答「查询角色们的层里有没有某个钩子 / 某一组钩子里的任意一个」。
 * 与 forEachBuffOf 同源（都按 byOwner + getBuff 解析 def），因此「视图说不存在」等价于
 * 「forEachBuffOf 扫过去一个都不会命中」，守卫可以安全跳过整段扫描。
 */
export interface HookPresence {
    has(hook: RegisteredHook): boolean
    hasAny(mask: HookMask): boolean
}

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
    /** key → 建层序号（首次写入时分配；受限克隆按它回放，保证 byOwner 遍历顺序与全量克隆一致） */
    private keySeq = new Map<string, number>()
    /** originId → 该来源拥有的层 keys（来源层撤销走它，O(该来源的层)） */
    private bySource = new Map<string, Set<string>>()
    private nextSeq = 0
    /** 结构 revision：任何可能改变「有哪些层」的写入（建层/删层）都自增，用于失效钩子存在性缓存 */
    private revision = 0
    /** ownerId → 该角色层里出现的注册钩子掩码（结构 revision 变化时整体作废重算） */
    private ownerHookMask = new Map<string, HookMask>()
    private ownerHookMaskRevision = -1

    /** 建层/叠层：写入真源并同步 byOwner/hooks（真源写入走 super.set 避免重复解析 owner） */
    register(key: string, layer: BuffLayer, buff: BuffDef): void {
        this.#setRaw(key, layer)
        this.#syncHooks(key, layer, buff, 'add')
    }

    /** 移除：同步注销（属性回退不用额外处理 —— 删层后重算即精确回放） */
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

    /**
     * 钩子存在性视图（AI 期望伤害评估守卫用）：O(1) 回答「这些角色的层里有没有某钩子」。
     * 视图持有一份掩码，registry 结构变化（建层/删层 → revision 自增）后首次查询时自动重算；
     * 同一 revision 内多次查询直接复用（每次评估新建视图也只做 nOwners 次位或）。
     */
    presenceOf(charIds: string | readonly string[]): HookPresence {
        const ids = typeof charIds === 'string' ? [charIds] : [...charIds]
        let cachedRevision = -1
        let lo = 0
        let hi = 0
        const refresh = (): void => {
            let mlo = 0
            let mhi = 0
            for (const id of ids) {
                const m = this.#ownerHookMask(id)
                mlo |= m.lo
                mhi |= m.hi
            }
            lo = mlo
            hi = mhi
            cachedRevision = this.revision
        }
        return {
            has: (hook: RegisteredHook): boolean => {
                if (cachedRevision !== this.revision) refresh()
                const bit = HOOK_BIT_OF.get(hook)
                return bit ? (lo & bit.lo) !== 0 || (hi & bit.hi) !== 0 : false
            },
            hasAny: (mask: HookMask): boolean => {
                if (cachedRevision !== this.revision) refresh()
                return (lo & mask.lo) !== 0 || (hi & mask.hi) !== 0
            },
        }
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

    /**
     * 按钩子白名单过滤的克隆（AI 期望伤害评估专用）：只复制「属于 charIds 且 def 命中 hooks 白名单」的层。
     * 直接按 hooks 桶遍历取层（不扫 byOwner 全量层、不逐层判 def），只克隆真正会被读取的层；
     * 再按真源建层序号回放，保证克隆后 byOwner 遍历顺序与 cloneFor 一致（钩子链顺序敏感）；
     * 最后调用 resyncAllHooks() 重建完整 hooks 索引。
     * 语义对齐 cloneFor 的过滤版：其他状态不处理，调用方按需补。
     */
    cloneForHooks(charIds: readonly string[], hooks: readonly RegisteredHook[]): BuffRegistry {
        const out = new BuffRegistry()
        const owners = new Set(charIds)
        // 选层：只走 hooks 桶，不扫 byOwner 全量层
        const selected = new Map<string, BuffEntry>()
        for (const hook of hooks) {
            const entries = this.hooks.get(hook)
            if (!entries) continue
            for (const e of entries) {
                if (selected.has(e.key) || !owners.has(e.ownerId)) continue
                selected.set(e.key, e)
            }
        }
        // 按真源建层序号回放：钩子桶遍历不保证全局顺序，而 onDealDamage/onPostCritDamage 等是链式
        // （顺序敏感），必须让克隆后的 byOwner 遍历顺序与 cloneFor 完全一致。
        const ordered = [...selected.values()].sort((a, b) => (this.keySeq.get(a.key) ?? 0) - (this.keySeq.get(b.key) ?? 0))
        for (const e of ordered) {
            const layer = super.get(e.key)
            if (!layer) continue
            out.set(e.key, cloneBuffLayer(layer))
        }
        // 复制后按已有层重建 hook 索引（与建层时 register 的注册结果一致，含白名单之外的钩子）
        out.resyncAllHooks()
        return out
    }

    /** 全量重建所有层的 hook 注册（cloneForHooks 复制后调用；武器切换等场景亦可用来补齐） */
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

    /**
     * 某角色层里出现的注册钩子掩码（带缓存，按结构 revision 整体失效）。
     * 与 forEachBuffOf 同源：按 byOwner 的 key 抠 buffId → getBuff → def 的注册钩子，
     * 因此不会漏掉任何 forEachBuffOf 能扫到的层（含用裸 set 写入、hooks 桶里没登记的层）。
     */
    #ownerHookMask(ownerId: string): HookMask {
        if (this.ownerHookMaskRevision !== this.revision) {
            this.ownerHookMask.clear()
            this.ownerHookMaskRevision = this.revision
        }
        const cached = this.ownerHookMask.get(ownerId)
        if (cached) return cached
        let lo = 0
        let hi = 0
        const keys = this.byOwner.get(ownerId)
        if (keys) {
            for (const key of keys) {
                const sep = key.indexOf('::')
                const def = getBuff(sep < 0 ? key : key.slice(0, sep))
                if (!def) continue
                for (const hook of hooksOfDef(def)) {
                    const bit = HOOK_BIT_OF.get(hook)
                    if (!bit) continue
                    lo |= bit.lo
                    hi |= bit.hi
                }
            }
        }
        const mask: HookMask = { lo, hi }
        this.ownerHookMask.set(ownerId, mask)
        return mask
    }

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
        // 层结构可能变化 → 存在性缓存作废（同一 key 覆盖写也自增：多算一次无害，漏算会误判「不存在」）
        this.revision++
        // 首次写入时分配建层序号（重复 set 同一 key 不改变顺序，与 byOwner Set 语义一致）
        if (!this.keySeq.has(key)) this.keySeq.set(key, this.nextSeq++)
        const owner = this.#ownerOf(key)
        if (owner) {
            let keys = this.byOwner.get(owner)
            if (!keys) {
                keys = new Set()
                this.byOwner.set(owner, keys)
            }
            keys.add(key)
        }
        const originId = layer.originId
        if (originId) {
            let keys = this.bySource.get(originId)
            if (!keys) {
                keys = new Set()
                this.bySource.set(originId, keys)
            }
            keys.add(key)
        }
    }

    /** 某个来源（originId）当前拥有的层 key 列表 */
    keysOfOrigin(originId: string): string[] {
        return [...(this.bySource.get(originId) ?? [])]
    }

    /** 给已有层补打来源标记（层是先建后认领的场景：探云手偷来后把触发槽挂的层认到该奇物名下） */
    tagOrigin(key: string, originId: string): void {
        const layer = super.get(key)
        if (!layer) return
        layer.originId = originId
        let keys = this.bySource.get(originId)
        if (!keys) {
            keys = new Set()
            this.bySource.set(originId, keys)
        }
        keys.add(key)
    }

    /** 真源删除 + byOwner 同步（不注销 hooks，调用方负责 #syncHooks remove） */
    #deleteRaw(key: string): boolean {
        const layer = super.get(key)
        // 层结构变化 → 存在性缓存作废
        this.revision++
        const originId = layer?.originId
        if (originId) {
            const keys = this.bySource.get(originId)
            if (keys) {
                keys.delete(key)
                if (keys.size === 0) this.bySource.delete(originId)
            }
        }
        const owner = this.#ownerOf(key)
        if (owner) {
            const keys = this.byOwner.get(owner)
            if (keys) {
                keys.delete(key)
                if (keys.size === 0) this.byOwner.delete(owner)
            }
        }
        // 同步清建层序号：删后重加视为新层（与 byOwner 末尾追加的顺序一致）
        this.keySeq.delete(key)
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

/**
 * 取钩子存在性视图：pendingBuffs 是 BuffRegistry 时走索引；否则（测试手搓裸 Map，
 * 无 byOwner 索引可查）保守返回「所有钩子都存在」，守卫一律放行，语义与优化前完全一致。
 */
export function buffPresence(
    pendingBuffs: Map<string, BuffLayer>,
    charIds: string | readonly string[],
): HookPresence {
    if (pendingBuffs instanceof BuffRegistry) return pendingBuffs.presenceOf(charIds)
    return {
        has: () => true,
        hasAny: () => true,
    }
}
