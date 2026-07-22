import { useRef, useEffect } from 'react'
import type { PixelMap, Palette, WeaponOverlay } from '../../../pixel-sprites'
import { HAND_POINTS } from '../../../pixel-sprites'

interface PixelCanvasProps {
    /** PixelMap 数据 — canvas buffer 尺寸自动按 pixels×scale 推导 */
    pixels?: PixelMap
    /** 调色板 */
    palette?: Palette
    /** 像素放大倍数（默认 1），头像裁切 8×8 用 scale={4} */
    scale?: number
    /** 武器叠加层 — 与 pixels 同时提供时以握柄对齐手部，单独提供时居中显示 */
    overlay?: WeaponOverlay
    /** 叠加层放大倍数（默认与 scale 相同，无 pixels 时默认 3） */
    overlayScale?: number
    /** 角色体型 ID（用于查找手部位置），默认 'default' */
    bodyType?: string
    /** 旋转角度（弧度），武器绕握柄旋转后叠加 */
    angle?: number
    /** CSS 类名 — 显示尺寸由 CSS 控制 */
    className?: string
}

export function PixelCanvas({
    pixels,
    palette,
    scale = 1,
    overlay,
    overlayScale: osProp,
    bodyType = 'default',
    angle,
    className,
}: PixelCanvasProps) {
    const ref = useRef<HTMLCanvasElement>(null)

    // 叠加层放大倍数
    const os = osProp ?? (pixels ? scale : 3)

    // 推导 canvas buffer 尺寸
    let bufW = 0,
        bufH = 0
    if (pixels) {
        bufW = pixels[0].length * scale
        bufH = pixels.length * scale
    } else if (overlay && overlay.pixels.length > 0) {
        const xs = overlay.pixels.map((p) => p[0])
        const ys = overlay.pixels.map((p) => p[1])
        bufW = (Math.max(...xs) - Math.min(...xs) + 1) * os
        bufH = (Math.max(...ys) - Math.min(...ys) + 1) * os
    }

    useEffect(() => {
        const canvas = ref.current
        if (!canvas || !bufW || !bufH) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, bufW, bufH)

        // 渲染像素图
        if (pixels && palette) {
            for (let y = 0; y < pixels.length; y++) {
                for (let x = 0; x < pixels[y].length; x++) {
                    const idx = pixels[y][x].toString(16).toUpperCase()
                    const color = palette[idx] ?? palette['0']
                    if (!color || color === 'transparent') continue
                    ctx.fillStyle = color
                    ctx.fillRect(x * scale, y * scale, scale, scale)
                }
            }
        }

        // 渲染武器叠加层
        if (overlay && overlay.pixels.length > 0) {
            const hand = HAND_POINTS[bodyType] ?? HAND_POINTS.default
            const dx = hand.x * scale - overlay.gripX * os
            const dy = hand.y * scale - overlay.gripY * os

            if (angle) {
                // 旋转模式：用离屏 canvas 绕握柄旋转
                const offscreen = document.createElement('canvas')
                offscreen.width = bufW
                offscreen.height = bufH
                const offCtx = offscreen.getContext('2d')!
                const cx = overlay.gripX * os
                const cy = overlay.gripY * os
                for (const [px, py, color] of overlay.pixels) {
                    const rx = cx + (px * os - cx) * Math.cos(angle) - (py * os - cy) * Math.sin(angle)
                    const ry = cy + (px * os - cx) * Math.sin(angle) + (py * os - cy) * Math.cos(angle)
                    offCtx.fillStyle = color
                    offCtx.fillRect(Math.round(rx), Math.round(ry), os, os)
                }
                ctx.drawImage(offscreen, dx - overlay.gripX * os, dy - overlay.gripY * os)
            } else {
                for (const [px, py, color] of overlay.pixels) {
                    ctx.fillStyle = color
                    ctx.fillRect(px * os + dx, py * os + dy, os, os)
                }
            }
        }
    }, [bufW, bufH, pixels, palette, scale, overlay, os, bodyType, angle])

    return <canvas ref={ref} width={bufW} height={bufH} className={className} />
}
