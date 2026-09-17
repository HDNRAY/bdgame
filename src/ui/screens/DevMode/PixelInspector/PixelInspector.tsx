import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore, getEffectiveTheme } from '../../../stores/app-store'
import {
    getCharacterAvatar,
    getDualMainAngle,
    getSpriteOutlineColor,
    getWeaponPoseConfig,
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
import { SearchSelect } from '../../../components/ui/SearchSelect/SearchSelect'
import './PixelInspector.scss'

/** 姿势帧默认缩放（每像素格显示尺寸，可由工具栏滑块调整） */
const DEFAULT_ZOOM = 4
/** 缩放滑块范围 */
const ZOOM_MIN = 2
const ZOOM_MAX = 12
/** 头像放大倍数 */
const AVATAR_SCALE = 4
/** 武器单图放大倍数：32×32 → 192×192 */
const WEAPON_SCALE = 6
/** 头像/武器显示尺寸：两个并排 ≈ 一个动作帧宽 */
const AVATAR_WEAPON_SIZE = 176

/** 角色 ID 列表（有配色 + 体型映射的），中文名取自 OpponentDef.name */
const CHARACTER_IDS = Object.keys(CHARACTER_COLORS).filter((id) => CHARACTER_SPRITE_MAP[id])

/** 角色 ID → 中文名（来自 data/opponents 的 name 字段） */
const NAME_BY_ID: Record<string, string> = Object.fromEntries(OPPONENTS.map((o) => [o.id, o.name]))

/** 武器 ID 列表：起始武器 + 武器库全量（含有数据但尚未绘制像素图的武器，便于对照还缺哪些美术） */
const WEAPON_IDS = Array.from(new Set([...STARTING_WEAPONS, ...WEAPON_DB].map((w) => w.id)))

/** 武器 ID → 是否已有像素图（没有美术的武器在查看器里只能看到角色空手） */
const WEAPON_HAS_ART: Record<string, boolean> = {
    ...Object.fromEntries(Object.entries(WEAPON_OVERLAYS).map(([id, ov]) => [id, ov.pixels.length > 0])),
    // 空手本来就没有武器图，不算"未绘制"
    bare_hands: true,
}

/** 武器 ID → 中文名（来自 data/weapons，找不到则回退为 id 本身） */
const WEAPON_NAME: Record<string, string> = Object.fromEntries(
    [...WEAPON_DB, ...STARTING_WEAPONS].map((w) => [w.id, w.name]),
)

/** 下拉项文案：未绘制像素图的武器标注出来 */
function weaponLabel(id: string): string {
    return `${WEAPON_NAME[id] ?? id}${WEAPON_HAS_ART[id] ? '' : '（未绘制）'}`
}

interface PixelInfo {
    x: number
    y: number
    /** 调色板索引：姿势帧为角色调色板键；武器原图为其在 weapons.ts 里的原始键 */
    idx: number | string
    color: string
    /** 该颜色在整个精灵中的使用次数 */
    count: number
    /** 该颜色占比（0~1） */
    ratio: number
}

/** 叠加层（网格 / hover / 锁定框）的画布布局：姿势帧与武器原图各一套 */
interface OverlayLayout {
    cols: number
    rows: number
    /** 内容左上角在画布中的位置（格） */
    offX: number
    offY: number
    /** 每格放大倍数（画布缓冲像素） */
    cell: number
    /** 可点选的内容尺寸（像素坐标有效范围） */
    contentW: number
    contentH: number
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

    // 描边色按主题取常量（深色=浅灰，不用纯白）
    const themeMode = useAppStore((s) => s.uiConfig.theme)
    const outlineColor = getSpriteOutlineColor(getEffectiveTheme(themeMode))

    const sprite = useMemo(() => makeCharacterSprite(charId, '#4ecdc4', outlineColor), [charId, outlineColor])
    const palette = sprite.palette
    const idlePixels = sprite.frames.idle
    /** 全部动作帧（idle / attack / hit / …），按插入顺序展示 */
    const frames = useMemo(() => Object.entries(sprite.frames), [sprite])

    const avatar = useMemo(() => getCharacterAvatar(charId, '#4ecdc4', outlineColor), [charId, outlineColor])

    /** 各姿势叠加层 canvas ref / hover / locked（按姿势名索引） */
    const overlayRefs = useRef<Record<string, HTMLCanvasElement | null>>({})
    /** 武器原图（32×32）的叠加层画布 */
    const weaponOverlayRef = useRef<HTMLCanvasElement | null>(null)

    const [showGrid, setShowGrid] = useState(true)
    const [hover, setHover] = useState<Record<string, { x: number; y: number } | null>>({})
    const [locked, setLocked] = useState<Record<string, { x: number; y: number } | null>>({})

    // ── 武器调试 ──
    const [compositeWeapon, setCompositeWeapon] = useState(true)
    /** 双持预览：主手武器 + 副手武器（默认桃木剑，看副手锚点/角度） */
    const [dualWield, setDualWield] = useState(true)
    const [offhandId, setOffhandId] = useState('peach_sword')
    /** 姿势帧缩放：每像素格的显示尺寸（画布缓冲同步，保证 1:1 清晰） */
    const [zoom, setZoom] = useState(DEFAULT_ZOOM)
    const overlay = useMemo(() => WEAPON_OVERLAYS[weaponId] ?? WEAPON_OVERLAYS.bare_hands, [weaponId])
    const hasWeaponArt = WEAPON_HAS_ART[weaponId] ?? false
    const hasOffhandArt = WEAPON_HAS_ART[offhandId] ?? false
    const idlePose = useMemo(() => getWeaponPoseConfig(weaponId, 'idle'), [weaponId])
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
    // 画布尺寸：宽度取 2 倍（给长兵器/大范围攻击留空间），多出的宽度按 1.5:0.5 分配
    // → 左侧留得多（武器多向左挥）、右侧留得少；高度在方形基准上减 6 格
    const side = Math.max(width, height)
    const canvasCols = side * 2
    const canvasRows = side - 6
    const bufW = canvasCols * zoom
    const bufH = canvasRows * zoom
    const offX = Math.round(((canvasCols - width) * 3) / 4)
    const offY = Math.floor((canvasRows - height) / 2)

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

    /** 武器原图的颜色统计（右侧「像素信息」用） */
    const weaponColorStats = useMemo(() => {
        const stats = new Map<number, number>()
        for (const row of weaponViewPixels.pixels) {
            for (const idx of row) stats.set(idx, (stats.get(idx) ?? 0) + 1)
        }
        return stats
    }, [weaponViewPixels])

    /** 武器原图里 颜色 → 原始调色板键（让面板显示 weapons.ts 里写的那个索引） */
    const weaponKeyByColor = useMemo(() => {
        const map = new Map<string, string>()
        for (const [key, color] of Object.entries(WEAPON_OVERLAYS[weaponId]?.palette ?? {})) map.set(color, key)
        return map
    }, [weaponId])

    const infoFor = (
        pixels: number[][],
        pal: Record<string, string>,
        stats: Map<number, number>,
        p: { x: number; y: number } | null,
        keyOf?: (color: string, idx: number) => number | string,
    ): PixelInfo | null => {
        if (!p) return null
        const idx = pixels[p.y]?.[p.x] ?? 0
        const count = stats.get(idx) ?? 0
        const total = pixels.length * (pixels[0]?.length ?? 0)
        const color = pal[String(idx)] ?? pal['0'] ?? 'transparent'
        return {
            x: p.x,
            y: p.y,
            idx: keyOf ? keyOf(color, idx) : idx,
            color,
            count,
            ratio: total > 0 ? count / total : 0,
        }
    }

    /** 当前有 hover/locked 的目标（武器原图优先），以及它的来源标签 */
    let activeInfo: PixelInfo | null = null
    let activeSource = ''
    const weaponPoint = locked.weapon ?? hover.weapon
    if (weaponPoint) {
        activeInfo = infoFor(weaponViewPixels.pixels, weaponViewPixels.palette, weaponColorStats, weaponPoint, (color, idx) =>
            weaponKeyByColor.get(color) ?? `视图 ${idx}`,
        )
        activeSource = '武器原图'
    }
    if (!activeInfo) {
        for (const [name, pixels] of frames) {
            const p = locked[name] ?? hover[name]
            if (p) {
                activeInfo = infoFor(pixels, palette, colorStats, p)
                activeSource = name
                break
            }
        }
    }

    /** 姿势帧与武器原图两套画布布局 */
    const frameLayout: OverlayLayout = {
        cols: canvasCols,
        rows: canvasRows,
        offX,
        offY,
        cell: zoom,
        contentW: width,
        contentH: height,
    }
    const weaponLayout: OverlayLayout = {
        cols: weaponW,
        rows: weaponH,
        offX: 0,
        offY: 0,
        cell: WEAPON_SCALE,
        contentW: weaponW,
        contentH: weaponH,
    }

    /** 将鼠标事件坐标换算为像素坐标（按给定画布布局，考虑内容偏移） */
    const toPixelIn = (
        e: React.MouseEvent<HTMLCanvasElement>,
        layout: OverlayLayout,
    ): { x: number; y: number } | null => {
        const canvas = e.currentTarget
        const rect = canvas.getBoundingClientRect()
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * layout.cols) - layout.offX
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * layout.rows) - layout.offY
        if (x < 0 || x >= layout.contentW || y < 0 || y >= layout.contentH) return null
        return { x, y }
    }

    /** 重绘叠加层：网格 + hover/locked 高亮框（姿势帧与武器原图共用，靠 layout 区分） */
    const drawOverlay = (
        canvas: HTMLCanvasElement | null,
        layout: OverlayLayout,
        hover: { x: number; y: number } | null,
        locked: { x: number; y: number } | null,
    ) => {
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const { cols, rows, offX: ox, offY: oy, cell } = layout
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        // 高亮框格边长（缩放很小时至少 1px，避免画不出来）
        const hoverSize = Math.max(1, cell - 2)

        if (showGrid) {
            ctx.strokeStyle = 'rgba(128, 128, 128, 0.35)'
            ctx.lineWidth = 1
            // 竖线按画布绝对列号（不加内容偏移），否则左侧留白区没有网格
            for (let i = 0; i <= cols; i++) {
                ctx.beginPath()
                ctx.moveTo(i * cell + 0.5, 0)
                ctx.lineTo(i * cell + 0.5, canvas.height)
                ctx.stroke()
            }
            // 横线铺满整张画布（含留白），避免缺横线
            for (let j = 0; j <= rows; j++) {
                ctx.beginPath()
                ctx.moveTo(0, j * cell + 0.5)
                ctx.lineTo(canvas.width, j * cell + 0.5)
                ctx.stroke()
            }
        }

        // hover 高亮（虚线）
        if (hover) {
            ctx.strokeStyle = '#4ecdc4'
            ctx.lineWidth = 2
            ctx.setLineDash([4, 3])
            ctx.strokeRect((hover.x + ox) * cell + 1, (hover.y + oy) * cell + 1, hoverSize, hoverSize)
            ctx.setLineDash([])
        }
        // locked 高亮（实线）
        if (locked) {
            ctx.strokeStyle = '#ff6b6b'
            ctx.lineWidth = 2
            ctx.strokeRect((locked.x + ox) * cell + 1, (locked.y + oy) * cell + 1, hoverSize, hoverSize)
        }
    }

    // 网格 / hover / locked 变化时重绘叠加层（含武器原图）
    useEffect(() => {
        for (const [name] of frames) {
            drawOverlay(
                overlayRefs.current[name] ?? null,
                frameLayout,
                hover[name] ?? null,
                locked[name] ?? null,
            )
        }
        drawOverlay(weaponOverlayRef.current, weaponLayout, hover.weapon ?? null, locked.weapon ?? null)
    })

    return (
        <div className="pixel-inspector">
            <div className="pixel-inspector-body">
                <div className="pixel-inspector-side">
                    <div className="pixel-inspector-toolbar">
                        <label className="pixel-inspector-select">
                            角色
                            <SearchSelect
                                value={charId}
                                options={CHARACTER_IDS.map((id) => ({ value: id, label: NAME_BY_ID[id] ?? id }))}
                                onChange={setCharId}
                                searchPlaceholder="搜索角色…"
                            />
                        </label>
                        <label className="pixel-inspector-toggle">
                            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                            显示网格
                        </label>
                        <label className="pixel-inspector-select">
                            武器
                            <SearchSelect
                                value={weaponId}
                                options={WEAPON_IDS.map((id) => ({ value: id, label: weaponLabel(id) }))}
                                onChange={setWeaponId}
                                searchPlaceholder="搜索武器…"
                            />
                        </label>
                        <label className="pixel-inspector-toggle">
                            <input
                                type="checkbox"
                                checked={compositeWeapon}
                                onChange={(e) => setCompositeWeapon(e.target.checked)}
                            />
                            合成武器
                        </label>
                        <label className="pixel-inspector-toggle" title="副手武器按双持规则锚定副手位（攻击同向轻前倾、招架交叉）">
                            <input type="checkbox" checked={dualWield} onChange={(e) => setDualWield(e.target.checked)} />
                            双持预览
                        </label>
                        {dualWield && (
                            <label className="pixel-inspector-select">
                                副手
                                <SearchSelect
                                    value={offhandId}
                                    options={WEAPON_IDS.map((id) => ({ value: id, label: weaponLabel(id) }))}
                                    onChange={setOffhandId}
                                    searchPlaceholder="搜索武器…"
                                />
                            </label>
                        )}
                        <label className="pixel-inspector-zoom">
                            缩放
                            <input
                                type="range"
                                min={ZOOM_MIN}
                                max={ZOOM_MAX}
                                step={1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                            />
                            <span className="pixel-inspector-size">{zoom}x</span>
                        </label>
                    </div>

                    {!hasWeaponArt && (
                        <p className="pixel-inspector-hint">
                            「{WEAPON_NAME[weaponId] ?? weaponId}」尚未绘制像素图 —— 画面只显示角色空手。
                            补图方式：在 weapons.ts 的 WEAPON_OVERLAYS 里加一张 {weaponW}×{weaponH} 网格的叠加图，
                            并在 WEAPON_POSES 里登记握点/角度。
                        </p>
                    )}
                    {dualWield && !hasOffhandArt && (
                        <p className="pixel-inspector-hint">
                            副手「{WEAPON_NAME[offhandId] ?? offhandId}」尚未绘制像素图。
                        </p>
                    )}

                        <aside className="pixel-inspector-panel">
                            <h3 className="pixel-inspector-panel-title">像素信息</h3>

                            <dl className="pixel-inspector-info pixel-inspector-info--canvas">
                                <div className="pixel-inspector-info-row">
                                    <dt>画布</dt>
                                    <dd>
                                        {canvasCols}×{canvasRows}
                                    </dd>
                                </div>
                                <div className="pixel-inspector-info-row">
                                    <dt>内容</dt>
                                    <dd>
                                        {width}×{height}
                                    </dd>
                                </div>
                            </dl>

                            {activeInfo ? (
                                <dl className="pixel-inspector-info">
                                    <div className="pixel-inspector-info-row">
                                        <dt>来源</dt>
                                        <dd>{activeSource}</dd>
                                    </div>
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

                            {Object.values(locked).some(Boolean) && (
                                <button className="pixel-inspector-unlock" onClick={() => setLocked({})}>
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
                <div className="pixel-inspector-frames">
                    {frames.map(([name, pixels]) => (
                        <figure key={name} className="pixel-inspector-frame">
                            <figcaption>{name}</figcaption>
                            <div className="pixel-inspector-canvas-wrap">
                                <PixelCanvas
                                    pixels={pixels}
                                    palette={palette}
                                    scale={zoom}
                                    pose={name}
                                    weaponId={compositeWeapon ? weaponId : undefined}
                                    angle={!dualWield && name === 'attack' ? -Math.PI / 4 : undefined}
                                    overlay={compositeWeapon ? overlay : undefined}
                                    secondWeaponId={compositeWeapon && dualWield ? offhandId : undefined}
                                    dualMainAngle={compositeWeapon && dualWield ? getDualMainAngle(weaponId, name, true) : undefined}
                                    canvasCols={canvasCols}
                                    canvasRows={canvasRows}
                                    contentOffsetX={offX}
                                    className="pixel-inspector-canvas"
                                />
                                <canvas
                                    ref={(el) => {
                                        overlayRefs.current[name] = el
                                    }}
                                    width={bufW}
                                    height={bufH}
                                    className="pixel-inspector-overlay"
                                    onMouseMove={(e) => {
                                        // 同步读取坐标：e.currentTarget 在事件处理结束/异步 setState 时会被清空
                                        const p = toPixelIn(e, frameLayout)
                                        setHover((prev) => ({ ...prev, [name]: p }))
                                    }}
                                    onMouseLeave={() => setHover((prev) => ({ ...prev, [name]: null }))}
                                    onClick={(e) => {
                                        const p = toPixelIn(e, frameLayout)
                                        setLocked((prev) => ({ ...prev, [name]: p }))
                                    }}
                                    onDoubleClick={() => setLocked((prev) => ({ ...prev, [name]: null }))}
                                />
                            </div>
                        </figure>
                    ))}
                    <figure className="pixel-inspector-frame pixel-inspector-frame--avatar">
                        <figcaption>avatar / weapon</figcaption>
                        <div className="pixel-inspector-avatar-row">
                            <div className="pixel-inspector-canvas-wrap">
                                <PixelCanvas
                                    pixels={avatar.pixels}
                                    palette={avatar.palette}
                                    scale={AVATAR_SCALE}
                                    className="pixel-inspector-canvas pixel-inspector-canvas--avatar"
                                />
                            </div>
                            <div className="pixel-inspector-canvas-wrap">
                                <PixelCanvas
                                    pixels={weaponViewPixels.pixels}
                                    palette={weaponViewPixels.palette}
                                    scale={WEAPON_SCALE}
                                    className="pixel-inspector-canvas pixel-inspector-canvas--weapon"
                                    style={{ width: AVATAR_WEAPON_SIZE, height: AVATAR_WEAPON_SIZE }}
                                />
                                {/* 武器原图也支持 hover / 锁定，像素信息面板同步显示 */}
                                <canvas
                                    ref={weaponOverlayRef}
                                    width={weaponW * WEAPON_SCALE}
                                    height={weaponH * WEAPON_SCALE}
                                    className="pixel-inspector-overlay"
                                    onMouseMove={(e) => {
                                        const p = toPixelIn(e, weaponLayout)
                                        setHover((prev) => ({ ...prev, weapon: p }))
                                    }}
                                    onMouseLeave={() => setHover((prev) => ({ ...prev, weapon: null }))}
                                    onClick={(e) => {
                                        const p = toPixelIn(e, weaponLayout)
                                        setLocked((prev) => ({ ...prev, weapon: p }))
                                    }}
                                    onDoubleClick={() => setLocked((prev) => ({ ...prev, weapon: null }))}
                                />
                            </div>
                        </div>
                        <figcaption className="pixel-inspector-weapon-caption">
                            weapon · {weaponId}（{weaponW}×{weaponH}，grip {idlePose.gripX},{idlePose.gripY}
                            {idlePose.grip2X !== undefined ? ` / 2nd ${idlePose.grip2X},${idlePose.grip2Y}` : ''}
                            {hasWeaponArt ? '' : '，未绘制'}）
                        </figcaption>
                    </figure>
                </div>

            </div>
        </div>
    )
}
