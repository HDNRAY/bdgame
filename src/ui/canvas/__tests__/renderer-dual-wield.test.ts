import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 战斗渲染器的「双持」冒烟测试。
 *
 * Pixi 在 node 里跑不起来（没有 WebGL/DOM），这里用一个最小 PIXI 替身，
 * 把每个 Graphics 的绘制调用记下来 —— 于是可以断言：
 *  - 装了副手武器时，副手那组 Graphics 真的被画了（且位置和主手不同）；
 *  - 没装副手时，副手那组一个像素都不画。
 *
 * registerChar 里的创建顺序：1 角色、2 副手武器、3 主手武器、4 副手手部遮罩、5 主手手部遮罩。
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
    },
}))

const { CanvasRenderer } = await import('../../../../src/ui/canvas/renderer')
type Renderer = InstanceType<typeof CanvasRenderer>

const makeChar = (id: string, offhand?: string) => ({
    id,
    name: id,
    pos: id === 'A' ? 0 : 4,
    hp: 100,
    maxHp: 100,
    ap: 7,
    maxAp: 7,
    weaponId: 'peach_sword',
    offhand,
    spriteId: 'default',
    pose: 'idle' as const,
    waitProgress: 1,
    isActing: true,
})

function renderFrame(renderer: Renderer, chars: ReturnType<typeof makeChar>[]): void {
    renderer.render({
        time: 0,
        total: 1000,
        chars,
        eventIndex: 0,
        phase: 'fighting',
        turn: 1,
    })
}

/** 直接读渲染器的私有 Graphics 表（比按下标猜创建顺序稳） */
interface RendererInternals {
    weaponSprites: Map<string, MockGraphics>
    offhandWeaponSprites: Map<string, MockGraphics>
    handCoverSprites: Map<string, MockGraphics>
    offhandCoverSprites: Map<string, MockGraphics>
}
const internals = (r: Renderer): RendererInternals => r as unknown as RendererInternals

describe('战斗渲染器 · 双持', () => {
    beforeEach(() => {
        created.length = 0
    })

    it('装了副手武器 → 主手和副手两组 Graphics 都画了，且落点不同', () => {
        const renderer = new CanvasRenderer()
        renderer.registerChar('A', '甲', '#ffffff')
        renderFrame(renderer, [makeChar('A', 'xiu_dong'), makeChar('B')])

        const g = internals(renderer)
        const main = g.weaponSprites.get('A')!
        const offhand = g.offhandWeaponSprites.get('A')!
        expect(main.rects.length).toBeGreaterThan(0)
        expect(offhand.rects.length).toBeGreaterThan(0)
        expect(offhand.position.x).not.toBe(main.position.x)
    })

    it('没装副手 → 副手那组一个像素都不画', () => {
        const renderer = new CanvasRenderer()
        renderer.registerChar('A', '甲', '#ffffff')
        renderFrame(renderer, [makeChar('A'), makeChar('B')])

        const g = internals(renderer)
        expect(g.weaponSprites.get('A')!.rects.length).toBeGreaterThan(0)
        expect(g.offhandWeaponSprites.get('A')!.rects.length).toBe(0)
    })

    it('副手武器的手部遮罩独立绘制（主手遮主手、副手遮副手）', () => {
        const renderer = new CanvasRenderer()
        renderer.registerChar('A', '甲', '#ffffff')
        renderFrame(renderer, [makeChar('A', 'xiu_dong'), makeChar('B')])
        const g = internals(renderer)
        const mainCover = g.handCoverSprites.get('A')!
        const offCover = g.offhandCoverSprites.get('A')!
        expect(mainCover.rects.length).toBeGreaterThan(0)
        expect(offCover.rects.length).toBeGreaterThan(0)
        // 两只手的遮罩落在不同位置（一左一右）
        expect(offCover.rects[0][0]).not.toBe(mainCover.rects[0][0])
    })
})
