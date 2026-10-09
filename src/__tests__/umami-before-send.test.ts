import { describe, it, expect } from 'vitest'
import { UMAMI_BEFORE_SEND_HOOK } from '../bridge/analytics-before-send'

/**
 * `window.__umamiBeforeSend` 的行为（计划第 1.3 节）。
 *
 * 这是注入到构建产物里的**内联脚本原文**（从 `vite.config.ts` 导出，保证测的就是真正注入的那段，
 * 不是抄一份）。用 `new Function` 在本进程里执行，模拟 tracker 的调用方式；
 * 不需要 jsdom，也不触碰任何网络。
 */
function installHook(): { beforeSend: (type: string, payload: unknown) => unknown; window: Record<string, unknown> } {
    const win: Record<string, unknown> = {}
    // 注入脚本写的是 window.__umamiBeforeSend；用一个最小 window 对象执行它
    new Function('window', 'location', UMAMI_BEFORE_SEND_HOOK)(win, { pathname: '/bdgame/' })
    return { beforeSend: win.__umamiBeforeSend as (type: string, payload: unknown) => unknown, window: win }
}

describe('Umami before-send 钩子', () => {
    it('定义了 window.__umamiBeforeSend', () => {
        const { beforeSend } = installHook()
        expect(typeof beforeSend).toBe('function')
    })

    it('放行普通页浏览（原样返回 payload）', () => {
        const { beforeSend } = installHook()
        const payload = { url: '/bdgame/roguelite', title: '斗炁大会' }
        expect(beforeSend('pageview', payload)).toBe(payload)
    })

    it('挡掉 /dev 的页浏览（返回 falsy = 不发送）', () => {
        const { beforeSend } = installHook()
        expect(beforeSend('pageview', { url: '/bdgame/dev' })).toBe(false)
        expect(beforeSend('pageview', { url: '/bdgame/dev?tab=editor' })).toBe(false)
        // 线上 base 是 /bdgame/，DevMode 实际路径是 /bdgame/dev
        expect(beforeSend('pageview', { url: 'https://hdnray.github.io/bdgame/dev' })).toBe(false)
    })

    it('payload 没有 url 时退回 location.pathname（也能挡住 /dev）', () => {
        const win: Record<string, unknown> = {}
        new Function('window', 'location', UMAMI_BEFORE_SEND_HOOK)(win, { pathname: '/bdgame/dev' })
        const beforeSend = win.__umamiBeforeSend as (type: string, payload: unknown) => unknown
        expect(beforeSend('pageview', {})).toBe(false)
        expect(beforeSend('pageview', null)).toBe(false)
    })

    it('自定义事件不是页浏览，原样放行', () => {
        const { beforeSend } = installHook()
        const payload = { name: 'run_start', data: { has_cleared: false } }
        expect(beforeSend('event', payload)).toBe(payload)
    })
})
