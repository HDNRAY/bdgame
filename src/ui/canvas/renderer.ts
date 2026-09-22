/**
 * CanvasRenderer — 基于 PixiJS 的像素战斗画面渲染器
 */

import * as PIXI from 'pixi.js'
import type { Frame, FrameChar, LogEntry } from '../../bridge/replay-engine'
import type { WeaponSlot } from '../pixel-sprites'
import {
    makeCharacterSprite,
    getSpriteOutlineColor,
    getWeaponOverlay,
    resolveWeaponMount,
    resolveWeaponPixels,
    shouldDrawHandCover,
    handCoverTables,
    SPRITE_WIDTH,
    SPRITE_HEIGHT,
    SPRITE_PAD_BOTTOM,
    type PixelSprite,
} from '../pixel-sprites'
import { FloatTextSystem } from './float-text'
import {
    PIXEL,
    GROUND_Y,
    GROUND_MARGIN,
    MAX_MOVE_SPEED,
    GHOST_ALPHA,
    GHOST_DECAY,
    GHOST_MIN_ALPHA,
    MAX_GHOSTS,
    GHOST_SPAWN_RATIO,
    MIN_VIEW_UNITS,
    FONT_SIZE_TICK,
} from './constants'

export interface RendererOptions {
    width?: number
    height?: number
}

/** 内息（AP）黄：与 --color-ap 同款 */
const AP_LIGHT = '#e0c040'
const AP_DARK = '#ffe66d'

export class CanvasRenderer {
    readonly app: PIXI.Application
    private container: PIXI.Container
    private initialized = false
    private resizeObserver: ResizeObserver | null = null
    private charSprites: Map<string, PIXI.Graphics> = new Map()
    private weaponSprites: Map<string, PIXI.Graphics> = new Map()
    private handCoverSprites: Map<string, PIXI.Graphics> = new Map()
    /** 副手武器（双持）：与主手各一组 Graphics，绘制顺序在主手武器之下 */
    private offhandWeaponSprites: Map<string, PIXI.Graphics> = new Map()
    private offhandCoverSprites: Map<string, PIXI.Graphics> = new Map()
    private groundGfx: PIXI.Graphics
    private charColors: Map<string, string> = new Map()
    /** 角色精灵缓存（spriteId+主色+主题描边 → 精灵），避免每帧重复生成 */
    private spriteCache: Map<string, PixelSprite> = new Map()
    private canvasWidth: number
    private canvasHeight: number
    private tickLabels: PIXI.Text[] = []

    // ── 移动平滑 + 残影 ──
    private displayPos: Map<string, number> = new Map()
    private ghosts: { g: PIXI.Graphics; alpha: number }[] = []

    // ── 浮动战斗文字 ──
    private floatTexts: FloatTextSystem
    private entries: LogEntry[] = []
    private lastSpawnedIdx = -1

    // ── 主题 ──
    private theme: 'light' | 'dark' = 'light'

    /** 设置主题（影响描边色） */
    setTheme(theme: 'light' | 'dark'): void {
        this.theme = theme
        this.spriteCache.clear() // 描边色变化 → 精灵重生成
    }

    /** 取角色精灵（缓存，避免每帧重复生成调色板/精灵对象） */
    private getSprite(charId: string, color: string): PixelSprite {
        const key = `${charId}|${color}|${this.theme}`
        let s = this.spriteCache.get(key)
        if (!s) {
            s = makeCharacterSprite(charId, color, this.outlineColor)
            this.spriteCache.set(key, s)
        }
        return s
    }

    private get outlineColor(): string {
        return getSpriteOutlineColor(this.theme)
    }

    private get apColor(): string {
        return this.theme === 'dark' ? AP_DARK : AP_LIGHT
    }

    constructor(opts: RendererOptions = {}) {
        this.canvasWidth = opts.width ?? 400
        this.canvasHeight = opts.height ?? 150

        this.app = new PIXI.Application()
        this.container = new PIXI.Container()
        this.groundGfx = new PIXI.Graphics()
        this.floatTexts = new FloatTextSystem(this.container)
    }

