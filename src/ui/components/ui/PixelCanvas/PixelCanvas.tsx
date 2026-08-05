import { useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { PixelMap, Palette, WeaponOverlay } from '../../../pixel-sprites'
import { HAND_POINTS, HAND_COVER, WEAPON_WIDTH, WEAPON_HEIGHT } from '../../../pixel-sprites'

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
    /** 角色姿势（用于查找手部位置），默认 'idle' */
    pose?: 'idle' | 'attack'
    /** 旋转角度（弧度），武器绕握柄旋转后叠加 */
    angle?: number
    /** CSS 类名 — 显示尺寸由 CSS 控制 */
    className?: string
    /** 内联样式 */
    style?: CSSProperties
}

export function PixelCanvas({
    pixels,
    palette,
    scale = 1,
    overlay,
    overlayScale: osProp,
    pose = 'idle',
    angle,
    className,
    style,
}: PixelCanvasProps) {
    const ref = useRef<HTMLCanvasElement>(null)

    // 叠加层放大倍数
    const os = osProp ?? (pixels ? scale : 3)

    // 是否有角色像素图（区分「武器图标居中」与「角色+武器合成」两种模式）
    const hasPixels = Boolean(pixels && pixels.length > 0)

    // 内容宽高（像素图 或 武器像素边界）
    let contentW = 0,
        contentH = 0
    if (pixels) {
        contentW = pixels[0].length
        contentH = pixels.length
    } else if (overlay && overlay.pixels.length > 0) {
        // 武器图标模式：按完整武器网格尺寸（32×32，含原始空白）
        contentW = WEAPON_WIDTH
        contentH = WEAPON_HEIGHT
    }

    // 始终方形画布：side = max(w, h)，内容居中，空白自动补齐（避免非方形被拉伸变形）
    const side = Math.max(contentW, contentH)
    // 仅武器图标模式用 os 缩放；有角色像素时用 scale
    const bufW = side * (hasPixels ? scale : os)
    const bufH = side * (hasPixels ? scale : os)
    // 内容居中偏移（像素格）
    const offX = Math.floor((side - contentW) / 2)
    const offY = Math.floor((side - contentH) / 2)

    useEffect(() => {
        const canvas = ref.current
        if (!canvas || !bufW || !bufH) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, bufW, bufH)

        // 渲染像素图（居中）
        if (pixels && palette) {
            for (let y = 0; y < pixels.length; y++) {
                for (let x = 0; x < pixels[y].length; x++) {
                    const idx = pixels[y][x]
                    const key = String(idx)
                    const color = palette[key] ?? palette['0']
                    if (!color || color === 'transparent') continue
                    ctx.fillStyle = color
                    ctx.fillRect((x + offX) * scale, (y + offY) * scale, scale, scale)
                }
            }
        }

        // 渲染武器叠加层 — 用 canvas transform 旋转整张武器图，保持像素样式
        if (overlay && overlay.pixels.length > 0) {
            // 武器像素边界
            const xs = overlay.pixels.map((p) => p[0])
            const ys = overlay.pixels.map((p) => p[1])
            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minY = Math.min(...ys)
            const maxY = Math.max(...ys)

            if (hasPixels) {
                // 合成模式：以角色手部为旋转中心，旋转整张武器图（手部坐标需叠加内容居中偏移）
                const hand = HAND_POINTS[pose] ?? HAND_POINTS.idle
                const rotPad = Math.ceil(Math.hypot(maxX - minX, maxY - minY))
                const offW = (maxX - minX + 1 + rotPad * 2) * os
                const offH = (maxY - minY + 1 + rotPad * 2) * os
                const offscreen = document.createElement('canvas')
                offscreen.width = offW
                offscreen.height = offH
                const offCtx = offscreen.getContext('2d')!
                offCtx.imageSmoothingEnabled = false
                // 武器原点 (minX,minY) 画在 (rotPad*os, rotPad*os)
                for (const [px, py, color] of overlay.pixels) {
                    offCtx.fillStyle = color
                    offCtx.fillRect((px - minX + rotPad) * os, (py - minY + rotPad) * os, os, os)
                }
                // 握柄在离屏中的位置
                const offGripX = (overlay.gripX - minX + rotPad) * os
                const offGripY = (overlay.gripY - minY + rotPad) * os

                ctx.save()
                ctx.translate((hand.x + offX) * scale, (hand.y + offY) * scale)
                if (angle) ctx.rotate(angle)
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(offscreen, -offGripX, -offGripY)
                ctx.restore()
            } else {
                // 武器图标模式：按完整 32×32 网格 + 原始坐标绘制，保留武器设计时的空白
                ctx.imageSmoothingEnabled = false
                for (const [px, py, color] of overlay.pixels) {
                    ctx.fillStyle = color
                    ctx.fillRect(px * os, py * os, os, os)
                }
            }
        }

        // 渲染手部覆盖层 — 仅在合成武器时（有角色像素）绘制，人物精灵坐标，用皮肤色盖住握柄
        if (hasPixels && overlay && overlay.pixels.length > 0) {
            const cover = HAND_COVER[pose]
            if (cover && cover.length > 0) {
                const skin = palette?.['3'] ?? '#f5d6c6'
                ctx.fillStyle = skin
                for (const [cx, cy] of cover) {
                    ctx.fillRect((cx + offX) * scale, (cy + offY) * scale, scale, scale)
                }
            }
        }
    }, [bufW, bufH, pixels, palette, scale, overlay, os, pose, angle, offX, offY, hasPixels])

    return <canvas ref={ref} width={bufW} height={bufH} className={className} style={style} />
}
