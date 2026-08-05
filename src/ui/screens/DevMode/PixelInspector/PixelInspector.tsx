import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    getCharacterAvatar,
    makeCharacterSprite,
    WEAPON_OVERLAYS,
    WEAPON_WIDTH,
    WEAPON_HEIGHT,
    resolveWeaponPixels,
} from '../../../pixel-sprites'
import { CHARACTER_COLORS, CHARACTER_SPRITE_MAP } from '../../../pixel-sprites/palette'
import { OPPONENTS } from '../../../../data/opponents'
import { WEAPON_DB } from '../../../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../../../data/weapons/starting-weapons'
import { PixelCanvas } from '../../../components/ui/PixelCanvas/PixelCanvas'
import './PixelInspector.scss'

/** 像素放大倍数：角色精灵 → 384×384 */
const SCALE = 8
/** 头像放大倍数 */
const AVATAR_SCALE = 4
/** 武器单图放大倍数：32×32 → 192×192 */
const WEAPON_SCALE = 6

/** 角色 ID 列表（有配色 + 体型映射的），中文名取自 OpponentDef.name */
const CHARACTER_IDS = Object.keys(CHARACTER_COLORS).filter((id) => CHARACTER_SPRITE_MAP[id])

/** 角色 ID → 中文名（来自 data/opponents 的 name 字段） */
const NAME_BY_ID: Record<string, string> = Object.fromEntries(OPPONENTS.map((o) => [o.id, o.name]))

/** 武器 ID 列表 */
const WEAPON_IDS = Object.keys(WEAPON_OVERLAYS)

/** 武器 ID → 中文名（来自 data/weapons，找不到则回退为 id 本身） */
const WEAPON_NAME: Record<string, string> = Object.fromEntries(
    [...WEAPON_DB, ...STARTING_WEAPONS].map((w) => [w.id, w.name]),
)

interface PixelInfo {
    x: number
    y: number
    idx: number
    color: string
    /** 该颜色在整个精灵中的使用次数 */
    count: number
    /** 该颜色占比（0~1） */
    ratio: number
}

