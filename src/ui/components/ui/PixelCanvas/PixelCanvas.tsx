import { useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { PixelMap, Palette, WeaponOverlay, WeaponPoseConfig } from '../../../pixel-sprites'
import {
    handCoverTables,
    HAND_POINTS,
    WEAPON_WIDTH,
    WEAPON_HEIGHT,
    getWeaponOverlay,
    resolveWeaponMount,
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
    /** 临时覆盖握持配置（编辑器「武器挂点」实验用；不传则按 weapons.ts 的登记值） */
    poseConfig?: Partial<WeaponPoseConfig>
    /** 主武器挂在哪个槽位（决定手部覆盖画在哪只手上）：默认 'main' */
    weaponSlot?: 'main' | 'off'
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
    /** 画布列数（格）——不填则用 max(内容宽高) 的方形画布；武器/长兵器可指定更宽 */
    canvasCols?: number
    /** 画布行数（格）——不填同 canvasCols 的逻辑 */
    canvasRows?: number
    /** 内容左上角在画布中的列位置（格）——不填则水平居中；用于"左侧留更多空间" */
    contentOffsetX?: number
}

export function PixelCanvas({
    pixels,
    palette,
    scale = 1,
    overlay,
    overlayScale: osProp,
    weaponId,
    pose = 'idle',
    poseConfig: poseConfigProp,
    weaponSlot = 'main',
    angle,
    className,
    style,
    secondWeaponId,
    secondAngle,
    dualMainAngle,
    canvasCols,
    canvasRows,
    contentOffsetX,
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

    // 画布尺寸：默认方形（side = max(w, h)，内容居中）；可用 canvasCols/Rows 指定更大画布
    const side = Math.max(contentW, contentH)
    const cols = canvasCols ?? side
    const rows = canvasRows ?? side
    // 仅武器图标模式用 os 缩放；有角色像素时用 scale
    const bufW = cols * (hasPixels ? scale : os)
    const bufH = rows * (hasPixels ? scale : os)
    // 内容居中偏移（像素格）；contentOffsetX 可让左侧留更多空间
    const offX = contentOffsetX ?? Math.floor((cols - contentW) / 2)
    const offY = Math.floor((rows - contentH) / 2)

    useEffect(() => {
        const canvas = ref.current
        if (!canvas || !bufW || !bufH) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, bufW, bufH)

        // 握持行为配置（合成模式按 武器+姿势 查表；编辑器可用 poseConfig 临时覆盖）
        // 握持配置统一用 resolveWeaponMount 解析（**必须带槽位**：副手槽的基准是 OTHER_HAND_POINT，
        // 少了 slot 会按主手基准算，拖动后就"武器与握点相对位置跳"）。
        const mount = weaponId
            ? resolveWeaponMount(weaponId, pose, { slot: weaponSlot, config: poseConfigProp })
            : undefined
        const poseConfig = mount?.config

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
                const hand = mount?.hand ?? HAND_POINTS[pose] ?? HAND_POINTS.idle
                // 双手武器：握点连线自动决定角度（不被双持主手角度覆盖）
                // 角度：有武器就统一走引擎的 getWeaponAngle（显式 angle > 双手两手连线 > 单手默认 0°/攻击 -45°），
                // 这样预览与战斗渲染器完全一致；没有武器（图标模式）才用传进来的 angle。
                // 注意：之前只在配置写了显式 angle 时才调 getWeaponAngle，导致单手 attack 的 -45° 在预览里丢了。
                const effAngle = mount ? (dualMainAngle ?? mount.angle) : (angle ?? 0)
                paintRotatedWeapon(overlay, mount?.gripX ?? 0, mount?.gripY ?? 0, hand, effAngle)
            } else {
                // 武器图标模式：按完整 32×32 网格 + 原始坐标绘制，保留武器设计时的空白
                ctx.imageSmoothingEnabled = false
                for (const [px, py, color] of resolveWeaponPixels(overlay)) {
                    ctx.fillStyle = color
                    ctx.fillRect(px * os, py * os, os, os)
                }
            }
        }

        // 副手武器（双持）：统一走 resolveWeaponMount 的副手规则 ——
        // 武器登记了 off 配置就用它，否则用「副手默认」（全局副手手位 OTHER_HAND_POINT + DUAL_OFFHAND_ANGLE）
        const offhandOverlay = secondWeaponId ? getWeaponOverlay(secondWeaponId) : undefined
        if (hasPixels && offhandOverlay && offhandOverlay.pixels.length > 0 && secondWeaponId) {
            const offMount = resolveWeaponMount(secondWeaponId, pose, { slot: 'off' })
            const offAngle = secondAngle ?? offMount.angle
            paintRotatedWeapon(offhandOverlay, offMount.gripX, offMount.gripY, offMount.hand, offAngle)
        }

        // 手部遮罩：只遮「锚定的那只手」；长柄（anchorHand: 'off'，两只手都在杆上）两只都遮。
        // 双持时：主手武器遮主手、副手武器遮副手（各自的锚定手）。
        const { primary: primaryCoverTable, secondary: secondaryCoverTable } = handCoverTables(weaponSlot)
        const anchorOff = poseConfig?.anchorHand === 'off'
        const drawMainCover = hasPixels && !!overlay && overlay.pixels.length > 0 && shouldDrawHandCover(pose)
        const drawOffhandCover = !!offhandOverlay && offhandOverlay.pixels.length > 0 && shouldDrawHandCover(pose)
        if (drawMainCover || drawOffhandCover) {
            const skin = palette?.['3'] ?? '#f5d6c6'
            ctx.fillStyle = skin
            const cells = new Set<string>()
            const addCells = (table: Record<string, [number, number][]>) => {
                for (const [cx, cy] of table[pose] ?? table.idle) cells.add(`${cx},${cy}`)
            }
            if (drawMainCover) {
                addCells(anchorOff ? secondaryCoverTable : primaryCoverTable)
                if (anchorOff) addCells(primaryCoverTable)
            }
            if (drawOffhandCover) {
                addCells(anchorOff ? primaryCoverTable : secondaryCoverTable)
            }
            for (const key of cells) {
                const [cx, cy] = key.split(',').map(Number)
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
        // 挂持配置是「对象」：编辑器拖动/改数值每次都换新对象，必须进依赖，否则预览不重绘
        poseConfigProp,
        weaponSlot,
    ])

    return <canvas ref={ref} width={bufW} height={bufH} className={className} style={style} />
}
