import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { track, setAnalyticsBackend, sendToBackend, resolveWindowBackend, isThenable } from '../analytics'
import type { AnalyticsBackend } from '../analytics'

/**
 * 埋点薄封装的行为。**绝不使用真实 website-id**（计划第 7 节）：这里只注入假后端 / 假 `window.umami`。
 *
 * 注意：`import.meta.env.PROD` 是编译期常量，vitest 下为 false，所以 `track()` 的真实发送路径
 * 永远走不到 —— 发送 / 失败兜底的用例直接打 `sendToBackend()`（`track` 只是门控 + 转交），
 * 而 `track()` 本身只断言门控（不注入时什么都不发生）。
 */
/** 无 jsdom：伪造 globalThis.window（tracker 脚本挂上去的那个全局对象） */
function setWindow(value: unknown): void {
    Object.defineProperty(globalThis, 'window', { value, configurable: true, writable: true })
}

function clearWindow(): void {
    if ('window' in globalThis) delete (globalThis as { window?: unknown }).window
}

function fakeBackend(): AnalyticsBackend & { calls: unknown[][] } {
    const calls: unknown[][] = []
    return {
        calls,
        track(...args: unknown[]) {
            calls.push(args)
        },
    }
}

describe('track（env 门控）', () => {
    beforeEach(() => setAnalyticsBackend(undefined))
    afterEach(() => setAnalyticsBackend(undefined))

    it('未注入后端时不发送、不抛错（dev / 测试环境）', () => {
        expect(() => track('run_start', { has_cleared: false })).not.toThrow()
    })

    it('注入后端后发送一次，事件名与参数原样透传', () => {
        const backend = fakeBackend()
        setAnalyticsBackend(backend)
        track('story_pick', { story: 'feud' })
        expect(backend.calls).toEqual([['story_pick', { story: 'feud' }]])
    })

    it('6 个事件名与参数都能编译期通过（AnalyticsEventMap 约束的冒烟）', () => {
        const backend = fakeBackend()
        setAnalyticsBackend(backend)
        track('run_start', { has_cleared: true })
        track('story_pick', { story: 'sect' })
        track('chapter_reach', { chapter: 2, node: 12 })
        track('battle_end', { node: 5, won: true, champion_boss: false, tournament: false, injury: 0 })
        track('run_end', {
            outcome: 'true',
            node: 33,
            battles: 16,
            wins: 15,
            losses: 1,
            injuries: 40,
            rewards: 13,
        })
        track('run_abandon', { node: 7, battles: 3 })
        expect(backend.calls.map((c) => c[0])).toEqual([
            'run_start',
            'story_pick',
            'chapter_reach',
            'battle_end',
            'run_end',
            'run_abandon',
        ])
    })

    it('setAnalyticsBackend(null) 显式禁用：即使 window.umami 在也不发', () => {
        const umami = { track: vi.fn() }
        setWindow({ umami })
        setAnalyticsBackend(null)
        track('run_start', { has_cleared: false })
        sendToBackend('run_start', { has_cleared: false })
        expect(umami.track).not.toHaveBeenCalled()
        clearWindow()
    })
})

describe('sendToBackend（发送路径与失败兜底）', () => {
    afterEach(() => setAnalyticsBackend(undefined))

    it('window.umami 不存在时静默 no-op、不抛错', () => {
        setAnalyticsBackend(undefined)
        expect(resolveWindowBackend()).toBeNull()
        expect(() => sendToBackend('run_start', { has_cleared: false })).not.toThrow()
    })

    it('后端同步抛错时不向调用方抛错', () => {
        setAnalyticsBackend({
            track() {
                throw new Error('backend down')
            },
        })
        expect(() => sendToBackend('run_abandon', { node: 1, battles: 0 })).not.toThrow()
    })

    it('后端返回 rejected promise 时吞掉 rejection，不产生 unhandled rejection', async () => {
        setAnalyticsBackend({
            track() {
                return Promise.reject(new Error('network down'))
            },
        })
        const onUnhandled = vi.fn()
        process.on('unhandledRejection', onUnhandled)
        try {
            sendToBackend('run_start', { has_cleared: false })
            // 让 rejection 有机会冒出来
            await new Promise((r) => setTimeout(r, 0))
            expect(onUnhandled).not.toHaveBeenCalled()
        } finally {
            process.off('unhandledRejection', onUnhandled)
        }
    })

    it('setAnalyticsBackend(null) 显式禁用：什么都不发', () => {
        const backend = fakeBackend()
        setAnalyticsBackend(null)
        sendToBackend('run_start', { has_cleared: false })
        expect(backend.calls).toEqual([])
    })

    it('注入对象时绕过 env 门控（后端收到调用）', () => {
        const backend = fakeBackend()
        setAnalyticsBackend(backend)
        sendToBackend('chapter_reach', { chapter: 3, node: 23 })
        expect(backend.calls).toEqual([['chapter_reach', { chapter: 3, node: 23 }]])
    })
})

describe('resolveWindowBackend（广告拦截 / 脚本未加载 / 脚本晚到）', () => {
    afterEach(() => {
        clearWindow()
        setAnalyticsBackend(undefined)
    })

    it('window 不存在时返回 null（不报错）', () => {
        expect(resolveWindowBackend()).toBeNull()
    })

    it('window.umami 缺 track 函数（被拦截的残桩）时返回 null', () => {
        setWindow({ umami: {} })
        expect(resolveWindowBackend()).toBeNull()
    })

    it('window.umami.track 是函数时返回它（defer 脚本晚到也能接上）', () => {
        const umami = { track: vi.fn() }
        setWindow({ umami })
        expect(resolveWindowBackend()).toBe(umami)
        sendToBackend('story_pick', { story: 'wanderer' })
        expect(umami.track).toHaveBeenCalledWith('story_pick', { story: 'wanderer' })
    })
})

describe('isThenable', () => {
    it('Promise / 自定义 thenable 为真，其它为假', () => {
        expect(isThenable(Promise.resolve())).toBe(true)
        expect(isThenable({ catch: () => undefined })).toBe(true)
        expect(isThenable(undefined)).toBe(false)
        expect(isThenable(null)).toBe(false)
        expect(isThenable('x')).toBe(false)
        expect(isThenable({})).toBe(false)
    })
})