    async init(parentEl?: HTMLElement): Promise<void> {
        if (this.initialized) return
        this.initialized = true

        if (parentEl) {
            this.canvasWidth = parentEl.clientWidth || this.canvasWidth
            this.canvasHeight = parentEl.clientHeight || this.canvasHeight
        }

        await this.app.init({
            backgroundAlpha: 0,
            antialias: false,
            resolution: 1,
            width: this.canvasWidth,
            height: this.canvasHeight,
        })

        if (!this.initialized) return

        this.app.canvas.style.imageRendering = 'pixelated'
        this.app.canvas.style.width = '100%'
        this.app.canvas.style.height = '100%'

        this.container.addChild(this.groundGfx)
        this.app.stage.addChild(this.container)

        if (parentEl) {
            parentEl.appendChild(this.app.canvas)
            this.resizeObserver = new ResizeObserver(() => {
                const w = parentEl.clientWidth
                const h = parentEl.clientHeight
                if (w > 0 && h > 0) {
                    this.canvasWidth = w
                    this.canvasHeight = h
                    this.app.renderer.resize(w, h)
                }
            })
            this.resizeObserver.observe(parentEl)
        }
    }

    registerChar(charId: string, _name: string, accentColor: string): void {
        this.charColors.set(charId, accentColor)
        const g = new PIXI.Graphics()
        this.charSprites.set(charId, g)
        this.container.addChild(g)
        // 副手武器先入容器（先画 → 在下面），再画主手武器；手部覆盖层最后（最上面）
        const owg = new PIXI.Graphics()
        this.offhandWeaponSprites.set(charId, owg)
        this.container.addChild(owg)
        const wg = new PIXI.Graphics()
        this.weaponSprites.set(charId, wg)
        this.container.addChild(wg)
        // 手部覆盖层 Graphics：在武器之上绘制（人物坐标），制造"握着"效果
        const ocg = new PIXI.Graphics()
        this.offhandCoverSprites.set(charId, ocg)
        this.container.addChild(ocg)
        const cg = new PIXI.Graphics()
        this.handCoverSprites.set(charId, cg)
        this.container.addChild(cg)
    }

    /** 传入全部事件列表（用于遍历所有事件生成浮动文字，不只 currentEvent） */
    setEntries(entries: LogEntry[]): void {
        this.entries = entries
        this.lastSpawnedIdx = -1
    }

    /** 渲染一帧 */
    render(frame: Frame): void {
        const { chars, eventIndex } = frame
        const groundY = GROUND_Y(this.canvasHeight)

        // 根据当前帧精灵数据计算实际尺寸
        const charDims = new Map<string, { w: number; h: number }>()
        let maxSpriteW = SPRITE_WIDTH * PIXEL
        for (const c of chars) {
            const color = this.charColors.get(c.id) ?? '#888'
            const sprite = this.getSprite(c.spriteId, color)
            const frameData = sprite.frames[c.pose] ?? sprite.frames.idle
            const w = (frameData[0]?.length ?? 16) * PIXEL
            const h = frameData.length * PIXEL
            charDims.set(c.id, { w, h })
            if (w > maxSpriteW) maxSpriteW = w
        }

        let pxPerUnit = 8
        let viewOffset = 0
        if (chars.length >= 2) {
            const minP = Math.min(chars[0].pos, chars[1].pos)
            const maxP = Math.max(chars[0].pos, chars[1].pos)
            const range = maxP - minP
            const viewUnits = Math.max(MIN_VIEW_UNITS, range + 2)
            const midP = (minP + maxP) / 2
            pxPerUnit = (this.canvasWidth - maxSpriteW) / viewUnits
            viewOffset = midP
        }

        this.renderGround(chars, pxPerUnit, viewOffset, groundY)
        this.updateGhosts()

        for (const c of chars) {
            const otherPos = chars.find((o) => o.id !== c.id)?.pos ?? 0
            // 新精灵默认朝左，与旧精灵（默认朝右）相反 → facing 判断取反
            const facingRight = c.pos > otherPos
            const dim = charDims.get(c.id)!
            const target = this.canvasWidth / 2 + (c.pos - viewOffset) * pxPerUnit - dim.w / 2
            const cur = this.displayPos.get(c.id) ?? target
            const diff = target - cur
            const newPos = cur + Math.sign(diff) * Math.min(Math.abs(diff), MAX_MOVE_SPEED)
            this.displayPos.set(c.id, newPos)

            if (Math.abs(diff) >= MAX_MOVE_SPEED * GHOST_SPAWN_RATIO) {
                this.spawnGhost(newPos, groundY - dim.h + SPRITE_PAD_BOTTOM * PIXEL - GROUND_MARGIN, facingRight, c)
            }
            this.renderChar(c, pxPerUnit, viewOffset, facingRight, groundY, newPos)
        }

        // 遍历事件游标，为每个经过的事件生成浮动文字
        while (this.lastSpawnedIdx < eventIndex && this.lastSpawnedIdx + 1 < this.entries.length) {
            this.lastSpawnedIdx++
            const entry = this.entries[this.lastSpawnedIdx]
            const evt = entry.event
            // 闪避时不显示「未命中」：check_hit 未命中后紧跟同目标 dodge → 跳过（dodge 会 spawn 闪避）
            const nextEvt = this.entries[this.lastSpawnedIdx + 1]?.event
            const willDodge =
                evt.type === 'check_hit' && !evt.result && nextEvt?.type === 'dodge' && evt.target === nextEvt.evader
            if (willDodge) continue
            const actionName = entry.event.type === 'attack_start' ? entry.event.actionName : undefined
            this.floatTexts.spawn(entry.event, actionName, chars, pxPerUnit, viewOffset, groundY, charDims)
        }
        this.floatTexts.update()

        if (frame.time > 0 || frame.eventIndex > 0) {
            this.floatTexts.markPlayed()
        }
    }

