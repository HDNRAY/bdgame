/**
 * CanvasRenderer — 基于 PixiJS 的像素战斗画面渲染器
 */

import * as PIXI from 'pixi.js'
import type { Frame, FrameChar } from '../replay/replay-engine'
import { makeCharacterSprite, getWeaponOverlay } from './pixel-sprites'

const PIXEL = 3 // 每个像素放大倍数
const SPRITE_SIZE = 16 // 精灵原始尺寸
const CHAR_SIZE = SPRITE_SIZE * PIXEL // 48px

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
    private actionText: PIXI.Text
    private distanceText: PIXI.Text
    private charColors: Map<string, string> = new Map()
    private charNames: Map<string, string> = new Map()
    private canvasWidth: number
    private canvasHeight: number

    constructor(opts: RendererOptions = {}) {
        this.canvasWidth = opts.width ?? 400
        this.canvasHeight = opts.height ?? 150

        this.app = new PIXI.Application()
        this.container = new PIXI.Container()
        this.actionText = new PIXI.Text({ text: '', style: { fontFamily: 'monospace', fontSize: 14, fill: '#fff' } })
        this.distanceText = new PIXI.Text({ text: '', style: { fontFamily: 'monospace', fontSize: 11, fill: '#888' } })
    }

    async init(parentEl?: HTMLElement): Promise<void> {
        if (this.initialized) return
        this.initialized = true

        await this.app.init({
            background: '#000',
            antialias: false,
            resolution: 1,
            width: this.canvasWidth,
            height: this.canvasHeight,
        })
        this.app.canvas.style.imageRendering = 'pixelated'
        this.app.canvas.style.width = '100%'
        this.app.canvas.style.height = '100%'

        this.container.addChild(this.actionText)
        this.container.addChild(this.distanceText)
        this.container.addChild(this.progressBar)
        this.app.stage.addChild(this.container)

        // 用 ResizeObserver 手动响应尺寸变化
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

    /** 注册角色（颜色区分） */
    registerChar(charId: string, name: string, accentColor: string): void {
        this.charColors.set(charId, accentColor)
        this.charNames.set(charId, name)

        const g = new PIXI.Graphics()
        this.charSprites.set(charId, g)
        this.container.addChild(g)

        const wg = new PIXI.Graphics()
        this.weaponSprites.set(charId, wg)
        this.container.addChild(wg)
    }

    /** 渲染一帧 */
    render(frame: Frame): void {
        const { chars, currentAction, time, total } = frame

        for (const c of chars) {
            this.renderChar(c)
        }

        // 居中显示动作名
        if (currentAction && frame.eventIndex > 0) {
            this.actionText.text = currentAction
            this.actionText.x = this.canvasWidth / 2 - this.actionText.width / 2
            this.actionText.y = 8
        } else {
            this.actionText.text = ''
        }

        // 距离文字
        if (chars.length >= 2) {
            const dist = Math.abs(chars[0].pos - chars[1].pos)
            this.distanceText.text = `${dist.toFixed(1)}m`
            this.distanceText.x = this.canvasWidth / 2 - this.distanceText.width / 2
            this.distanceText.y = this.canvasHeight - 22
        }

        // 进度
        const progress = total > 0 ? time / total : 0
        if (this.progressBar) {
            this.progressBar.clear()
            this.progressBar.rect(0, this.canvasHeight - 4, this.canvasWidth * progress, 4).fill('#4ecdc4')
        }
    }

    private progressBar = new PIXI.Graphics()

    private renderChar(c: FrameChar): void {
        const color = this.charColors.get(c.id) ?? '#888'
        const sprite = makeCharacterSprite(color)
        const frameData = sprite.frames[c.pose] ?? sprite.frames.idle
        const g = this.charSprites.get(c.id)
        if (!g) return

        g.clear()

        // 绘制像素小人
        const ox = this.canvasWidth / 2 + c.pos * 8 - CHAR_SIZE / 2
        const oy = this.canvasHeight / 2 - CHAR_SIZE / 2 + 8

        for (let y = 0; y < frameData.length; y++) {
            for (let x = 0; x < frameData[y].length; x++) {
                const idx = frameData[y][x]
                const hex = idx.toString(16).toUpperCase()
                const palColor = sprite.palette[hex] ?? sprite.palette['0']
                if (!palColor || palColor === 'transparent') continue
                g.rect(ox + x * PIXEL, oy + y * PIXEL, PIXEL, PIXEL).fill(palColor)
            }
        }

        // 武器叠加
        this.renderWeapon(c, ox, oy)
    }

    private renderWeapon(c: FrameChar, ox: number, oy: number): void {
        const wg = this.weaponSprites.get(c.id)
        if (!wg) return
        wg.clear()

        // 简化：根据角色名字推断武器
        // 实际应该从 Character 对象获取，后续改进
        const overlay = getWeaponOverlay('fist')
        for (const [px, py, color] of overlay.pixels) {
            wg.rect(ox + px * PIXEL, oy + py * PIXEL, PIXEL, PIXEL).fill(color)
        }
    }

    /** 清理 */
    destroy(): void {
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
        // 手动移除 canvas（PixiJS v8 destroy(true) 有时不移干净）
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
