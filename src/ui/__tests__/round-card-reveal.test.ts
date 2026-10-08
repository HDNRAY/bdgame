/**
 * 「新出现的内容进视野」的判定逻辑（`RoundCard.tsx` 的 `revealIfNeeded`）。
 *
 * 为什么只测这个纯函数：本项目没有 jsdom（`vitest.config.ts` 没有 environment 配置，
 * 也没装 jsdom/happy-dom），`renderToStaticMarkup` 不跑 `useEffect` ——
 * 「确认按钮出现后会不会调用滚动」这条线只能在浏览器里量（见同批改动的 H5 复现实测）。
 * 这里把判定与滚动动作独立出来，覆盖三件事：
 *   1. 折线以下（元素 bottom 超出容器 bottom）→ 滚，且默认用平滑动画；
 *   2. 已经完整可见 → 不滚（避免每次渲染都动、也不跟玩家手动滚动打架）；
 *   3. `prefers-reduced-motion` → 同样滚，但用即时跳转（behavior: 'auto'）。
 * 变异验证：把 `revealIfNeeded` 里的 `scrollIntoView` 调用去掉（改成直接 return），前三条断言全红。
 */
import { describe, expect, it, vi } from 'vitest'
import { revealIfNeeded } from '../components/roguelite/RoundCard'

/** 容器可见区域（模拟 .rs-rounds 的 rect） */
const VIEW = { top: 40, bottom: 548 }

function makeEl(top: number, bottom: number) {
    const scrollIntoView = vi.fn()
    const el = { getBoundingClientRect: () => ({ top, bottom }), scrollIntoView }
    return { el, scrollIntoView }
}

describe('revealIfNeeded', () => {
    it('元素在折线以下：滚进视野（默认平滑）', () => {
        const { el, scrollIntoView } = makeEl(1000, 1060)
        expect(revealIfNeeded(el, VIEW, false)).toBe(true)
        expect(scrollIntoView).toHaveBeenCalledTimes(1)
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
    })

    it('元素已经完全可见：不滚（不跟玩家的滚动打架）', () => {
        const { el, scrollIntoView } = makeEl(300, 360)
        expect(revealIfNeeded(el, VIEW, false)).toBe(false)
        expect(scrollIntoView).not.toHaveBeenCalled()
    })

    it('减弱动效偏好下即时跳转（behavior: auto）', () => {
        const { el, scrollIntoView } = makeEl(1000, 1060)
        expect(revealIfNeeded(el, VIEW, true)).toBe(true)
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
    })

    it('元素在容器上方（滚过去了）：也要拉回来', () => {
        const { el, scrollIntoView } = makeEl(-200, -140)
        expect(revealIfNeeded(el, VIEW, false)).toBe(true)
        expect(scrollIntoView).toHaveBeenCalledTimes(1)
    })

    it('1px 容差内视为已可见', () => {
        const { el, scrollIntoView } = makeEl(VIEW.top - 0.5, VIEW.bottom + 0.5)
        expect(revealIfNeeded(el, VIEW, false)).toBe(false)
        expect(scrollIntoView).not.toHaveBeenCalled()
    })
})