    private renderGround(chars: FrameChar[], pxPerUnit: number, viewOffset: number, groundY: number): void {
        const g = this.groundGfx
        g.clear()

        if (chars.length < 2) return

        const minP = Math.min(chars[0].pos, chars[1].pos)
        const maxP = Math.max(chars[0].pos, chars[1].pos)
        const viewUnits = Math.max(MIN_VIEW_UNITS, maxP - minP + 2)
        const leftP = viewOffset - viewUnits / 2
        const rightP = viewOffset + viewUnits / 2

        // 地面线铺满整个画布
        g.moveTo(0, groundY).lineTo(this.canvasWidth, groundY).stroke({ width: 1, color: '#333' })

        const startTick = Math.ceil(leftP)
        const endTick = Math.floor(rightP)
        for (let p = startTick; p <= endTick; p++) {
            const tx = this.canvasWidth / 2 + (p - viewOffset) * pxPerUnit
            if (tx < 0 || tx > this.canvasWidth) continue
            const isMajor = p % 5 === 0
            const tickLen = isMajor ? 5 : 3
            g.moveTo(tx, groundY)
                .lineTo(tx, groundY + tickLen)
                .stroke({ width: 1, color: isMajor ? '#666' : '#444' })
        }

        const cx = this.canvasWidth / 2 + (0 - viewOffset) * pxPerUnit
        if (cx >= 0 && cx <= this.canvasWidth) {
            g.moveTo(cx, groundY)
                .lineTo(cx, groundY + 8)
                .stroke({ width: 1, color: '#666' })
        }

        for (const t of this.tickLabels) {
            this.container.removeChild(t)
            t.destroy()
        }
        this.tickLabels = []

        for (let p = startTick; p <= endTick; p++) {
            if (p % 5 !== 0) continue
            const tx = this.canvasWidth / 2 + (p - viewOffset) * pxPerUnit
            if (tx < 0 || tx > this.canvasWidth) continue
            const label = new PIXI.Text({
                text: `${p}`,
                style: { fontFamily: 'monospace', fontSize: FONT_SIZE_TICK, fill: '#555' },
            })
            label.anchor.set(0.5, 0)
            label.x = tx
            label.y = groundY + 10
            this.container.addChild(label)
            this.tickLabels.push(label)
        }
    }

