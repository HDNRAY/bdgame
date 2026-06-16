/**
 * CanvasRenderer — 基于 PixiJS 的像素战斗画面渲染器
 */

import * as PIXI from 'pixi.js'
import type { Frame, FrameChar } from '../replay/replay-engine'
import type { BattleEvent } from '../engine/combat/types'
import { makeCharacterSprite, getWeaponOverlay } from './pixel-sprites'

const PIXEL = 3 // 每个像素放大倍数
const SPRITE_SIZE = 16 // 精灵原始尺寸
const CHAR_SIZE = SPRITE_SIZE * PIXEL // 48px
/** 角色脚底到画布底的偏移，让角色更靠下利用空间 */
const VERT_OFFSET = 24

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

    // ── 浮动战斗文字 ──
    private floatTexts: { obj: PIXI.Text; life: number; maxLife: number }[] = []
    private lastEventIndex = -1
    private hasPlayed = false

    constructor(opts: RendererOptions = {}) {
        this.canvasWidth = opts.width ?? 400
        this.canvasHeight = opts.height ?? 150

        this.app = new PIXI.Application()
        this.container = new PIXI.Container()
        this.groundGfx = new PIXI.Graphics()
    }

    async init(parentEl?: HTMLElement): Promise<void> {
        if (this.initialized) return
        this.initialized = true

        // 用父容器的实际尺寸，避免 CSS 拉伸后 ResizeObserver 导致坐标偏移
        if (parentEl) {
            this.canvasWidth = parentEl.clientWidth || this.canvasWidth
            this.canvasHeight = parentEl.clientHeight || this.canvasHeight
        }

        await this.app.init({
            background: '#000',
            antialias: false,
            resolution: 1,
            width: this.canvasWidth,
            height: this.canvasHeight,
        })

        // 守卫：如果在 await 期间被 destroy() 调用，放弃后续操作
        if (!this.initialized) return

        this.app.canvas.style.imageRendering = 'pixelated'
        this.app.canvas.style.width = '100%'
        this.app.canvas.style.height = '100%'

        this.container.addChild(this.groundGfx)
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
    registerChar(charId: string, _name: string, accentColor: string): void {
        this.charColors.set(charId, accentColor)

        const g = new PIXI.Graphics()
        this.charSprites.set(charId, g)
        this.container.addChild(g)

        const wg = new PIXI.Graphics()
        this.weaponSprites.set(charId, wg)
        this.container.addChild(wg)
    }

    /** 渲染一帧 */
    render(frame: Frame): void {
        const { chars, currentAction, currentEvent, eventIndex } = frame

        // 动态视口：至少显示 8 单位宽度，超过时两边各留 1m 边距
        let pxPerUnit = 8
        let viewOffset = 0
        if (chars.length >= 2) {
            const minP = Math.min(chars[0].pos, chars[1].pos)
            const maxP = Math.max(chars[0].pos, chars[1].pos)
            const range = maxP - minP
            const viewUnits = Math.max(8, range + 2)
            const midP = (minP + maxP) / 2
            pxPerUnit = (this.canvasWidth - CHAR_SIZE) / viewUnits
            viewOffset = midP
        }

        // 地面参考线 + 刻度
        this.renderGround(chars, pxPerUnit, viewOffset)

        for (const c of chars) {
            const otherPos = chars.find((o) => o.id !== c.id)?.pos ?? 0
            const facingRight = c.pos < otherPos
            this.renderChar(c, pxPerUnit, viewOffset, facingRight)
        }

        // 新事件 → 生成浮动文字（跳过首次渲染）
        if (currentEvent && this.hasPlayed && eventIndex !== this.lastEventIndex) {
            this.lastEventIndex = eventIndex
            this.spawnFloatText(currentEvent, currentAction, chars, pxPerUnit, viewOffset)
        }

        // 更新浮动文字（上浮 + 淡出）
        this.updateFloatTexts()

        // 标记已经开始播放（非首次渲染）
        if (frame.time > 0 || frame.eventIndex > 0) {
            this.hasPlayed = true
        }
    }

    /** 地面参考线 + 刻度标记 */
    private renderGround(chars: FrameChar[], pxPerUnit: number, viewOffset: number): void {
        const g = this.groundGfx
        g.clear()

        if (chars.length < 2) return

        const groundY = this.canvasHeight - VERT_OFFSET
        const minP = Math.min(chars[0].pos, chars[1].pos)
        const maxP = Math.max(chars[0].pos, chars[1].pos)
        const viewUnits = Math.max(8, maxP - minP + 2)
        const leftP = viewOffset - viewUnits / 2
        const rightP = viewOffset + viewUnits / 2

        // 地面线
        const leftX = this.canvasWidth / 2 + (leftP - viewOffset) * pxPerUnit
        const rightX = this.canvasWidth / 2 + (rightP - viewOffset) * pxPerUnit
        g.moveTo(leftX, groundY).lineTo(rightX, groundY).stroke({ width: 1, color: '#333' })

        // 刻度标记（每 1 单位，5 的倍数加长）
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

        // 中线（0 位置）
        const cx = this.canvasWidth / 2 + (0 - viewOffset) * pxPerUnit
        if (cx >= leftX && cx <= rightX) {
            g.moveTo(cx, groundY)
                .lineTo(cx, groundY + 8)
                .stroke({ width: 1, color: '#666' })
        }

        // 清除上一帧的刻度值
        for (const t of this.tickLabels) {
            this.container.removeChild(t)
            t.destroy()
        }
        this.tickLabels = []

        // 刻度值（5 的倍数显示位置数字）
        for (let p = startTick; p <= endTick; p++) {
            if (p % 5 !== 0) continue
            const tx = this.canvasWidth / 2 + (p - viewOffset) * pxPerUnit
            if (tx < leftX || tx > rightX) continue
            const label = new PIXI.Text({
                text: `${p}`,
                style: { fontFamily: 'monospace', fontSize: 9, fill: '#555' },
            })
            label.anchor.set(0.5, 0)
            label.x = tx
            label.y = groundY + 10
            this.container.addChild(label)
            this.tickLabels.push(label)
        }
    }

    private tickLabels: PIXI.Text[] = []

    private renderChar(c: FrameChar, pxPerUnit: number, viewOffset: number, facingRight: boolean): void {
        const color = this.charColors.get(c.id) ?? '#888'
        const sprite = makeCharacterSprite(c.spriteId, color)
        const frameData = sprite.frames[c.pose] ?? sprite.frames.idle
        const g = this.charSprites.get(c.id)
        if (!g) return

        g.clear()

        // 绘制像素小人（脚底对齐地面线）
        const groundY = this.canvasHeight - VERT_OFFSET
        const ox = this.canvasWidth / 2 + (c.pos - viewOffset) * pxPerUnit - CHAR_SIZE / 2
        const oy = groundY - CHAR_SIZE

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

        // 武器叠加（同样翻转 x 方向）
        this.renderWeapon(c, ox, oy, facingRight)

        // HP 条（角色脚底）
        const barW = CHAR_SIZE
        const barH = 3
        const ratio = c.maxHp > 0 ? Math.min(1, c.hp / c.maxHp) : 0
        g.rect(ox, groundY + 2, barW, barH).fill({ color: '#333' })
        if (ratio > 0) {
            g.rect(ox, groundY + 2, barW * ratio, barH).fill({ color: '#cccccc' })
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

    // ── 浮动战斗文字 ──

    /** 根据事件类型生成浮动文字 */
    private spawnFloatText(
        event: BattleEvent,
        actionName: string | undefined,
        chars: FrameChar[],
        pxPerUnit: number,
        viewOffset: number,
    ): void {
        const data = this.getFloatData(event, actionName)
        if (!data) return

        // 定位到事件相关的角色
        const char = chars.find((c) => c.id === data.charId) ?? chars[0]
        const isSelf = data.kind === 'action'
        const groundY = this.canvasHeight - VERT_OFFSET

        // 招式名 → 画面中央偏上；效果 → 角色前方的中间区域
        let ox: number
        let oy: number
        if (isSelf) {
            ox = this.canvasWidth / 2
            oy = 14
        } else {
            // 效果文字在角色前方的中间区域
            const charCenterX = this.canvasWidth / 2 + (char.pos - viewOffset) * pxPerUnit
            const mid = this.canvasWidth / 2
            ox = charCenterX + (charCenterX < mid ? 30 : -30)
            oy = groundY - CHAR_SIZE - 20
        }

        // 同类文字堆叠
        const sameType = this.floatTexts.filter((t) => t.obj.text === data.text)
        oy -= sameType.length * 14

        const obj = new PIXI.Text({
            text: data.text,
            style: { fontFamily: 'monospace', fontSize: 12, fill: data.color, fontWeight: 'bold' },
        })
        obj.anchor.set(0.5, 0.5)
        obj.x = ox
        obj.y = oy
        this.container.addChild(obj)

        this.floatTexts.push({ obj, life: 1500, maxLife: 1500 })
    }

    /** 从 "[buff名] 「角色名」 获得状态 — 描述" 中提取 buff 名 */
    private parseBuffName(msg: string): string {
        const m = msg.match(/^\[(.+?)\]/)
        return m ? m[1] : msg
    }

    private getFloatData(
        event: BattleEvent,
        actionName: string | undefined,
    ): { text: string; color: string; charId: string; kind: 'action' | 'effect' } | null {
        switch (event.type) {
            case 'attack_start':
                return { text: actionName ?? '攻击', color: '#ffffff', charId: event.actor, kind: 'action' }

            case 'damage':
                return {
                    text: event.isCrit ? `暴击 ${event.final}` : `${event.final}`,
                    color: event.isCrit ? '#ffd700' : '#ff4444',
                    charId: event.target,
                    kind: 'effect',
                }

            case 'dodge':
                return { text: '闪避', color: '#ffffff', charId: event.evader, kind: 'effect' }

            case 'parry':
                return { text: '招架', color: '#ffffff', charId: event.parrier, kind: 'effect' }

            case 'check_hit':
                return event.result ? null : { text: '未命中', color: '#888', charId: event.target, kind: 'effect' }

            case 'defeat':
                return { text: '败北', color: '#ff4444', charId: event.loser, kind: 'effect' }

            case 'system':
                return event.message
                    ? {
                          text: this.parseBuffName(event.message),
                          color: '#4ecdc4',
                          charId: event.actor ?? '',
                          kind: 'effect',
                      }
                    : null

            case 'battle_start':
                return { text: '战斗开始', color: '#4ecdc4', charId: event.actor, kind: 'action' }

            default:
                return null
        }
    }

    /** 更新浮动文字（上浮 + 淡出） */
    private updateFloatTexts(): void {
        const dt = 16 // 约每帧 16ms
        for (let i = this.floatTexts.length - 1; i >= 0; i--) {
            const ft = this.floatTexts[i]
            ft.life -= dt
            ft.obj.y -= 0.5
            ft.obj.alpha = Math.max(0, ft.life / ft.maxLife)
            if (ft.life <= 0) {
                this.container.removeChild(ft.obj)
                ft.obj.destroy()
                this.floatTexts.splice(i, 1)
            }
        }
    }

    /** 清理 */
    destroy(): void {
        // 清除浮动文字
        for (const ft of this.floatTexts) {
            this.container.removeChild(ft.obj)
            ft.obj.destroy()
        }
        this.floatTexts = []
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
