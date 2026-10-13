import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_CHAR_GAP_UNITS } from '../layout'

/**
 * 渲染器级别的「身体间距」守卫（主判据）。
 *
 * 纯函数测试只能守 layout.ts，守不住**渲染器有没有真的应用**内容居中补偿。
 * 这里用最小 PIXI 替身把每个 Graphics 的 rect 记下来，直接量两具身体的实际像素位置：
 * - 按内容居中补偿后，身体间距 == 画面位置差（clamp 之后）；
 * - 无补偿时身体间距是 |centerGap − 81px|（距离 4 会反叠）→ 去掉补偿这组断言必红。
 */
const created: MockGraphics[] = []

class MockGraphics {
    rects: number[][] = []
    position = { x: 0, y: 0, set: (x: number, y: number) => ((this.position.x = x), (this.position.y = y)) }
    pivot = { x: 0, y: 0, set: (x: number, y: number) => ((this.pivot.x = x), (this.pivot.y = y)) }
    rotation = 0
    alpha = 1
    visible = true
    children: unknown[] = []
    constructor() {
        created.push(this)
    }
    clear(): this {
        this.rects = []
        return this
    }
    rect(x: number, y: number, w: number, h: number): this {
        this.rects.push([x, y, w, h])
        return this
    }
    circle(): this {
        return this
    }
    moveTo(): this {
        return this
    }
    lineTo(): this {
        return this
    }
    stroke(): this {
        return this
    }
    fill(): this {
        return this
    }
    addChild(c: unknown): void {
        this.children.push(c)
    }
    removeChild(): void {
        /* noop */
    }
    removeChildren(): void {
        this.children = []
    }
    destroy(): void {
        /* noop */
    }
}

vi.mock('pixi.js', () => ({
    Application: class {
        canvas = { style: {} as Record<string, string> }
        stage = { addChild: () => undefined }
        async init(): Promise<void> {
            /* noop */
        }
        destroy(): void {
            /* noop */
        }
    },
    Container: MockGraphics,
    Graphics: MockGraphics,
    Text: class {
        anchor = { set: () => undefined }
        style = {}
        text = ''
        constructor(_opts?: unknown) {
            /* noop */
        }
        destroy(): void {
            /* noop */
        }
    },
}))

const { CanvasRenderer } = await import('../../../../src/ui/canvas/renderer')
type Renderer = InstanceType<typeof CanvasRenderer>

const makeChar = (id: string, pos: number) => ({
    id,
    name: id,
    pos,
    hp: 100,
    maxHp: 100,
    ap: 7,
    maxAp: 7,
    weaponId: 'peach_sword',
    spriteId: 'default',
    pose: 'idle' as const,
    waitProgress: 1,
    isActing: true,
})

interface RendererInternals {
    charSprites: Map<string, MockGraphics>
}
const internals = (r: Renderer): RendererInternals => r as unknown as RendererInternals

/** 用 charSprites 里记下的 rect 量身体内容：返回 [左缘, 右缘, 中心, 宽] */
function bodyBox(renderer: Renderer, id: string): { left: number; right: number; center: number; width: number } {
    const rects = internals(renderer).charSprites.get(id)?.rects ?? []
    expect(rects.length).toBeGreaterThan(0)
    const left = Math.min(...rects.map((r) => r[0]))
    const right = Math.max(...rects.map((r) => r[0] + r[2]))
    return { left, right, center: (left + right) / 2, width: right - left }
}

/** 渲染一帧（每次都用新 renderer，避免移动平滑插值影响落点） */
function renderPair(posA: number, posB: number): { a: ReturnType<typeof bodyBox>; b: ReturnType<typeof bodyBox>; gap: number } {
    const renderer = new CanvasRenderer()
    renderer.registerChar('A', '甲', '#cc2222')
    renderer.registerChar('B', '乙', '#2244cc')
    renderer.render({
        time: 0,
        total: 1000,
        chars: [makeChar('A', posA), makeChar('B', posB)],
        eventIndex: 0,
        phase: 'fighting',
        turn: 1,
    })
    const a = bodyBox(renderer, 'A')
    const b = bodyBox(renderer, 'B')
    return { a, b, gap: b.center - a.center }
}

const PX_PER_UNIT = (400 - 60 * 3) / 8 // 27.5

describe('战斗渲染器 · 身体间距（内容居中 + 最小间距）', () => {
    beforeEach(() => {
        created.length = 0
    })

    it('身体宽度实测 45px（15 列），两人身体中心对称落在各自画布中心', () => {
        const { a, b } = renderPair(0, 0)
        expect(a.width).toBeCloseTo(45, 6)
        expect(b.width).toBeCloseTo(45, 6)
        // 左者身体在画布中心左侧、右者在右侧（各挪 34.375px）
        expect(a.center).toBeCloseTo(200 - 34.375, 6)
        expect(b.center).toBeCloseTo(200 + 34.375, 6)
    })

    it('贴身档（距离 0 / 0.1 / 1 / 2）：身体间距 = 68.75px，空隙 23.75px（不重合）', () => {
        for (const [pa, pb] of [
            [0, 0],
            [-0.05, 0.05],
            [-0.5, 0.5],
            [-1, 1],
        ] as const) {
            const { gap } = renderPair(pa, pb)
            expect(gap).toBeCloseTo(MIN_CHAR_GAP_UNITS * PX_PER_UNIT, 6)
            expect(gap).toBeCloseTo(68.75, 6)
            expect(gap - 45).toBeGreaterThan(20) // 看得见的空隙
        }
    })

    it('距离 4 不再反叠：身体间距 = 110px（改前是 33.5px，两具身体叠在一起）', () => {
        const { gap } = renderPair(-2, 2)
        expect(gap).toBeCloseTo(110, 6)
        expect(gap - 45).toBeGreaterThan(60)
        // 改前（无内容居中）这一档的身体间距只有 |110 − 81| = 29px 左右
        expect(gap).toBeGreaterThan(29 + 45)
    })

    it('身体间距随距离单调不减（改前在距离 ~2.95 会精确重合、距离 4 又反叠）', () => {
        const gaps = [
            renderPair(0, 0).gap,
            renderPair(-0.5, 0.5).gap,
            renderPair(-1, 1).gap,
            renderPair(-1.5, 1.5).gap,
            renderPair(-2, 2).gap,
        ]
        for (let i = 1; i < gaps.length; i++) {
            expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1] - 1e-6)
        }
        expect(gaps[0]).toBeCloseTo(68.75, 6)
        expect(gaps[2]).toBeCloseTo(68.75, 6) // 距离 2 仍被 clamp
        expect(gaps[3]).toBeCloseTo(1.5 * PX_PER_UNIT * 2, 6) // 距离 3 → 82.5px
        expect(gaps[4]).toBeCloseTo(110, 6)
    })
})
