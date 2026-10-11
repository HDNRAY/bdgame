import { describe, it, expect, vi } from 'vitest'
import {
    FONT_GATE_ID,
    FONT_GATE_TIMEOUT_MS,
    createFontGateOverlay,
    waitForFontGate,
    type FontFaceSetLike,
} from '../boot/font-gate'

/**
 * 首屏字体门（`src/ui/boot/font-gate.ts`）。
 *
 * 这个模块只有一条核心契约：**任何情况下都会 resolve**。
 * 下面最后两条用例就是钉这条的 —— 把实现里的超时兜底删掉，
 * 「字体一直 pending」那条会因为永远不 resolve 而红（变异验证见测试名带「兜底」的两条）。
 */

function makeFonts(load: FontFaceSetLike['load'], check: FontFaceSetLike['check'] = () => true): FontFaceSetLike {
    return { load, check }
}

describe('waitForFontGate', () => {
    it('全部字体加载成功 → loaded', async () => {
        const load = vi.fn().mockResolvedValue([])
        const res = await waitForFontGate({ fonts: makeFonts(load), warmupSpecs: [], now: () => 0 })
        expect(res.reason).toBe('loaded')
        expect(load).toHaveBeenCalled()
    })

    it('浏览器没有 Font Loading API → 立刻放行（unsupported）', async () => {
        const res = await waitForFontGate({ fonts: null, now: () => 0 })
        expect(res.reason).toBe('unsupported')
    })

    it('字体被 abort / 404（load reject）→ 立即放行，不干等到超时', async () => {
        const load = vi.fn().mockRejectedValue(new Error('Aborted'))
        let t = 0
        const res = await waitForFontGate({
            fonts: makeFonts(load, () => false),
            warmupSpecs: [],
            timeoutMs: 5000,
            now: () => (t += 10),
        })
        expect(res.reason).toBe('unavailable')
        expect(res.waitedMs).toBeLessThan(5000)
    })

    it('load 同步抛异常也照样放行（不把门炸掉）', async () => {
        const load = vi.fn(() => {
            throw new SyntaxError('bad spec')
        }) as unknown as FontFaceSetLike['load']
        const res = await waitForFontGate({ fonts: makeFonts(load, () => false), warmupSpecs: [], now: () => 0 })
        expect(res.reason).toBe('unavailable')
    })

    it('超时兜底：字体请求一直 pending → 到点放行（timeout）', async () => {
        vi.useFakeTimers()
        try {
            const never = new Promise<never>(() => {})
            const resPromise = waitForFontGate({
                fonts: makeFonts(() => never, () => false),
                warmupSpecs: [],
                timeoutMs: 2500,
            })
            // 还没到点：不该已经放行
            const race = await Promise.race([resPromise, Promise.resolve('pending')])
            expect(race).toBe('pending')
            await vi.advanceTimersByTimeAsync(2500)
            const res = await resPromise
            expect(res.reason).toBe('timeout')
            expect(res.waitedMs).toBeGreaterThanOrEqual(2500)
        } finally {
            vi.useRealTimers()
        }
    })

    it('超时兜底：一份 pending、一份失败 → 仍然到点放行，不会永远卡住（变异验证：删掉 timeout 这条会红）', async () => {
        vi.useFakeTimers()
        try {
            const fonts = makeFonts(
                (spec: string) => (spec.includes('400') ? new Promise<never>(() => {}) : Promise.reject(new Error('Aborted'))),
                () => false,
            )
            const resPromise = waitForFontGate({ fonts, warmupSpecs: [], timeoutMs: 1200 })
            await vi.advanceTimersByTimeAsync(5000)
            const res = await resPromise
            expect(res.reason).toBe('timeout')
        } finally {
            vi.useRealTimers()
        }
    })

    it('默认超时值落在 2–3 秒区间（产品口径：到点必须放行）', () => {
        expect(FONT_GATE_TIMEOUT_MS).toBeGreaterThanOrEqual(2000)
        expect(FONT_GATE_TIMEOUT_MS).toBeLessThanOrEqual(3000)
    })
})

describe('createFontGateOverlay', () => {
    // 本项目没有 jsdom（见 run-summary.test.tsx 的说明），用一个最小假 document 顶替
    function fakeDoc() {
        const make = (tag: string) => {
            const el = {
                tag,
                id: '',
                className: '',
                textContent: '',
                children: [] as unknown[],
                attrs: {} as Record<string, string>,
                setAttribute(k: string, v: string) {
                    el.attrs[k] = v
                },
                getAttribute(k: string) {
                    return el.attrs[k] ?? null
                },
                appendChild(c: unknown) {
                    el.children.push(c)
                    return c
                },
            }
            return el
        }
        return { createElement: make } as unknown as Document
    }

    it('遮罩 id 固定、没有任何文字、不引用像素字体', () => {
        const overlay = createFontGateOverlay(fakeDoc()) as unknown as {
            id: string
            textContent: string
            children: { className: string; children: unknown[] }[]
            getAttribute: (k: string) => string | null
        }
        expect(overlay.id).toBe(FONT_GATE_ID)
        // 关键：遮罩里一个字符都没有 —— 否则它自己也会 FOUT / 缺字变豆腐块
        expect(overlay.textContent).toBe('')
        expect(overlay.children).toHaveLength(1)
        expect(overlay.children[0].className).toBe('font-gate-bar')
        expect(overlay.getAttribute('role')).toBe('status')
        expect(overlay.getAttribute('aria-label')).toBe('加载中')
    })
})
