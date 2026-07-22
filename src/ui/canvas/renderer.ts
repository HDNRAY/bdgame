/**
 * CanvasRenderer — 基于 PixiJS 的像素战斗画面渲染器
 */

import * as PIXI from 'pixi.js'
import type { Frame, FrameChar, LogEntry } from '../../bridge/replay-engine'
import { makeCharacterSprite, getWeaponOverlay } from '../pixel-sprites'
import { FloatTextSystem } from './float-text'
import {
    PIXEL,
    GROUND_Y,
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

export class CanvasRenderer {
    readonly app: PIXI.Application
    private container: PIXI.Container
    private initialized = false
    private resizeObserver: ResizeObserver | null = null
    private charSprites: Map<string, PIXI.Graphics> = new Map()
    private weaponSprites: Map<string, PIXI.Graphics> = new Map()
    private groundGfx: PIXI.Graphics
    private charColors: Map<string, string> = new Map()
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
            background: 'transparent',
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
        const wg = new PIXI.Graphics()
        this.weaponSprites.set(charId, wg)
        this.container.addChild(wg)
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
        let maxSpriteW = 48
        for (const c of chars) {
            const color = this.charColors.get(c.id) ?? '#888'
            const sprite = makeCharacterSprite(c.spriteId, color)
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
            const facingRight = c.pos < otherPos
            const dim = charDims.get(c.id)!
            const target = this.canvasWidth / 2 + (c.pos - viewOffset) * pxPerUnit - dim.w / 2
            const cur = this.displayPos.get(c.id) ?? target
            const diff = target - cur
            const newPos = cur + Math.sign(diff) * Math.min(Math.abs(diff), MAX_MOVE_SPEED)
            this.displayPos.set(c.id, newPos)

            if (Math.abs(diff) >= MAX_MOVE_SPEED * GHOST_SPAWN_RATIO) {
                this.spawnGhost(newPos, groundY - dim.h, facingRight, c)
            }
            this.renderChar(c, pxPerUnit, viewOffset, facingRight, groundY, newPos)
        }

        // 遍历事件游标，为每个经过的事件生成浮动文字
        while (this.lastSpawnedIdx < eventIndex && this.lastSpawnedIdx + 1 < this.entries.length) {
            this.lastSpawnedIdx++
            const entry = this.entries[this.lastSpawnedIdx]
            this.floatTexts.spawn(entry.event, undefined, chars, pxPerUnit, viewOffset, groundY, charDims)
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

        const leftX = this.canvasWidth / 2 + (leftP - viewOffset) * pxPerUnit
        const rightX = this.canvasWidth / 2 + (rightP - viewOffset) * pxPerUnit
        g.moveTo(leftX, groundY).lineTo(rightX, groundY).stroke({ width: 1, color: '#333' })

        const startTick = Math.ceil(leftP)
        const endTick = Math.floor(rightP)
        for (let p = startTick; p <= endTick; p++) {
            const tx = this.canvasWidth / 2 + (p - viewOffset) * pxPerUnit
            if (tx < leftX || tx > rightX) continue
            const isMajor = p % 5 === 0
            const tickLen = isMajor ? 5 : 3
            g.moveTo(tx, groundY)
                .lineTo(tx, groundY + tickLen)
                .stroke({ width: 1, color: isMajor ? '#666' : '#444' })
        }

        const cx = this.canvasWidth / 2 + (0 - viewOffset) * pxPerUnit
        if (cx >= leftX && cx <= rightX) {
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
            if (tx < leftX || tx > rightX) continue
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
        const sprite = makeCharacterSprite(c.spriteId, color)
        const frameData = sprite.frames[c.pose] ?? sprite.frames.idle
        const g = this.charSprites.get(c.id)
        if (!g) return

        g.clear()

        const spriteW = frameData[0].length * PIXEL
        const spriteH = frameData.length * PIXEL
        const ox = displayOx ?? this.canvasWidth / 2 + (c.pos - viewOffset) * pxPerUnit - spriteW / 2
        const oy = groundY - spriteH

        for (let y = 0; y < frameData.length; y++) {
            for (let x = 0; x < frameData[y].length; x++) {
                const sx = facingRight ? x : frameData[y].length - 1 - x
                const idx = frameData[y][sx]
                const hex = idx.toString(16).toUpperCase()
                const palColor = sprite.palette[hex] ?? sprite.palette['0']
                if (!palColor || palColor === 'transparent') continue
                g.rect(ox + x * PIXEL, oy + y * PIXEL, PIXEL, PIXEL).fill(palColor)
            }
        }

        this.renderWeapon(c, ox, oy, facingRight)

        const barW = spriteW
        const waitRatio = Math.min(1, Math.max(0, c.waitProgress ?? c.ap / c.maxAp))
        // 等待条：黑色背景 + 灰色缩短条
        g.rect(ox, groundY + 2, barW, 3).fill({ color: '#000' })
        const barFill = barW * (1 - waitRatio)
        if (barFill > 0) {
            g.rect(ox, groundY + 2, barFill, 3).fill({ color: '#888' })
        }
    }

    private renderWeapon(c: FrameChar, ox: number, oy: number, facingRight: boolean): void {
        const wg = this.weaponSprites.get(c.id)
        if (!wg) return
        wg.clear()
        const overlay = getWeaponOverlay(c.weaponId)
        for (const [px, py, color] of overlay.pixels) {
            const fx = facingRight ? px : -px - 1
            wg.rect(ox + fx * PIXEL, oy + py * PIXEL, PIXEL, PIXEL).fill(color)
        }
    }

    private spawnGhost(x: number, y: number, facingRight: boolean, c: FrameChar): void {
        const color = this.charColors.get(c.id) ?? '#888'
        const sprite = makeCharacterSprite(c.spriteId, color)
        const frameData = sprite.frames[c.pose] ?? sprite.frames.idle
        const g = new PIXI.Graphics()
        for (let row = 0; row < frameData.length; row++) {
            for (let col = 0; col < frameData[row].length; col++) {
                const sx = facingRight ? col : frameData[row].length - 1 - col
                const idx = frameData[row][sx]
                const hex = idx.toString(16).toUpperCase()
                const palColor = sprite.palette[hex] ?? sprite.palette['0']
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