export function PixelInspector() {
    const [searchParams, setSearchParams] = useSearchParams()
    // 角色 / 武器 状态存于 URL query（刷新/分享不丢失）
    const charParam = searchParams.get('char')
    const charId = CHARACTER_IDS.includes(charParam ?? '') ? (charParam as string) : 'yidao'
    const weaponParam = searchParams.get('weapon')
    const weaponId = WEAPON_IDS.includes(weaponParam ?? '') ? (weaponParam as string) : 'peach_sword'

    // 更新 URL（仅替换对应 key，保留其它参数如 tab）
    const patchQuery = (patch: Record<string, string>) => {
        const next = new URLSearchParams(searchParams)
        for (const [k, v] of Object.entries(patch)) next.set(k, v)
        setSearchParams(next, { replace: true })
    }

    const setCharId = (id: string) => patchQuery({ char: id })
    const setWeaponId = (id: string) => patchQuery({ weapon: id })

    const sprite = useMemo(() => makeCharacterSprite(charId, '#4ecdc4'), [charId])
    const idlePixels = sprite.frames.idle
    const attackPixels = sprite.frames.attack
    const palette = sprite.palette

    const avatar = useMemo(() => getCharacterAvatar(charId, '#4ecdc4'), [charId])

    const overlayIdleRef = useRef<HTMLCanvasElement>(null)
    const overlayAttackRef = useRef<HTMLCanvasElement>(null)

    const [showGrid, setShowGrid] = useState(true)
    const [hoverIdle, setHoverIdle] = useState<{ x: number; y: number } | null>(null)
    const [lockedIdle, setLockedIdle] = useState<{ x: number; y: number } | null>(null)
    const [hoverAttack, setHoverAttack] = useState<{ x: number; y: number } | null>(null)
    const [lockedAttack, setLockedAttack] = useState<{ x: number; y: number } | null>(null)

    // ── 武器调试 ──
    const [compositeWeapon, setCompositeWeapon] = useState(true)
    const overlay = useMemo(() => WEAPON_OVERLAYS[weaponId] ?? WEAPON_OVERLAYS.bare_hands, [weaponId])
    // 武器坐标系尺寸（显示整个网格，见 constants.ts）
    const weaponW = WEAPON_WIDTH
    const weaponH = WEAPON_HEIGHT
    // 武器单图：固定网格，像素画在原始坐标（不裁剪、不平移）
    const weaponViewPixels = useMemo(() => {
        const arr: number[][] = []
        for (let y = 0; y < weaponH; y++) {
            arr.push(new Array<number>(weaponW).fill(0))
        }
        const viewPalette: Record<string, string> = { '0': 'transparent' }
        let next = 1
        const colorIdx = new Map<string, number>()
        const paint = (x: number, y: number, color: string) => {
            if (x < 0 || y < 0 || x >= weaponW || y >= weaponH) return
            if (!colorIdx.has(color)) {
                colorIdx.set(color, next)
                viewPalette[String(next)] = color
                next++
            }
            arr[y][x] = colorIdx.get(color)!
        }
        for (const [px, py, color] of resolveWeaponPixels(overlay)) {
            paint(px, py, color)
        }
        return { pixels: arr, palette: viewPalette }
    }, [overlay.pixels, weaponH, weaponW])

    const height = idlePixels.length
    const width = idlePixels[0].length
    // 与 PixelCanvas 一致的方形画布与居中偏移（内容 60×48 → 方形 60×60，垂直居中 offY=6）
    const side = Math.max(width, height)
    const bufW = side * SCALE
    const bufH = side * SCALE
    const offX = Math.floor((side - width) / 2)
    const offY = Math.floor((side - height) / 2)

    /** 颜色使用统计（基于 idle 帧） */
    const colorStats = useMemo(() => {
        const stats = new Map<number, number>()
        for (const row of idlePixels) {
            for (const idx of row) {
                stats.set(idx, (stats.get(idx) ?? 0) + 1)
            }
        }
        return stats
    }, [idlePixels])

    const colorAt = (pixels: number[][], x: number, y: number): string => {
        const idx = pixels[y]?.[x] ?? 0
        return palette[String(idx)] ?? palette['0'] ?? 'transparent'
    }

    const infoFor = (pixels: number[][], p: { x: number; y: number } | null): PixelInfo | null => {
        if (!p) return null
        const idx = pixels[p.y]?.[p.x] ?? 0
        const count = colorStats.get(idx) ?? 0
        const total = width * height
        return {
            x: p.x,
            y: p.y,
            idx,
            color: colorAt(pixels, p.x, p.y),
            count,
            ratio: total > 0 ? count / total : 0,
        }
    }

    const idleInfo = infoFor(idlePixels, lockedIdle ?? hoverIdle)
    const attackInfo = infoFor(attackPixels, lockedAttack ?? hoverAttack)
    const activeInfo = idleInfo ?? attackInfo

    /** 将鼠标事件坐标换算为像素坐标（考虑画布居中偏移） */
    const toPixel = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
        const canvas = e.currentTarget
        const rect = canvas.getBoundingClientRect()
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * side) - offX
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * side) - offY
        if (x < 0 || x >= width || y < 0 || y >= height) return null
        return { x, y }
    }

    /** 重绘叠加层：网格 + hover/locked 高亮框 */
    const drawOverlay = (
        canvas: HTMLCanvasElement | null,
        hover: { x: number; y: number } | null,
        locked: { x: number; y: number } | null,
    ) => {
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, bufW, bufH)

        if (showGrid) {
            ctx.strokeStyle = 'rgba(128, 128, 128, 0.35)'
            ctx.lineWidth = 1
            for (let i = 0; i <= width; i++) {
                ctx.beginPath()
                ctx.moveTo((i + offX) * SCALE + 0.5, 0)
                ctx.lineTo((i + offX) * SCALE + 0.5, bufH)
                ctx.stroke()
            }
            for (let j = 0; j <= height; j++) {
                ctx.beginPath()
                ctx.moveTo(0, (j + offY) * SCALE + 0.5)
                ctx.lineTo(bufW, (j + offY) * SCALE + 0.5)
                ctx.stroke()
            }
        }

        // hover 高亮（虚线）
        if (hover) {
            ctx.strokeStyle = '#4ecdc4'
            ctx.lineWidth = 2
            ctx.setLineDash([4, 3])
            ctx.strokeRect((hover.x + offX) * SCALE + 1, (hover.y + offY) * SCALE + 1, SCALE - 2, SCALE - 2)
            ctx.setLineDash([])
        }
        // locked 高亮（实线）
        if (locked) {
            ctx.strokeStyle = '#ff6b6b'
            ctx.lineWidth = 2
            ctx.strokeRect((locked.x + offX) * SCALE + 1, (locked.y + offY) * SCALE + 1, SCALE - 2, SCALE - 2)
        }
    }

    // 网格 / hover / locked 变化时重绘叠加层
    useEffect(() => {
        drawOverlay(overlayIdleRef.current, hoverIdle, lockedIdle)
        drawOverlay(overlayAttackRef.current, hoverAttack, lockedAttack)
    })

    return (
        <div className="pixel-inspector">
            <div className="pixel-inspector-toolbar">
                <label className="pixel-inspector-select">
                    角色
                    <select value={charId} onChange={(e) => setCharId(e.target.value)}>
                        {CHARACTER_IDS.map((id) => (
                            <option key={id} value={id}>
                                {NAME_BY_ID[id] ?? id}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="pixel-inspector-toggle">
                    <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                    显示网格
                </label>
                <label className="pixel-inspector-select">
                    武器
                    <select value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
                        {WEAPON_IDS.map((id) => (
                            <option key={id} value={id}>
                                {WEAPON_NAME[id] ?? id}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="pixel-inspector-toggle">
                    <input
                        type="checkbox"
                        checked={compositeWeapon}
                        onChange={(e) => setCompositeWeapon(e.target.checked)}
                    />
                    合成武器
                </label>
                <span className="pixel-inspector-size">
                    {width}×{height} @ {SCALE}x
                </span>
            </div>

            <div className="pixel-inspector-body">
                <div className="pixel-inspector-frames">
                    <figure className="pixel-inspector-frame">
                        <figcaption>idle</figcaption>
                        <div className="pixel-inspector-canvas-wrap">
                            <PixelCanvas
                                pixels={idlePixels}
                                palette={palette}
                                scale={SCALE}
                                pose="idle"
                                overlay={compositeWeapon ? overlay : undefined}
                                className="pixel-inspector-canvas"
                            />
                            <canvas
                                ref={overlayIdleRef}
                                width={bufW}
                                height={bufH}
                                className="pixel-inspector-overlay"
                                onMouseMove={(e) => setHoverIdle(toPixel(e))}
                                onMouseLeave={() => setHoverIdle(null)}
                                onClick={(e) => setLockedIdle(toPixel(e))}
                                onDoubleClick={() => setLockedIdle(null)}
                            />
                        </div>
                    </figure>

                    <figure className="pixel-inspector-frame">
                        <figcaption>attack（逆时针 45°）</figcaption>
                        <div className="pixel-inspector-canvas-wrap">
                            <PixelCanvas
                                pixels={attackPixels}
                                palette={palette}
                                scale={SCALE}
                                pose="attack"
                                angle={-Math.PI / 4}
                                overlay={compositeWeapon ? overlay : undefined}
                                className="pixel-inspector-canvas"
                            />
                            <canvas
                                ref={overlayAttackRef}
                                width={bufW}
                                height={bufH}
                                className="pixel-inspector-overlay"
                                onMouseMove={(e) => setHoverAttack(toPixel(e))}
                                onMouseLeave={() => setHoverAttack(null)}
                                onClick={(e) => setLockedAttack(toPixel(e))}
                                onDoubleClick={() => setLockedAttack(null)}
                            />
                        </div>
                    </figure>

                    <figure className="pixel-inspector-frame pixel-inspector-frame--avatar">
                        <figcaption>avatar</figcaption>
                        <div className="pixel-inspector-canvas-wrap">
                            <PixelCanvas
                                pixels={avatar.pixels}
                                palette={avatar.palette}
                                scale={AVATAR_SCALE}
                                className="pixel-inspector-canvas pixel-inspector-canvas--avatar"
                            />
                        </div>
                        <figcaption className="pixel-inspector-weapon-caption">
                            weapon · {weaponId}（{weaponW}×{weaponH}，grip {overlay.gripX},{overlay.gripY}
                            {overlay.grip2X !== undefined ? ` / 2nd ${overlay.grip2X},${overlay.grip2Y}` : ''}）
                        </figcaption>
                        <div className="pixel-inspector-canvas-wrap">
                            <PixelCanvas
                                pixels={weaponViewPixels.pixels}
                                palette={weaponViewPixels.palette}
                                scale={WEAPON_SCALE}
                                className="pixel-inspector-canvas pixel-inspector-canvas--weapon"
                                style={{ width: weaponW * WEAPON_SCALE, height: weaponH * WEAPON_SCALE }}
                            />
                        </div>
                    </figure>
                </div>

                <aside className="pixel-inspector-panel">
                    <h3 className="pixel-inspector-panel-title">像素信息</h3>

                    {activeInfo ? (
                        <dl className="pixel-inspector-info">
                            <div className="pixel-inspector-info-row">
                                <dt>坐标</dt>
                                <dd>
                                    ({activeInfo.x}, {activeInfo.y})
                                </dd>
                            </div>
                            <div className="pixel-inspector-info-row">
                                <dt>索引</dt>
                                <dd>
                                    <code>{activeInfo.idx}</code>
                                </dd>
                            </div>
                            <div className="pixel-inspector-info-row">
                                <dt>颜色</dt>
                                <dd className="pixel-inspector-color-cell">
                                    <span
                                        className="pixel-inspector-swatch"
                                        style={{
                                            background:
                                                activeInfo.color === 'transparent' ? 'transparent' : activeInfo.color,
                                        }}
                                    />
                                    <code>{activeInfo.color}</code>
                                </dd>
                            </div>
                            <div className="pixel-inspector-info-row">
                                <dt>使用</dt>
                                <dd>
                                    {activeInfo.count} 像素（{(activeInfo.ratio * 100).toFixed(1)}%）
                                </dd>
                            </div>
                        </dl>
                    ) : (
                        <p className="pixel-inspector-hint">将鼠标悬停在画布上查看像素信息</p>
                    )}

                    {(lockedIdle || lockedAttack) && (
                        <button
                            className="pixel-inspector-unlock"
                            onClick={() => {
                                setLockedIdle(null)
                                setLockedAttack(null)
                            }}
                        >
                            清除锁定（双击也可）
                        </button>
                    )}

                    <h3 className="pixel-inspector-panel-title pixel-inspector-panel-title--stats">颜色统计（idle）</h3>
                    <ul className="pixel-inspector-stats">
                        {[...colorStats.entries()]
                            .sort((a, b) => b[1] - a[1])
                            .map(([idx, count]) => {
                                const color = palette[String(idx)] ?? palette['0'] ?? 'transparent'
                                return (
                                    <li key={idx} className="pixel-inspector-stats-item">
                                        <span
                                            className="pixel-inspector-swatch"
                                            style={{ background: color === 'transparent' ? 'transparent' : color }}
                                        />
                                        <code>{idx}</code>
                                        <span className="pixel-inspector-stats-hex">{color}</span>
                                        <span className="pixel-inspector-stats-count">
                                            {count}（{((count / (width * height)) * 100).toFixed(1)}%）
                                        </span>
                                    </li>
                                )
                            })}
                    </ul>
                </aside>
            </div>
        </div>
    )
}
