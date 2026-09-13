import { useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { PixelMap, Palette, WeaponOverlay } from '../../../pixel-sprites'
import {
    HAND_COVER,
    HAND_POINTS,
    LEFT_HAND_COVER,
    OTHER_HAND_POINT,
    WEAPON_WIDTH,
    WEAPON_HEIGHT,
    getDualOffhandAngle,
    getWeaponAngle,
    getWeaponHand,
    getWeaponOverlay,
    getWeaponPoseConfig,
    shouldDrawHandCover,
    resolveWeaponPixels,
} from '../../../pixel-sprites'

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
    /** 武器 ID — 合成模式按 武器+姿势 查握持配置（grip/角度/锚定手） */
    weaponId?: string
    /** 角色姿势（用于查找手部位置），默认 'idle' */
    pose?: string
    /** 旋转角度（弧度），武器绕握柄旋转后叠加 */
    angle?: number
    /** CSS 类名 — 显示尺寸由 CSS 控制 */
    className?: string
    /** 内联样式 */
    style?: CSSProperties
    /** 副手武器 ID（提供时按双持渲染：锚定副手、角度取双持规则） */
    secondWeaponId?: string
    /** 副手角度覆盖（不填用 getDualOffhandAngle） */
    secondAngle?: number
    /** 双持时主手角度覆盖（不填用 getDualMainAngle） */
    dualMainAngle?: number
}

export function PixelCanvas({
    pixels,
    palette,
    scale = 1,
    overlay,
    overlayScale: osProp,
    weaponId,
    pose = 'idle',
    angle,
    className,
    style,
    secondWeaponId,
    secondAngle,
    dualMainAngle,
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

        // 握持行为配置（合成模式按 武器+姿势 查表；图标模式无意义）
        const poseConfig = weaponId ? getWeaponPoseConfig(weaponId, pose) : undefined

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

        // 武器绘制：以锚定手为旋转中心，把整张武器图旋转后贴回（保持像素样式）
        const paintRotatedWeapon = (
            ov: WeaponOverlay,
            gripX: number,
            gripY: number,
            hand: { x: number; y: number },
            angleRad: number,
        ) => {
            const xs = ov.pixels.map((p) => p[0])
            const ys = ov.pixels.map((p) => p[1])
            const minX = Math.min(...xs)
            const maxX = Math.max(...xs)
            const minY = Math.min(...ys)
            const maxY = Math.max(...ys)
            const rotPad = Math.ceil(Math.hypot(maxX - minX, maxY - minY))
            const offscreen = document.createElement('canvas')
            offscreen.width = (maxX - minX + 1 + rotPad * 2) * os
            offscreen.height = (maxY - minY + 1 + rotPad * 2) * os
            const offCtx = offscreen.getContext('2d')!
            offCtx.imageSmoothingEnabled = false
            for (const [px, py, color] of resolveWeaponPixels(ov)) {
                offCtx.fillStyle = color
                offCtx.fillRect((px - minX + rotPad) * os, (py - minY + rotPad) * os, os, os)
            }
            const offRotX = (gripX - minX + rotPad) * os
            const offRotY = (gripY - minY + rotPad) * os
            ctx.save()
            ctx.translate((hand.x + offX) * scale, (hand.y + offY) * scale)
            if (angleRad) ctx.rotate(angleRad)
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(offscreen, -offRotX, -offRotY)
            ctx.restore()
        }

        // 渲染武器叠加层
        if (overlay && overlay.pixels.length > 0) {
            if (hasPixels) {
                // 合成模式：锚定手（单手=主手；双手武器=副手）
                const hand = weaponId ? getWeaponHand(weaponId, pose) : (HAND_POINTS[pose] ?? HAND_POINTS.idle)
                // 双手武器：握点连线自动决定角度（不被双持主手角度覆盖）
                const effAngle =
                    poseConfig?.grip2X !== undefined
                        ? getWeaponAngle(weaponId ?? '', pose, true)
                        : (dualMainAngle ??
                          (weaponId && poseConfig?.angle !== undefined
                              ? getWeaponAngle(weaponId, pose, true)
                              : (angle ?? 0)))
                paintRotatedWeapon(overlay, poseConfig?.gripX ?? 0, poseConfig?.gripY ?? 0, hand, effAngle)
            } else {
                // 武器图标模式：按完整 32×32 网格 + 原始坐标绘制，保留武器设计时的空白
                ctx.imageSmoothingEnabled = false
                for (const [px, py, color] of resolveWeaponPixels(overlay)) {
                    ctx.fillStyle = color
                    ctx.fillRect(px * os, py * os, os, os)
                }
            }
        }

        // 副手武器（双持）：锚定副手位、角度取双持规则
        const offhandOverlay = secondWeaponId ? getWeaponOverlay(secondWeaponId) : undefined
        const offhandConfig = secondWeaponId ? getWeaponPoseConfig(secondWeaponId, pose) : undefined
        if (hasPixels && offhandOverlay && offhandOverlay.pixels.length > 0) {
            const offHand = OTHER_HAND_POINT[pose] ?? OTHER_HAND_POINT.idle
            const offAngle = secondAngle ?? getDualOffhandAngle(pose, true)
            paintRotatedWeapon(offhandOverlay, offhandConfig?.gripX ?? 0, offhandConfig?.gripY ?? 0, offHand, offAngle)
        }

        // 渲染手部覆盖层 — 仅在合成武器时（有角色像素）绘制，用皮肤色盖住握柄（漂浮类武器/武器脱手时跳过）
        if (
            hasPixels &&
            overlay &&
            overlay.pixels.length > 0 &&
            !(poseConfig?.noHandCover ?? false) &&
            shouldDrawHandCover(pose)
        ) {
            const skin = palette?.['3'] ?? '#f5d6c6'
            ctx.fillStyle = skin
            const cover = HAND_COVER[pose]
            if (cover) {
                for (const [cx, cy] of cover) {
                    ctx.fillRect((cx + offX) * scale, (cy + offY) * scale, scale, scale)
                }
            }
        }
        // 第二只手：双手武器（grip2）或双持副手武器时，盖住副手握点
        const needsLeftCover =
            shouldDrawHandCover(pose) &&
            hasPixels &&
            ((poseConfig?.grip2X !== undefined && overlay && overlay.pixels.length > 0) ||
                (!!offhandOverlay && offhandOverlay.pixels.length > 0 && !(offhandConfig?.noHandCover ?? false)))
        if (needsLeftCover) {
            const skin = palette?.['3'] ?? '#f5d6c6'
            ctx.fillStyle = skin
            const leftCover = LEFT_HAND_COVER[pose] ?? LEFT_HAND_COVER.idle
            for (const [cx, cy] of leftCover) {
                ctx.fillRect((cx + offX) * scale, (cy + offY) * scale, scale, scale)
            }
        }
    }, [
        bufW,
        bufH,
        pixels,
        palette,
        scale,
        overlay,
        os,
        weaponId,
        pose,
        angle,
        offX,
        offY,
        hasPixels,
        contentW,
        secondWeaponId,
        secondAngle,
        dualMainAngle,
    ])

    return <canvas ref={ref} width={bufW} height={bufH} className={className} style={style} />
}