    private renderChar(
        c: FrameChar,
        pxPerUnit: number,
        viewOffset: number,
        facingRight: boolean,
        groundY: number,
        displayOx?: number,
    ): void {
        const color = this.charColors.get(c.id) ?? '#888'
        const sprite = this.getSprite(c.spriteId, color)
        const frameData = sprite.frames[c.pose] ?? sprite.frames.idle
        const g = this.charSprites.get(c.id)
        if (!g) return

        g.clear()

        const spriteW = frameData[0].length * PIXEL
        const spriteH = frameData.length * PIXEL
        const ox = displayOx ?? this.canvasWidth / 2 + (c.pos - viewOffset) * pxPerUnit - spriteW / 2
        // 画布底含 SPRITE_PAD_BOTTOM 行空白 → 内容脚底对齐地面（而非画布底），再留 GROUND_MARGIN 间距
        const oy = groundY - spriteH + SPRITE_PAD_BOTTOM * PIXEL - GROUND_MARGIN

        let contentMinX = Number.POSITIVE_INFINITY
        let contentMaxX = -1
        for (let y = 0; y < frameData.length; y++) {
            for (let x = 0; x < frameData[y].length; x++) {
                const sx = facingRight ? x : frameData[y].length - 1 - x
                const idx = frameData[y][sx]
                const key = String(idx)
                const palColor = sprite.palette[key] ?? sprite.palette['0']
                if (!palColor || palColor === 'transparent') continue
                if (x < contentMinX) contentMinX = x
                if (x > contentMaxX) contentMaxX = x
                g.rect(ox + x * PIXEL, oy + y * PIXEL, PIXEL, PIXEL).fill(palColor)
            }
        }

        this.renderWeapon(c, ox, oy, facingRight)
        this.renderHandCover(c, ox, oy, facingRight, sprite.palette)
        // 双持：副手武器（build.offhand 固定；没装就没有）
        this.renderWeapon(c, ox, oy, facingRight, 'off')
        this.renderHandCover(c, ox, oy, facingRight, sprite.palette, 'off')

        // 等待条：竖直「蜡烛」（内息黄，随 AP 回复从顶部一点点烧矮），立在人物背后侧，避免与对手重叠
        const CANDLE_W = 3
        // 最高高度：双方统一（按标准画布内容高，剔除底部 SPRITE_PAD_BOTTOM 空白行），保证两蜡烛最高高度一致
        const CANDLE_H = Math.max(1, (SPRITE_HEIGHT - SPRITE_PAD_BOTTOM) * PIXEL)
        const waitRatio = Math.min(1, Math.max(0, c.waitProgress ?? c.ap / c.maxAp))
        const burn = 1 - waitRatio // 1=刚行动(蜡满) → 0=即将行动(烧尽)
        // 亚像素高度（不做整像素取整）：燃烧/回复平滑细腻，避免步进感
        const fillH = CANDLE_H * burn
        const baseY = groundY - GROUND_MARGIN // 蜡烛底座（与人物脚底同水平）
        // 背后侧：按角色内容实际左右边界贴放（内容整体左移后不再用固定画布宽）
        const hasContent = contentMaxX >= 0
        const rightEdge = hasContent ? ox + (contentMaxX + 1) * PIXEL : ox + spriteW
        const leftEdge = hasContent ? ox + contentMinX * PIXEL : ox
        const candleX = facingRight ? rightEdge + 2 : leftEdge - 2 - CANDLE_W
        if (fillH > 0.5) {
            // 蜡体：底部固定，从顶部向下变矮（像蜡烛燃烧），颜色 = 内息黄
            g.rect(candleX, baseY - fillH, CANDLE_W, fillH).fill({ color: this.apColor })
        }
    }

    /**
     * 画一把武器。slot='off' 时画副手那把（双持）——位置/角度走 resolveWeaponMount 的副手规则：
     * 武器自己登记了 off 配置就用它，否则用「副手默认」（全局副手手位 + 副手角度）。
     */
    private renderWeapon(c: FrameChar, ox: number, oy: number, facingRight: boolean, slot: WeaponSlot = 'main'): void {
        const wg = slot === 'off' ? this.offhandWeaponSprites.get(c.id) : this.weaponSprites.get(c.id)
        if (!wg) return
        wg.clear()
        const weaponId = slot === 'off' ? c.offhand : c.weaponId
        if (!weaponId) return
        const overlay = getWeaponOverlay(weaponId)
        if (overlay.pixels.length === 0) return

        const mount = resolveWeaponMount(weaponId, c.pose, { slot, facingRight })

        // 武器 Graphics：position = 锚定手，本地坐标相对主握点（px-gripX, py-gripY），
        // pivot 保持 (0,0) 使旋转绕锚定手进行（避免双重偏移把武器抬离手部）。
        // 旋转角度：单手武器 idle=0 / attack=±45°；双手武器绕副手旋转使棍身轴线穿过主手。
        const handX = facingRight ? mount.hand.x : SPRITE_WIDTH - 1 - mount.hand.x
        wg.position.set(ox + handX * PIXEL, oy + mount.hand.y * PIXEL)
        wg.pivot.set(0, 0)
        wg.rotation = mount.angle

        for (const [px, py, color] of resolveWeaponPixels(overlay)) {
            const fx = facingRight ? px - mount.gripX : -(px - mount.gripX)
            wg.rect(fx * PIXEL, (py - mount.gripY) * PIXEL, PIXEL, PIXEL).fill(color)
        }
    }

