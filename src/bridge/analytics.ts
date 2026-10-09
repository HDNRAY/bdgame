/**
 * Umami 埋点薄封装（计划见 `docs/analytics-plan.md` 第 4 节）。
 *
 * 职责只有一件：把「发一个事件」收敛成一次带类型检查的函数调用。**调用点永远不碰 `window.umami`**。
 *
 * 四条硬约束：
 * 1. tracker 没加载（广告拦截、dev、离线）时静默 no-op，绝不抛错、不 await、不检查返回值；
 *    「不存在」这个结果不缓存 —— 第三方脚本是 defer 晚到的，加载完成后要能接上。
 * 2. dev / 测试不发：`import.meta.env.PROD` 是编译期门控（vitest 下为 false）。
 * 3. 参数只有游戏内 id / 枚举 / 数字，不发任何可识别信息、不发完整 build（计划第 5 节）。
 * 4. 页浏览不在这里发：tracker 的 `data-auto-track` 在 SPA 里自动记录路由变化，
 *    手写会重复计数（计划第 0.3 节）。
 */

/** 事件名 → 参数形状。写错事件名或参数编译不过。 */
export interface AnalyticsEventMap {
    run_start: { has_cleared: boolean }
    story_pick: { story: string }
    chapter_reach: { chapter: 2 | 3; node: 12 | 23 }
    battle_end: {
        node: number
        won: boolean
        champion_boss: boolean
        tournament: boolean
        injury: number
    }
    run_end: {
        outcome: 'true' | 'loop' | 'fallen' | 'eliminated'
        node: number
        battles: number
        wins: number
        losses: number
        injuries: number
        rewards: number
    }
    run_abandon: { node: number; battles: number }
}

/** 事件名 */
export type AnalyticsEvent = keyof AnalyticsEventMap

/** 发送后端。真实实现是 tracker 脚本挂到 `window.umami` 上的对象。 */
export interface AnalyticsBackend {
    track(event: string, data?: unknown): unknown
}

/** 测试注入缝（仿 `src/game/meta-save.ts` 的 `setMetaStorage`）：非 undefined 时绕过 env 门控。 */
let injected: AnalyticsBackend | null | undefined

/**
 * 注入后端（测试用）。
 * - 传对象：绕过 `import.meta.env.PROD` 门控，验证发送路径；
 * - 传 `null`：显式禁用（即使 `window.umami` 在也不发）；
 * - 传 `undefined`：恢复默认（走 `window.umami`）。
 * 生产代码永远不会调用它。
 */
export function setAnalyticsBackend(backend: AnalyticsBackend | null | undefined): void {
    injected = backend
}

/** 从 `window` 上取 tracker（未加载 / 被广告拦截时为 null）。源码里只有这一处碰 `window.umami`。 */
export function resolveWindowBackend(): AnalyticsBackend | null {
    if (typeof window === 'undefined') return null
    const umami: unknown = window.umami
    if (!umami || typeof umami !== 'object') return null
    const track: unknown = (umami as { track?: unknown }).track
    return typeof track === 'function' ? (umami as AnalyticsBackend) : null
}

/**
 * 发送路径（后端的选择与失败兜底）。
 * 拆成独立导出是为了单测：`import.meta.env.PROD` 是编译期常量，测试里无法伪造，
 * 所以 `track()` 在 vitest 下永远走不到这里；直接测这个函数即可覆盖"tracker 缺失 / 抛错 / rejected"。
 */
export function sendToBackend<K extends AnalyticsEvent>(event: K, data: AnalyticsEventMap[K] | undefined): void {
    const backend = injected !== undefined ? injected : resolveWindowBackend()
    if (!backend) return
    try {
        const ret = backend.track(event, data)
        if (isThenable(ret)) ret.catch(() => undefined)
    } catch {
        /* 埋点失败绝不能变成游戏失败 */
    }
}

/** thenable 判定：`PromiseLike` / 第三方自定义 thenable 都算，统一挂 `.catch` 吞掉网络失败。 */
export function isThenable(v: unknown): v is { catch(onRejected: (reason: unknown) => void): unknown } {
    return (
        !!v &&
        (typeof v === 'object' || typeof v === 'function') &&
        typeof (v as { catch?: unknown }).catch === 'function'
    )
}

/** 声明一个全局变量（tracker 的 dev 调试接口 / 注入的 before-send 钩子都是这种形状）。 */
declare global {
    interface Window {
        umami?: { track?(event: string, data?: unknown): unknown }
    }
}

/**
 * 唯一出口。事件名与参数形状都由 `AnalyticsEventMap` 约束。
 * 任何失败（后端不存在 / 同步抛错 / 返回 rejected promise）都在这里被吞掉，不影响游戏。
 */
export function track<K extends AnalyticsEvent>(event: K, data?: AnalyticsEventMap[K]): void {
    // 编译期门控：dev / 测试整段被 tree-shake 掉；注入缝（测试用）是唯一例外
    if (!import.meta.env.PROD && injected === undefined) return
    sendToBackend(event, data)
}
