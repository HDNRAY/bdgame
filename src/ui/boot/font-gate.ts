/**
 * 首屏字体门（CSS Font Loading API）
 * ============================================================================
 *
 * 干什么：首屏在像素字体就绪之前，屏幕上只压一层 loading 遮罩；字体到位（或超时）才揭开。
 * 这样玩家永远看不到「先用系统字体渲染、字体到位后整屏字形换掉」的那一下（FOUT）。
 *
 * 三条硬约束：
 * 1. **必须有超时兜底**：字体 404 / 被墙 / 被拦截 / 加载失败时，到点无条件放行 ——
 *    绝不能让玩家卡在 loading。超时值见 FONT_GATE_TIMEOUT_MS。
 * 2. **loading 遮罩自己不许用像素字体**（否则它自己也闪）：遮罩只用 CSS 画一根进度条，
 *    没有任何文字，也不引用 --font-family-*。
 * 3. **不许改首屏进度**：遮罩是叠在已经挂载好的 App 上的，不阻塞 React 挂载与懒加载 chunk
 *    （见 src/main.tsx 的启动顺序）；字体换掉时遮罩还没揭开，所以既看不到闪烁，
 *    也不会产生额外的布局位移（回退字体的行盒已被度量覆盖对齐，见 src/index.css）。
 *
 * 只等首屏真正用到的两份字体（12px 常规 + 粗体）：10px 那份留给后面用到它的页面，
 * 这里只「顺手预热」不阻塞 —— 否则慢网下白等一倍时间。
 */

/** 门的上限（毫秒）。依据见下方注释。 */
export const FONT_GATE_TIMEOUT_MS = 2500

/**
 * 首屏必须就绪的字体（`document.fonts.load` 的 font 简写）。
 * 12px 那对是首屏用量：首页标题 700、正文/按钮 400。
 */
export const FIRST_PAINT_FONTS = ['400 12px "Fusion Pixel 12px"', '700 12px "Fusion Pixel 12px"'] as const

/** 其余字面：不阻塞首屏，只在门开着的时候顺手预热，后面页面用到时已经在了 */
export const DEFERRED_FONTS = ['400 10px "Fusion Pixel 10px"', '700 10px "Fusion Pixel 10px"'] as const

/** 取样文字：只为触发字体加载，用像素字体一定有的字 */
export const FONT_GATE_SAMPLE = '单挑'

/** `document.fonts` 里我们用到的那一小撮能力（注入假对象就能单测） */
export interface FontFaceSetLike {
    load(spec: string, text?: string): Promise<unknown>
    check(spec: string, text?: string): boolean
}

export type FontGateReason = 'loaded' | 'unavailable' | 'timeout' | 'unsupported'

export interface FontGateResult {
    /** loaded=全部就绪；unavailable=加载结束但有字体没成功（已放行）；timeout=到点放行；unsupported=浏览器没有 Font Loading API */
    reason: FontGateReason
    /** 从进门到放行实际等了多久 */
    waitedMs: number
}

export interface FontGateOptions {
    timeoutMs?: number
    specs?: readonly string[]
    sample?: string
    /** 默认取 `document.fonts`；测试里注入假实现 */
    fonts?: FontFaceSetLike | null
    now?: () => number
    /** 预热（不等待）：默认把 DEFERRED_FONTS 也发起加载 */
    warmupSpecs?: readonly string[]
}

function defaultFonts(): FontFaceSetLike | null {
    if (typeof document === 'undefined') return null
    const fonts = (document as Document & { fonts?: FontFaceSetLike }).fonts
    return fonts && typeof fonts.load === 'function' ? fonts : null
}

/**
 * 等字体就绪。**任何情况下都会 resolve**（这是本模块的核心契约）：
 * - 全部加载成功 → 'loaded'
 * - 加载结束但有失败（404 / abort / 被墙）→ 'unavailable'，立即放行，不必干等到超时
 * - 迟迟不结束（请求被挂起 / 一直 pending）→ 'timeout'，到点放行
 * - 浏览器不支持 Font Loading API → 'unsupported'，立即放行
 */
export async function waitForFontGate(options: FontGateOptions = {}): Promise<FontGateResult> {
    const {
        timeoutMs = FONT_GATE_TIMEOUT_MS,
        specs = FIRST_PAINT_FONTS,
        sample = FONT_GATE_SAMPLE,
        fonts = defaultFonts(),
        now = () => Date.now(),
        warmupSpecs = DEFERRED_FONTS,
    } = options

    const startedAt = now()
    const done = (reason: FontGateReason): FontGateResult => ({ reason, waitedMs: now() - startedAt })

    if (!fonts) return done('unsupported')

    // 预热：只发起、不 await（失败也无所谓，反正是后面页面才用）
    if (warmupSpecs.length) {
        for (const spec of warmupSpecs) {
            try {
                void Promise.resolve(fonts.load(spec, sample)).catch(() => undefined)
            } catch {
                /* 规格字符串不合法之类：忽略 */
            }
        }
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs)
    })

    const settled = Promise.allSettled(
        specs.map((spec) => {
            // load() 可能同步抛（非法 spec），也要算进 settled，别让它把门炸掉
            try {
                return Promise.resolve(fonts.load(spec, sample))
            } catch {
                return Promise.reject(new Error('load threw'))
            }
        }),
    ).then(async () => {
        // 加载都结束了：只有「每一份都能用」才算 loaded，否则如实报 unavailable
        for (const spec of specs) {
            try {
                if (!fonts.check(spec, sample)) return 'unavailable' as const
            } catch {
                return 'unavailable' as const
            }
        }
        return 'loaded' as const
    })

    const reason = await Promise.race([settled, timeout])
    if (timer !== undefined) clearTimeout(timer)
    return done(reason)
}

/** 遮罩的 DOM id（CSS 在 src/index.css 的 #font-gate） */
export const FONT_GATE_ID = 'font-gate'

/**
 * 造 loading 遮罩：**没有文字**、不依赖任何字体文件，只用 CSS 画一根不确定进度条。
 * 挂到 body 而不是 #root：它要在 React 之外独立存在与被移除。
 */
export function createFontGateOverlay(doc: Document): HTMLElement {
    const overlay = doc.createElement('div')
    overlay.id = FONT_GATE_ID
    // 无障碍：屏幕阅读器念得到，视觉上仍然没有文字（避免遮罩自己 FOUT / 缺字变豆腐块）
    overlay.setAttribute('role', 'status')
    overlay.setAttribute('aria-label', '加载中')
    const bar = doc.createElement('div')
    bar.className = 'font-gate-bar'
    bar.appendChild(doc.createElement('div'))
    overlay.appendChild(bar)
    return overlay
}
