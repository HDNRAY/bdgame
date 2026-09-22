import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { PixelMap } from '../../../../../pixel-sprites'
import type { AnchorCells } from './useFrameAnchors'

export interface CanvasRendererOptions {
    canvasRef: RefObject<HTMLCanvasElement | null>
    /** 当前编辑的数据（身体帧 / 武器图） */
    active: PixelMap
    /** 颜色查询：0 = 空 */
    colorOf: (v: number) => string | undefined
    zoom: number
    showGrid: boolean
    showAnchors: boolean
    anchorMode: boolean
    anchorCells: AnchorCells
    hover: { x: number; y: number } | null
    gridW: number
    gridH: number
    backdrop: { a: string; b: string }
    lightBackdrop: boolean
}

/** 主画布绘制：底板棋盘 → 像素 → 锚点 → 网格 → hover 框 */
export function useCanvasRenderer({
    canvasRef,
    active,
    colorOf,
    zoom,
    showGrid,
    showAnchors,
    anchorMode,
    anchorCells,
    hover,
    gridW,
    gridH,
    backdrop,
    lightBackdrop,
}: CanvasRendererOptions) {
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const z = zoom
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                ctx.fillStyle = (x + y) % 2 ? backdrop.a : backdrop.b
                ctx.fillRect(x * z, y * z, z, z)
            }
        }
        for (let y = 0; y < gridH; y++) {
            for (let x = 0; x < gridW; x++) {
                const color = colorOf(active[y]?.[x] ?? 0)
                if (!color) continue
                ctx.fillStyle = color
                ctx.fillRect(x * z, y * z, z, z)
            }
        }
        if (showAnchors || anchorMode) {
            for (const c of anchorCells.cover) {
                ctx.strokeStyle = c.kind === 'main' ? 'rgba(78, 205, 196, 0.9)' : 'rgba(255, 209, 102, 0.9)'
                ctx.lineWidth = 2
                ctx.strokeRect(c.x * z + 1, c.y * z + 1, z - 2, z - 2)
            }
            for (const g of anchorCells.grip) {
                ctx.strokeStyle = g.kind === 'main' ? '#4ecdc4' : '#ffd166'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(g.x * z - 1, g.y * z + z / 2)
                ctx.lineTo(g.x * z + z + 1, g.y * z + z / 2)
                ctx.moveTo(g.x * z + z / 2, g.y * z - 1)
                ctx.lineTo(g.x * z + z / 2, g.y * z + z + 1)
                ctx.stroke()
            }
        }
        if (showGrid && z >= 6) {
            ctx.strokeStyle = lightBackdrop ? 'rgba(0, 0, 0, 0.22)' : 'rgba(160, 160, 160, 0.35)'
            ctx.lineWidth = 1
            for (let x = 0; x <= gridW; x++) {
                ctx.beginPath()
                ctx.moveTo(x * z + 0.5, 0)
                ctx.lineTo(x * z + 0.5, gridH * z)
                ctx.stroke()
            }
            for (let y = 0; y <= gridH; y++) {
                ctx.beginPath()
                ctx.moveTo(0, y * z + 0.5)
                ctx.lineTo(gridW * z, y * z + 0.5)
                ctx.stroke()
            }
        }
        if (hover) {
            ctx.strokeStyle = lightBackdrop ? '#1a1a1a' : '#ffffff'
            ctx.lineWidth = 2
            ctx.strokeRect(hover.x * z + 1, hover.y * z + 1, z - 2, z - 2)
        }
    }, [active, colorOf, zoom, showGrid, showAnchors, anchorMode, anchorCells, hover, gridW, gridH, backdrop, lightBackdrop])
}