    /** 手部覆盖层：在武器之上绘制皮肤色像素（人物坐标，不随武器旋转），制造"握着"效果 */
    private renderHandCover(
        c: FrameChar,
        ox: number,
        oy: number,
        facingRight: boolean,
        palette: Record<string, string>,
        slot: WeaponSlot = 'main',
    ): void {
        const cg = slot === 'off' ? this.offhandCoverSprites.get(c.id) : this.handCoverSprites.get(c.id)
        if (!cg) return
        cg.clear()
        const weaponId = slot === 'off' ? c.offhand : c.weaponId
        if (!weaponId) return
        // 命中（hit）：武器被打飞脱手 → 不画握持手
        if (!shouldDrawHandCover(c.pose)) return
        // 握持行为按武器+姿势查配置：漂浮类武器（如三相珠）无握柄手部覆盖
        const mount = resolveWeaponMount(weaponId, c.pose, { slot, facingRight })
        if (mount.noHandCover) return
        // 哪个槽位盖哪只手：统一走 handCoverTables（副手槽盖副手）
        const { primary: primaryTable, secondary: secondaryTable } = handCoverTables(slot)
        const primary = primaryTable[c.pose] ?? primaryTable.idle
        const skin = palette['3'] ?? '#f5d6c6'
        const paint = (cx: number, cy: number) => {
            // 覆盖层跟随角色精灵镜像（与角色渲染一致：sx = facingRight ? x : width-1-x）
            const fx = facingRight ? cx : SPRITE_WIDTH - 1 - cx
            cg.rect(ox + fx * PIXEL, oy + cy * PIXEL, PIXEL, PIXEL).fill(skin)
        }
        for (const [cx, cy] of primary) paint(cx, cy)
        // 双手长兵（锚副手）：另一只手也在杆上 → 额外盖住另一只手
        if (mount.config.anchorHand === 'off') {
            const secondary = secondaryTable[c.pose] ?? secondaryTable.idle
            for (const [cx, cy] of secondary) paint(cx, cy)
        }
    }

    private spawnGhost(x: number, y: number, facingRight: boolean, c: FrameChar): void {
        const color = this.charColors.get(c.id) ?? '#888'
        const sprite = this.getSprite(c.spriteId, color)
        const frameData = sprite.frames[c.pose] ?? sprite.frames.idle
        const g = new PIXI.Graphics()
        for (let row = 0; row < frameData.length; row++) {
            for (let col = 0; col < frameData[row].length; col++) {
                const sx = facingRight ? col : frameData[row].length - 1 - col
                const idx = frameData[row][sx]
                const key = String(idx)
                const palColor = sprite.palette[key] ?? sprite.palette['0']
                if (!palColor || palColor === 'transparent') continue
                g.rect(x + col * PIXEL, y + row * PIXEL, PIXEL, PIXEL).fill(palColor)
            }
        }
        g.alpha = GHOST_ALPHA
        this.container.addChild(g)
        this.ghosts.push({ g, alpha: GHOST_ALPHA })
    }

    private updateGhosts(): void {
        for (let i = this.ghosts.length - 1; i >= 0; i--) {
            const ghost = this.ghosts[i]
            ghost.alpha *= GHOST_DECAY
            ghost.g.alpha = ghost.alpha
            if (ghost.alpha < GHOST_MIN_ALPHA) {
                this.container.removeChild(ghost.g)
                ghost.g.destroy()
                this.ghosts.splice(i, 1)
            }
        }
        while (this.ghosts.length > MAX_GHOSTS) {
            const g = this.ghosts.shift()!
            this.container.removeChild(g.g)
            g.g.destroy()
        }
    }

    destroy(): void {
        this.floatTexts.destroy()
        for (const ghost of this.ghosts) {
            this.container.removeChild(ghost.g)
            ghost.g.destroy()
        }
        this.ghosts = []
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
        try {
            if (this.app.canvas?.parentElement) {
                this.app.canvas.parentElement.removeChild(this.app.canvas)
            }
        } catch {
            /* ignore */
        }
        try {
            this.app.destroy(true)
        } catch {
            /* ignore */
        }
        this.initialized = false
    }
}
