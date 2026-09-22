import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
    HAND_COVER,
    HAND_POINTS,
    LEFT_HAND_COVER,
    OTHER_HAND_POINT,
    POSE_NAMES,
    SPRITE_AURA_SLOT,
    SPRITE_HEIGHT,
    SPRITE_MAX_SLOT,
    SPRITE_PAD_LEFT,
    SPRITE_WIDTH,
    WEAPON_HEIGHT,
    WEAPON_OVERLAYS,
    WEAPON_WIDTH,
    addAuraRing,
    autoOutline,
    blankPixelMap,
    fillRegion,
    buildPalette,
    formatAnchorSnippet,
    formatCharacterColorsSnippet,
    formatPixelMapJson,
    formatPixelMapLiteral,
    formatPixelMapSource,
    formatWeaponOverlaySnippet,
    frameSize,
    frameStats,
    getCell,
    getSpriteOutlineColor,
    hitAnchor,
    moveAnchor,
    paintCell,
    paintLine,
    parseEditorState,
    parsePixelMap,
    parseWeaponOverlay,
    serializeEditorState,
    resolveWeaponPixels,
    snapAnchorToSkin,
    stringifyPixelMap,
    unpadRenderedFrame,
} from '../../../pixel-sprites'
import type { HandAnchorData, PixelEditorSavedState, PixelMap } from '../../../pixel-sprites'
import {
    DEFAULT_ATTACK,
    DEFAULT_BUFF,
    DEFAULT_DODGE,
    DEFAULT_HIT,
    DEFAULT_IDLE,
    DEFAULT_PARRY,
} from '../../../pixel-sprites/sprites'
import { CHARACTER_COLORS, CHARACTER_SPRITE_MAP, DEFAULT_COLORS } from '../../../pixel-sprites/palette'
import type { CharacterColors } from '../../../pixel-sprites/palette'
import { OPPONENTS } from '../../../../data/opponents'
import { WEAPON_DB } from '../../../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../../../data/weapons/starting-weapons'
import { PixelCanvas } from '../../../components/ui/PixelCanvas/PixelCanvas'
import { SearchSelect } from '../../../components/ui/SearchSelect/SearchSelect'
import { useAppStore, getEffectiveTheme } from '../../../stores/app-store'
import { WeaponMountPanel } from './WeaponMountPanel'
import type { WeaponPoseConfig, WeaponSlot } from '../../../pixel-sprites'

import './PixelEditor.scss'

/** 编辑对象：身体姿势帧（48×48 槽位图）或武器图（32×32 自由配色） */
type EditorMode = 'frame' | 'weapon' | 'mount'
type Tool = 'pen' | 'eraser' | 'picker' | 'fill'

/**
 * 身体帧源图尺寸（sprites.ts 的 DEFAULT_*；渲染时 padSprite 补 SPRITE_PAD_LEFT 列留白 → 60×48）。
 * 栅格尺寸实际跟随载入的图（frameSize），这里只用于「空白」和渲染帧识别。
 */
const SOURCE_W = DEFAULT_IDLE[0].length
const SOURCE_H = DEFAULT_IDLE.length
/** 自适应测量失败时的兜底缩放 */
const DEFAULT_ZOOM = 12
const ZOOM_MIN = 4
const ZOOM_MAX = 20
const HISTORY_LIMIT = 100

const TOOLS: { id: Tool; label: string; key: string }[] = [
    { id: 'pen', label: '画笔', key: 'B' },
    { id: 'eraser', label: '橡皮', key: 'E' },
    { id: 'picker', label: '吸管', key: 'I' },
    { id: 'fill', label: '油漆桶', key: 'G' },
]

/** 身体帧槽位（palette.ts）。8 受击星光不在面板露出（旧帧里仍能正常渲染） */
const FRAME_SLOT_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 9]
const SLOT_LABELS: Record<number, string> = {
    0: '透明',
    1: '描边',
    2: '发色',
    3: '皮肤',
    4: '瞳色',
    5: '衣物',
    6: '装饰',
    7: '白',
    8: '受击星光',
    9: '金边',
}
const SLOT_TIPS: Record<number, string> = {
    0: '透明 / 橡皮：涂上去就是擦掉（快捷键 0）',
    1: '描边：角色的深色轮廓（快捷键 1）',
    2: '发色：取自角色配色（快捷键 2）',
    3: '皮肤：手、脸（快捷键 3）',
    4: '瞳色：眼睛（快捷键 4）',
    5: '衣物：衣服主色（快捷键 5）',
    6: '装饰：腰带、鞋等点缀（快捷键 6）',
    7: '白：特效白（快捷键 7）',
    9: '金边：爆气光环（快捷键 9）',
}

/** 身体帧里「跟角色配色走」的槽位 → CHARACTER_COLORS 的字段（这几个槽位可以在编辑器里改色） */
const SLOT_TO_COLOR_KEY: Record<number, keyof CharacterColors> = {
    2: 'hair',
    3: 'skin',
    4: 'eyes',
    5: 'accent',
    6: 'decoration',
}

/** 槽位兜底色：调色板缺某个槽位（旧页面热更等）时也不至于「涂上去看不见」 */
const SLOT_FALLBACK_COLORS: Record<number, string> = {
    1: '#000000',
    2: '#555555',
    3: '#FFCC99',
    4: '#00A0FF',
    5: '#DDDDDD',
    6: '#888888',
    7: '#ffffff',
    8: '#ffd24a',
    9: '#ffd24a',
}

/**
 * 画布底板（透明区的棋盘）：换色系方便看对比度。
 * 前两个是编辑器自己的深浅棋盘；「游戏浅色底 / 深色底」对应对战画布（themes.css 的 --color-canvas-bg）。
 */
const BACKDROP_PRESETS: { id: string; label: string; a: string; b: string }[] = [
    { id: 'dark', label: '深色棋盘', a: '#20242c', b: '#262b34' },
    { id: 'light', label: '浅色棋盘', a: '#dcdcdc', b: '#eaeaea' },
    { id: 'game-light', label: '游戏浅色底', a: '#ffffff', b: '#f2f2f2' },
    { id: 'game-dark', label: '游戏深色底', a: '#000000', b: '#0d0d0d' },
    { id: 'gray', label: '中灰', a: '#6f6f6f', b: '#7c7c7c' },
    { id: 'custom', label: '自定义', a: '#2b3a2b', b: '#334433' },
]
const BACKDROP_STORAGE_KEY = 'dantiao:pixel-editor:backdrop'

/** 判断底板亮不亮（网格线/hover 框取反色才看得见） */
function isLightColor(hex: string): boolean {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) return false
    const n = parseInt(m[1], 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

/** 由基色生成棋盘的另一格（亮底压暗、暗底提亮） */
function backdropPartner(base: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(base)
    if (!m) return base
    const n = parseInt(m[1], 16)
    const shift = isLightColor(base) ? -16 : 16
    const clamp = (v: number) => Math.max(0, Math.min(255, v))
    const r = clamp(((n >> 16) & 255) + shift)
    const g = clamp(((n >> 8) & 255) + shift)
    const b = clamp((n & 255) + shift)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const CHARACTER_IDS = Object.keys(CHARACTER_COLORS).filter((id) => CHARACTER_SPRITE_MAP[id])
const NAME_BY_ID: Record<string, string> = Object.fromEntries(OPPONENTS.map((o) => [o.id, o.name]))
const WEAPON_NAME: Record<string, string> = Object.fromEntries(
    [...WEAPON_DB, ...STARTING_WEAPONS].map((w) => [w.id, w.name]),
)
/** 已画好美术的武器（可载入当底稿） */
const WEAPON_IDS_WITH_ART = Object.entries(WEAPON_OVERLAYS)
    .filter(([, ov]) => ov.pixels.length > 0)
    .map(([id]) => id)

const BUILTIN_FRAMES: { key: string; label: string; map: PixelMap }[] = [
    { key: 'idle', label: 'idle', map: DEFAULT_IDLE },
    { key: 'attack', label: 'attack', map: DEFAULT_ATTACK },
    { key: 'dodge', label: 'dodge', map: DEFAULT_DODGE },
    { key: 'parry', label: 'parry', map: DEFAULT_PARRY },
    { key: 'hit', label: 'hit', map: DEFAULT_HIT },
    { key: 'buff', label: 'buff', map: DEFAULT_BUFF },
]

const cloneMap = (m: PixelMap): PixelMap => m.map((r) => [...r])

/** 预览用：按 padSprite 的规则补左侧留白（预览 = 游戏里的渲染结果） */
function padForPreview(map: PixelMap): PixelMap {
    const out: PixelMap = Array.from({ length: SPRITE_HEIGHT }, () => new Array<number>(SPRITE_WIDTH).fill(0))
    for (let y = 0; y < Math.min(map.length, SPRITE_HEIGHT); y++) {
        for (let x = 0; x < map[y].length; x++) {
            const px = x + SPRITE_PAD_LEFT
            if (px >= SPRITE_WIDTH) break
            out[y][px] = map[y][x]
        }
    }
    return out
}

/** 武器图 → 32×32 网格 + 调色板（下标 0 占位） */
function weaponOverlayToGrid(weaponId: string): { grid: PixelMap; palette: string[] } {
    const grid = blankPixelMap(WEAPON_WIDTH, WEAPON_HEIGHT)
    const palette: string[] = ['']
    const index = new Map<string, number>()
    const overlay = WEAPON_OVERLAYS[weaponId]
    if (overlay) {
        for (const [x, y, color] of resolveWeaponPixels(overlay)) {
            let idx = index.get(color)
            if (!idx) {
                palette.push(color)
                idx = palette.length - 1
                index.set(color, idx)
            }
            if (x >= 0 && x < WEAPON_WIDTH && y >= 0 && y < WEAPON_HEIGHT) grid[y][x] = idx
        }
    }
    return { grid, palette }
}

/** 武器图 → 可下载/可再导入的 JSON（颜色直接写色值） */
function weaponGridToJson(grid: PixelMap, palette: string[]): string {
    const pixels: [number, number, string][] = []
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const v = grid[y][x]
            if (v > 0 && palette[v]) pixels.push([x, y, palette[v]])
        }
    }
    return JSON.stringify({ pixels, palette: {} }, null, 1)
}

const EDITOR_STATE_KEY = 'dantiao:pixel-editor:state:v1'

/** 读一次本地存档（页面重载 / Vite 重载后恢复；读写失败都当没有） */
function readSavedState(): PixelEditorSavedState | null {
    try {
        if (typeof localStorage === 'undefined') return null
        return parseEditorState(localStorage.getItem(EDITOR_STATE_KEY))
    } catch {
        return null
    }
}

export function PixelEditor() {
    // 只读一次：用它作为各 state 的初值
    const saved = useMemo(() => readSavedState(), [])
    const [mode, setMode] = useState<EditorMode>(saved?.mode ?? 'frame')
    /** 武器挂点实验：武器 id → 姿势 → 改过的配置（空 = 用 weapons.ts 登记值） */
    const [mountConfigs, setMountConfigs] = useState<
        Record<string, Record<WeaponSlot, Record<string, Partial<WeaponPoseConfig>>>>
    >(
        () => saved?.mountConfigs ?? {},
    )

    // ── 身体帧 ──
    const [map, setMap] = useState<PixelMap>(() => cloneMap(saved?.frame.map ?? DEFAULT_BUFF))
    const [poseName, setPoseName] = useState(saved?.frame.poseName ?? 'buff')
    const [constName, setConstName] = useState(saved?.frame.constName ?? 'DEFAULT_BUFF')
    const [sourceKey, setSourceKey] = useState(saved?.frame.sourceKey ?? 'buff')

    // ── 武器图 ──
    const firstWeaponId = WEAPON_IDS_WITH_ART[0] ?? 'dark_iron_sword'
    const [weaponId, setWeaponId] = useState(saved?.weapon.id ?? firstWeaponId)
    const [weaponGrid, setWeaponGrid] = useState<PixelMap>(
        () => saved?.weapon.grid ?? weaponOverlayToGrid(firstWeaponId).grid,
    )
    const [weaponPalette, setWeaponPalette] = useState<string[]>(
        () => saved?.weapon.palette ?? weaponOverlayToGrid(firstWeaponId).palette,
    )

    // ── 工具/颜色 ──
    const [tool, setTool] = useState<Tool>(saved?.tool ?? 'pen')
    const [slot, setSlot] = useState(saved?.slot ?? 1)
    const [mirror, setMirror] = useState(saved?.mirror ?? false)
    const [manualZoom, setManualZoom] = useState<number | null>(saved?.manualZoom ?? null)
    const [showGrid, setShowGrid] = useState(saved?.showGrid ?? true)
    const [showAnchors, setShowAnchors] = useState(saved?.showAnchors ?? true)
    /** 底板色系（记住上次选择） */
    const [backdropId, setBackdropId] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(BACKDROP_STORAGE_KEY)
            if (saved) {
                const [id, color] = saved.split('|')
                if (BACKDROP_PRESETS.some((p) => p.id === id)) return id
                void color
            }
        } catch {
            /* 忽略 */
        }
        return 'dark'
    })
    const [customBackdrop, setCustomBackdrop] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(BACKDROP_STORAGE_KEY)
            const color = saved?.split('|')[1]
            if (color && /^#[0-9a-f]{6}$/i.test(color)) return color
        } catch {
            /* 忽略 */
        }
        return '#2b3a2b'
    })
    const backdrop = useMemo(() => {
        const preset = BACKDROP_PRESETS.find((p) => p.id === backdropId) ?? BACKDROP_PRESETS[0]
        if (preset.id !== 'custom') return { a: preset.a, b: preset.b }
        return { a: customBackdrop, b: backdropPartner(customBackdrop) }
    }, [backdropId, customBackdrop])
    useEffect(() => {
        try {
            localStorage.setItem(BACKDROP_STORAGE_KEY, `${backdropId}|${customBackdrop}`)
        } catch {
            /* 忽略 */
        }
    }, [backdropId, customBackdrop])
    const lightBackdrop = isLightColor(backdrop.a)

    // ── 锚点 ──
    const [anchorEdit, setAnchorEdit] = useState(false)
    const [anchorOverride, setAnchorOverride] = useState<{
        pose: string
        main: HandAnchorData
        off: HandAnchorData
    } | null>(null)

    // ── 预览 ──
    const [charId, setCharId] = useState('yidao')
    /** 改过的角色配色（按角色 id；空 = 用 palette.ts 里登记的值） */
    const [colorOverrides, setColorOverrides] = useState<Record<string, Partial<CharacterColors>>>(
        () => saved?.colorOverrides ?? {},
    )
    /** 改过的固定槽位色（描边 1 / 白 7 / 金边 9；这几色不随角色变） */
    const [fixedSlotOverrides, setFixedSlotOverrides] = useState<Record<number, string>>(
        () => saved?.fixedSlotOverrides ?? {},
    )
    const [previewWeaponId, setPreviewWeaponId] = useState('peach_sword')

    // ── 历史 / 导入导出 ──
    const historyRef = useRef<{ past: PixelMap[]; future: PixelMap[] }>({ past: [], future: [] })
    const [, bumpHistory] = useState(0)
    const [pasteText, setPasteText] = useState('')
    const [status, setStatus] = useState(saved ? '已恢复上次的编辑内容（保存代码触发的整页刷新不会丢）' : '')
    const warnedTransparentRef = useRef(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    /** 当前编辑的数据（身体帧 / 武器图共用一套绘制与历史逻辑） */
    const active = mode === 'frame' ? map : weaponGrid
    /** 事件回调里读当前数据用（在 effect 里同步，避免渲染期写 ref） */
    const activeRef = useRef(active)
    useEffect(() => {
        activeRef.current = active
    }, [active])
    const setActive = useCallback(
        (next: PixelMap) => {
            if (mode === 'frame') setMap(next)
            else setWeaponGrid(next)
        },
        [mode],
    )

    const { width: gridW, height: gridH } = useMemo(() => frameSize(active), [active])
    const stats = useMemo(() => frameStats(active), [active])

    // ── 调色板 ──
    const themeMode = useAppStore((s) => s.uiConfig.theme)
    const outlineColor = getSpriteOutlineColor(getEffectiveTheme(themeMode))
    /** 当前角色的有效配色（登记值 + 编辑器里的改动） */
    const baseColors: CharacterColors = CHARACTER_COLORS[charId] ?? DEFAULT_COLORS
    const effectiveColors: CharacterColors = { ...baseColors, ...(colorOverrides[charId] ?? {}) }
    const colorOverridden =
        Object.keys(colorOverrides[charId] ?? {}).length > 0 || Object.keys(fixedSlotOverrides).length > 0
    const charPalette = useMemo(() => {
        const base = buildPalette(charId, undefined, outlineColor, effectiveColors)
        const out: Record<string, string> = { ...base }
        for (const [slot, color] of Object.entries(fixedSlotOverrides)) out[slot] = color
        return out
    }, [charId, outlineColor, effectiveColors, fixedSlotOverrides])
    const { palette: framePalette, missingSlots } = useMemo(() => {
        const missing: number[] = []
        const merged: Record<string, string> = { ...charPalette }
        for (const [k, color] of Object.entries(SLOT_FALLBACK_COLORS)) {
            if (!merged[k]) {
                merged[k] = color
                missing.push(Number(k))
            }
        }
        return { palette: merged, missingSlots: missing }
    }, [charPalette])
    /** 颜色查询：0 = 空 */
    const colorOf = (v: number): string | undefined => {
        if (v === 0) return undefined
        const c = mode === 'frame' ? framePalette[String(v)] : weaponPalette[v]
        return !c || c === 'transparent' ? undefined : c
    }
    /** 面板里露出的色块下标 */
    const slotList = mode === 'frame' ? FRAME_SLOT_ORDER : weaponPalette.map((_, i) => i).filter((i) => i > 0)

    // ── 自适应缩放（宽度和视口高度都要放得下）──
    const mainRef = useRef<HTMLDivElement>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const [avail, setAvail] = useState<{ w: number; h: number } | null>(null)
    useLayoutEffect(() => {
        const el = mainRef.current
        if (!el) return
        const measure = () => {
            const rect = el.getBoundingClientRect()
            const top = wrapRef.current?.getBoundingClientRect().top ?? rect.top
            const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight
            const w = Math.max(120, rect.width - 24)
            const h = Math.max(120, viewportH - top - 32)
            setAvail((prev) => (prev && Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        window.addEventListener('resize', measure)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [])
    const fitZoom = useMemo(() => {
        if (!avail) return DEFAULT_ZOOM
        return Math.max(ZOOM_MIN, Math.min(Math.floor(avail.w / gridW), Math.floor(avail.h / gridH), ZOOM_MAX))
    }, [avail, gridW, gridH])
    const autoFit = manualZoom === null
    const zoom = manualZoom ?? fitZoom

    // ── 锚点数据（身体帧模式）──
    const registeredAnchor = useMemo(() => {
        if (mode !== 'frame') return null
        const toPoint = (p: { x: number; y: number } | undefined) =>
            p ? { x: p.x - SPRITE_PAD_LEFT, y: p.y } : { x: 0, y: 0 }
        const toCover = (cells: [number, number][] | undefined): [number, number][] =>
            (cells ?? []).map(([x, y]) => [x - SPRITE_PAD_LEFT, y] as [number, number])
        if (!(poseName in HAND_POINTS) && !(poseName in HAND_COVER)) return null
        return {
            main: { point: toPoint(HAND_POINTS[poseName]), cover: toCover(HAND_COVER[poseName]) },
            off: { point: toPoint(OTHER_HAND_POINT[poseName]), cover: toCover(LEFT_HAND_COVER[poseName]) },
        }
    }, [mode, poseName])
    const anchorData = useMemo(() => {
        if (mode !== 'frame') return null
        if (anchorOverride && anchorOverride.pose === poseName) {
            return { main: anchorOverride.main, off: anchorOverride.off }
        }
        return registeredAnchor
    }, [mode, anchorOverride, poseName, registeredAnchor])
    const anchorDirty = Boolean(anchorOverride && anchorOverride.pose === poseName)
    const anchorMode = anchorEdit && Boolean(anchorData)
    const anchorCells = useMemo(() => {
        if (!anchorData) return { cover: [], grip: [] }
        const cover: { x: number; y: number; kind: 'main' | 'off' }[] = []
        for (const [x, y] of anchorData.main.cover) cover.push({ x, y, kind: 'main' })
        for (const [x, y] of anchorData.off.cover) cover.push({ x, y, kind: 'off' })
        return {
            cover,
            grip: [
                { x: Math.round(anchorData.main.point.x), y: Math.round(anchorData.main.point.y), kind: 'main' as const },
                { x: Math.round(anchorData.off.point.x), y: Math.round(anchorData.off.point.y), kind: 'off' as const },
            ],
        }
    }, [anchorData])
    const anchorSnippet = useMemo(
        () =>
            anchorData
                ? formatAnchorSnippet(poseName, anchorData.main, anchorData.off)
                : `// 姿势 ${poseName} 在 weapons.ts 里还没有登记锚点`,
        [anchorData, poseName],
    )

    // ── 画布绘制 ──
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
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

    // ── 绘制交互 ──
    const paintingRef = useRef(false)
    const lastCellRef = useRef<{ x: number; y: number } | null>(null)
    const anchorDragRef = useRef<{
        kind: 'main' | 'off'
        start: { x: number; y: number }
        main: HandAnchorData
        off: HandAnchorData
    } | null>(null)

    /**
     * 鼠标/指针事件 → 格坐标。用 offsetX/offsetY（相对 canvas 自身）+ clientWidth 换算：
     * 与元素在页面里的位置、滚动都无关，不会出现「点的位置漂移」。
     */
    const cellFromEvent = (e: {
        currentTarget: HTMLCanvasElement
        nativeEvent: { offsetX: number; offsetY: number }
    }): { x: number; y: number } | null => {
        const canvas = e.currentTarget
        const perCellX = (canvas.clientWidth || gridW * zoom) / gridW
        const perCellY = (canvas.clientHeight || gridH * zoom) / gridH
        const x = Math.floor(e.nativeEvent.offsetX / perCellX)
        const y = Math.floor(e.nativeEvent.offsetY / perCellY)
        if (x < 0 || x >= gridW || y < 0 || y >= gridH) return null
        return { x, y }
    }

    const beginStroke = () => {
        historyRef.current.past.push(cloneMap(activeRef.current))
        if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift()
        historyRef.current.future = []
        bumpHistory((v) => v + 1)
    }

    const applyCell = (c: { x: number; y: number }, from?: { x: number; y: number }) => {
        const value = tool === 'eraser' ? 0 : slot
        if (tool === 'fill') {
            setActive(fillRegion(activeRef.current, c.x, c.y, value))
            return
        }
        setActive(
            from
                ? paintLine(activeRef.current, from, c, value, { mirror })
                : paintCell(activeRef.current, c.x, c.y, value, { mirror }),
        )
    }

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const c = cellFromEvent(e)
        if (!c) return
        if (anchorMode && anchorData) {
            const kind = hitAnchor(anchorData.main, c, 1) ? 'main' : hitAnchor(anchorData.off, c, 1) ? 'off' : null
            if (!kind) return
            e.currentTarget.setPointerCapture(e.pointerId)
            anchorDragRef.current = { kind, start: c, main: anchorData.main, off: anchorData.off }
            return
        }
        if (tool === 'picker') {
            const picked = getCell(activeRef.current, c.x, c.y)
            setSlot(picked)
            setTool('pen')
            warnedTransparentRef.current = false
            setStatus(
                picked === 0
                    ? '吸管取到空白 —— 现在等于橡皮；想涂色请再选一个色块'
                    : `吸管取到 ${SLOT_LABELS[picked] ?? `颜色 ${picked}`}`,
            )
            return
        }
        if (tool === 'pen' && slot === 0 && !warnedTransparentRef.current) {
            warnedTransparentRef.current = true
            setStatus('当前是「透明」：涂上去就是擦掉')
        }
        e.currentTarget.setPointerCapture(e.pointerId)
        paintingRef.current = true
        beginStroke()
        applyCell(c)
        lastCellRef.current = c
    }

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const c = cellFromEvent(e)
        setHover(c)
        const drag = anchorDragRef.current
        if (anchorMode && drag) {
            if (!c) return
            const dx = c.x - drag.start.x
            const dy = c.y - drag.start.y
            const size = { w: gridW, h: gridH }
            setAnchorOverride({
                pose: poseName,
                main: drag.kind === 'main' ? moveAnchor(drag.main, dx, dy, size) : drag.main,
                off: drag.kind === 'off' ? moveAnchor(drag.off, dx, dy, size) : drag.off,
            })
            return
        }
        if (!paintingRef.current || !c) return
        const last = lastCellRef.current
        if (last && (last.x !== c.x || last.y !== c.y)) applyCell(c, last)
        else if (!last) applyCell(c)
        lastCellRef.current = c
    }

    const endStroke = () => {
        paintingRef.current = false
        lastCellRef.current = null
        anchorDragRef.current = null
    }

    const undo = useCallback(() => {
        const h = historyRef.current
        const prev = h.past.pop()
        if (!prev) return
        h.future.push(cloneMap(activeRef.current))
        setActive(prev)
        bumpHistory((v) => v + 1)
    }, [setActive])

    const redo = useCallback(() => {
        const h = historyRef.current
        const next = h.future.pop()
        if (!next) return
        h.past.push(cloneMap(activeRef.current))
        setActive(next)
        bumpHistory((v) => v + 1)
    }, [setActive])

    const selectSlot = useCallback((next: number) => {
        setSlot(next)
        warnedTransparentRef.current = false
    }, [])

    /** 载入（身体帧会识别渲染帧并裁掉留白；两种模式都回到「适应」并清空历史） */
    const loadMap = (next: PixelMap, note: string, palette?: string[]) => {
        historyRef.current = { past: [], future: [] }
        if (mode === 'frame') {
            const { map: normalized, cropped } = unpadRenderedFrame(next, SOURCE_W)
            setMap(cloneMap(normalized))
            setStatus(cropped ? `${note} —— 这是渲染帧（60 宽），已裁掉左侧 ${SPRITE_PAD_LEFT} 列留白` : note)
        } else {
            setWeaponGrid(cloneMap(next))
            if (palette) setWeaponPalette(palette)
            setStatus(note)
        }
        setManualZoom(null)
    }

    const switchMode = (next: EditorMode) => {
        if (next === mode) return
        setMode(next)
        setAnchorEdit(false)
        setAnchorOverride(null)
        setManualZoom(null)
        historyRef.current = { past: [], future: [] }
        setSlot(1)
        setPasteText('')
        setStatus(
            next === 'weapon'
                ? '武器图：32×32，颜色任选（调色板里可加/改/删）'
                : next === 'mount'
                  ? '武器挂点：拖动 = 移，Shift/右键拖 = 旋转；右下角可复制 WEAPON_POSES 片段'
                  : '身体帧：槽位 0~7、9',
        )
    }

    // ── 写本地存档（防抖 400ms；拖笔时不至于每格都写一次）──
    useEffect(() => {
        const payload: PixelEditorSavedState = {
            mode,
            frame: { map, constName, poseName, sourceKey },
            weapon: { id: weaponId, grid: weaponGrid, palette: weaponPalette },
            colorOverrides,
            fixedSlotOverrides,
            mountConfigs,
            tool,
            slot,
            mirror,
            showGrid,
            showAnchors,
            manualZoom,
        }
        const timer = window.setTimeout(() => {
            try {
                localStorage.setItem(EDITOR_STATE_KEY, serializeEditorState(payload))
            } catch {
                /* 存不下就算了，不影响编辑 */
            }
        }, 400)
        return () => window.clearTimeout(timer)
    }, [mode, map, constName, poseName, sourceKey, weaponId, weaponGrid, weaponPalette, colorOverrides, fixedSlotOverrides, mountConfigs, tool, slot, mirror, showGrid, showAnchors, manualZoom])

    // ── 快捷键 ──
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
            const mod = e.ctrlKey || e.metaKey
            if (mod && e.key.toLowerCase() === 'z') {
                e.preventDefault()
                if (e.shiftKey) redo()
                else undo()
                return
            }
            if (mod && e.key.toLowerCase() === 'y') {
                e.preventDefault()
                redo()
                return
            }
            if (mod) return
            const k = e.key.toLowerCase()
            if (k === 'b') setTool('pen')
            // E：画笔 ↔ 橡皮 一键来回切（和 PS 一样，不用鼠标去点按钮）
            else if (k === 'e') setTool((t) => (t === 'eraser' ? 'pen' : 'eraser'))
            else if (k === 'i') setTool('picker')
            else if (k === 'g') setTool('fill')
            else if (k === 'x') setMirror((v) => !v)
            else if (k === '[') selectSlot(Math.max(0, slot - 1))
            else if (k === ']') selectSlot(Math.min(SPRITE_MAX_SLOT, slot + 1))
            else if (/^[0-9]$/.test(k)) selectSlot(Number(k))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [undo, redo, selectSlot, slot])

    // ── 武器调色板操作 ──
    const addWeaponColor = () => {
        setSlot(weaponPalette.length)
        setWeaponPalette((p) => [...p, '#ffffff'])
        setStatus('已加一个颜色（用色块旁的取色器改成想要的颜色）')
    }
    const setWeaponColorAt = (idx: number, color: string) => {
        setWeaponPalette((p) => p.map((c, i) => (i === idx ? color : c)))
    }
    const removeWeaponColor = (idx: number) => {
        let used = false
        for (const row of weaponGrid) for (const v of row) if (v === idx) used = true
        if (used) {
            setStatus('这个颜色还在画布上用着，先把用它的格子擦掉或换色')
            return
        }
        setWeaponPalette((p) => p.filter((_, i) => i !== idx))
        if (slot === idx) setSlot(1)
        setStatus('已删掉这个颜色')
    }

    // ── 导入 / 导出 ──
    const importText = (text: string, source: string) => {
        if (mode === 'frame') {
            const parsed = parsePixelMap(text)
            if (!parsed.ok) {
                setStatus(`${source} 失败：${parsed.error}`)
                return
            }
            const size = frameSize(parsed.map)
            loadMap(parsed.map, `已载入 ${source}（${size.width}×${size.height}）`)
        } else {
            const parsed = parseWeaponOverlay(text, WEAPON_WIDTH, WEAPON_HEIGHT)
            if (!parsed.ok) {
                setStatus(`${source} 失败：${parsed.error}`)
                return
            }
            if (parsed.id) setWeaponId(parsed.id)
            loadMap(parsed.grid, `已载入 ${source}${parsed.id ? `（${parsed.id}）` : ''}`, parsed.palette)
        }
    }

    const importFile = async (file: File) => {
        try {
            importText(await file.text(), `文件 ${file.name}`)
        } catch (e) {
            setStatus(`导入 ${file.name} 失败：${(e as Error).message}`)
        }
    }

    const exported = useMemo(() => {
        if (mode === 'frame') return formatPixelMapSource(constName || 'DEFAULT_FRAME', map)
        return formatWeaponOverlaySnippet(weaponId, weaponGrid, weaponPalette)
    }, [mode, constName, map, weaponId, weaponGrid, weaponPalette])

    const copy = async (text: string, note: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setStatus(`${note}（已复制）`)
        } catch {
            setStatus(`${note}：剪贴板不可用，请从文本框手动复制`)
        }
    }

    const download = () => {
        const isFrame = mode === 'frame'
        const name = isFrame ? (constName || 'frame').toLowerCase() : weaponId
        const body = isFrame ? formatPixelMapJson(map) : weaponGridToJson(weaponGrid, weaponPalette)
        const blob = new Blob([body + '\n'], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${name}.json`
        a.click()
        URL.revokeObjectURL(url)
        setStatus(`已下载 ${name}.json（可直接再导入）`)
    }

    return (
        <div
            className="pixel-editor"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) void importFile(file)
            }}
        >
            {/* ── 左：工具栏 + 画布 + 预览（武器挂点模式换成实验台） ── */}
            <div className="pixel-editor-main" ref={mainRef}>
                {/* 模式切换：三种模式都常驻（挂点模式下也要能切回去） */}
                <div className="pixel-editor-row">
                        <div className="pixel-editor-seg">
                            <button
                                className={`pixel-editor-tool ${mode === 'frame' ? 'active' : ''}`}
                                title="编辑身体姿势帧（48×48，槽位色随角色配色）"
                                onClick={() => switchMode('frame')}
                            >
                                身体帧
                            </button>
                            <button
                                className={`pixel-editor-tool ${mode === 'weapon' ? 'active' : ''}`}
                                title="编辑武器图（32×32，颜色任选）"
                                onClick={() => switchMode('weapon')}
                            >
                                武器图
                            </button>
                            <button
                                className={`pixel-editor-tool ${mode === 'mount' ? 'active' : ''}`}
                                title="实验武器挂在身上哪里、倾角多少（不同动作不同），导出 WEAPON_POSES 片段"
                                onClick={() => switchMode('mount')}
                            >
                                武器挂点
                            </button>
                        </div>
                </div>
                {mode === 'mount' ? (
                    <WeaponMountPanel
                        configs={mountConfigs}
                        onChange={(w: string, slot: WeaponSlot, p: string, cfg: Partial<WeaponPoseConfig> | null) =>
                            setMountConfigs((prev) => {
                                const slots = {
                                    main: { ...(prev[w]?.main ?? {}) },
                                    off: { ...(prev[w]?.off ?? {}) },
                                }
                                if (cfg === null) delete slots[slot][p]
                                else slots[slot][p] = cfg
                                return { ...prev, [w]: slots }
                            })
                        }
                        charId={charId}
                        setStatus={setStatus}
                    />
                ) : (
                    <>
                <div className="pixel-editor-toolbar">
                    <div className="pixel-editor-row">
                        {TOOLS.map((t) => (
                            <button
                                key={t.id}
                                className={`pixel-editor-tool ${tool === t.id ? 'active' : ''}`}
                                title={
                                    t.id === 'pen'
                                        ? '画笔（B）；按 E 可与橡皮一键来回切'
                                        : t.id === 'eraser'
                                          ? '橡皮（E；再按一次 E 切回画笔；画布上右键也是擦除）'
                                          : `${t.label}（快捷键 ${t.key}）`
                                }
                                onClick={() => setTool(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                        <button
                            className={`pixel-editor-tool ${mirror ? 'active' : ''}`}
                            title="左右镜像同时落笔（X）"
                            onClick={() => setMirror((v) => !v)}
                        >
                            镜像
                        </button>
                        <button className="pixel-editor-tool" title="撤销（Ctrl+Z）" onClick={undo}>
                            撤销
                        </button>
                        <button className="pixel-editor-tool" title="重做（Ctrl+Shift+Z）" onClick={redo}>
                            重做
                        </button>
                        {mode === 'frame' && (
                            <>
                                <button
                                    className="pixel-editor-tool"
                                    title="给所有「身体像素贴着背景」的格子补描边（斜边、拐角不容易漏）"
                                    onClick={() => loadMap(autoOutline(activeRef.current), '已自动描边')}
                                >
                                    自动描边
                                </button>
                                <button
                                    className="pixel-editor-tool"
                                    title={`给整个剪影外侧加一层金边（槽位 ${SPRITE_AURA_SLOT}）`}
                                    onClick={() => loadMap(addAuraRing(activeRef.current), '已加一层金边')}
                                >
                                    加金边
                                </button>
                                <button
                                    className={`pixel-editor-tool ${anchorEdit ? 'active' : ''}`}
                                    title="开启后画布上拖动的是手部锚点（青=主手、黄=副手），不涂像素"
                                    onClick={() => {
                                        setAnchorEdit((v) => !v)
                                        setShowAnchors(true)
                                    }}
                                >
                                    拖锚点
                                </button>
                            </>
                        )}
                        <button
                            className="pixel-editor-tool"
                            title="清空成透明"
                            onClick={() => loadMap(blankPixelMap(gridW, gridH), '已清空')}
                        >
                            清空
                        </button>
                    </div>

                    <div className="pixel-editor-row">
                        <label className="pixel-editor-toggle" title="显示像素网格">
                            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                            网格
                        </label>
                        {mode === 'frame' && (
                            <label className="pixel-editor-toggle" title="显示该姿势的手部遮罩格与握点（青=主手、黄=副手）">
                                <input
                                    type="checkbox"
                                    checked={showAnchors || anchorEdit}
                                    onChange={(e) => setShowAnchors(e.target.checked)}
                                />
                                锚点
                            </label>
                        )}
                        <label className="pixel-editor-zoom" title="每像素格的显示尺寸；拖动后转手动，「适应」恢复自动">
                            缩放
                            <input
                                type="range"
                                min={ZOOM_MIN}
                                max={ZOOM_MAX}
                                step={1}
                                value={zoom}
                                onChange={(e) => setManualZoom(Number(e.target.value))}
                            />
                            <span>{zoom}x</span>
                        </label>
                        <button
                            className={`pixel-editor-tool ${autoFit ? 'active' : ''}`}
                            title="按可用区域取最大整数倍（画布铺满可视区）"
                            onClick={() => setManualZoom(null)}
                        >
                            适应
                        </button>
                        <label className="pixel-editor-backdrop" title="画布底板色系（透明区的棋盘底色，方便看对比度）">
                            底板
                            <select value={backdropId} onChange={(e) => setBackdropId(e.target.value)}>
                                {BACKDROP_PRESETS.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                            {backdropId === 'custom' && (
                                <input
                                    type="color"
                                    value={customBackdrop}
                                    title="自定义底板基色（另一格自动提亮/压暗）"
                                    onChange={(e) => setCustomBackdrop(e.target.value)}
                                />
                            )}
                        </label>
                        {/* 读数：锚点模式 / 画笔模式共用一格，固定高度，切换不改变布局 */}
                        <span className={`pixel-editor-readout ${anchorMode ? 'anchor' : slot === 0 ? 'warn' : ''}`}>
                            {anchorMode && anchorData ? (
                                <>
                                    锚点：主手 ({anchorData.main.point.x}, {anchorData.main.point.y}) · 副手 (
                                    {anchorData.off.point.x}, {anchorData.off.point.y}){anchorDirty ? ' · 已改动' : ''}
                                </>
                            ) : (
                                <>
                                    <span
                                        className="pixel-editor-swatch-color"
                                        style={{ background: colorOf(slot) ?? 'transparent' }}
                                    />
                                    {TOOLS.find((t) => t.id === tool)?.label} · {SLOT_LABELS[slot] ?? `颜色 ${slot}`}
                                    {slot === 0 ? '（＝橡皮）' : ''}
                                </>
                            )}
                        </span>
                    </div>

                    <p className="pixel-editor-status">
                        {status || '\u00a0'}
                        {avail && gridW * zoom > avail.w && !autoFit ? '（画布比可视区宽：可滚动，或点「适应」）' : ''}
                    </p>
                </div>

                <div className="pixel-editor-canvas-wrap" ref={wrapRef}>
                    <canvas
                        ref={canvasRef}
                        width={gridW * zoom}
                        height={gridH * zoom}
                        style={{ width: gridW * zoom, height: gridH * zoom }}
                        className={`pixel-editor-canvas${anchorMode ? ' pixel-editor-canvas--anchor' : ''}`}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={endStroke}
                        onPointerLeave={() => {
                            endStroke()
                            setHover(null)
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault()
                            const c = cellFromEvent(e)
                            if (!c || anchorMode) return
                            beginStroke()
                            setActive(paintCell(activeRef.current, c.x, c.y, 0, { mirror: false }))
                        }}
                    />
                </div>

                <div className="pixel-editor-info" title="栅格 / 画布 / 像素统计（只做显示）">
                    <span>
                        {stats.width}×{stats.height}
                        {mode === 'frame' ? `（渲染 ${SPRITE_WIDTH}×${SPRITE_HEIGHT}）` : '（武器网格）'}
                    </span>
                    <span>
                        画布 {gridW * zoom}×{gridH * zoom} · {zoom}x{autoFit ? '（适应）' : ''}
                    </span>
                    {mode === 'frame' && (
                        <span>
                            描边 {stats.outline} / 身体 {stats.body} / 金边 {stats.aura}
                        </span>
                    )}
                </div>

                <div className="pixel-editor-preview-row">
                    <span
                        className="pixel-editor-preview-label"
                        title={
                            mode === 'frame'
                                ? '预览：身体帧按 60×48 渲染（补左侧留白）并挂上预览武器'
                                : '预览：武器原图（32×32），与游戏里的角度/握点无关'
                        }
                    >
                        预览
                    </span>
                    {mode === 'frame' ? (
                        <PixelCanvas
                            pixels={padForPreview(map)}
                            palette={framePalette}
                            scale={3}
                            pose={poseName}
                            weaponId={previewWeaponId}
                            overlay={WEAPON_OVERLAYS[previewWeaponId]}
                            // 与「像素图测试」同视口：120×54，人偏右，挥砍时不裁武器
                            canvasCols={120}
                            canvasRows={54}
                            contentOffsetX={45}
                            className="pixel-editor-preview-canvas"
                        />
                    ) : (
                        <PixelCanvas
                            pixels={weaponGrid}
                            palette={Object.fromEntries(
                                weaponPalette.map((c, i) => [String(i), c || 'transparent']),
                            )}
                            scale={5}
                            canvasCols={WEAPON_WIDTH}
                            canvasRows={WEAPON_HEIGHT}
                            contentOffsetX={0}
                            className="pixel-editor-preview-canvas pixel-editor-preview-canvas--weapon"
                        />
                    )}
                </div>
                    </>
                )}
            </div>

            {/* ── 右：设置面板（说明都在 tooltip 里）；武器挂点模式自带全套控件，右栏整个让开 ── */}
            {mode !== 'mount' && (
            <aside className="pixel-editor-side">
                <section className="pixel-editor-panel">
                    {mode === 'frame' ? (
                        <>
                            <div className="pixel-editor-field" title="载入现成的帧当底稿（源图 48×48）">
                                <span>底稿</span>
                                <SearchSelect
                                    value={sourceKey}
                                    options={BUILTIN_FRAMES.map((f) => ({ value: f.key, label: f.label }))}
                                    onChange={(key) => {
                                        setSourceKey(key)
                                        const found = BUILTIN_FRAMES.find((f) => f.key === key)
                                        if (!found) return
                                        setPoseName(found.key)
                                        setConstName(`DEFAULT_${found.key.toUpperCase()}`)
                                        loadMap(found.map, `已载入内置帧 ${key}`)
                                    }}
                                    searchPlaceholder="搜索帧…"
                                />
                            </div>
                            <div className="pixel-editor-field" title="锚点与预览使用哪个姿势；导出锚点片段也用它">
                                <span>姿势</span>
                                <select value={poseName} onChange={(e) => setPoseName(e.target.value)}>
                                    {POSE_NAMES.map((p) => (
                                        <option key={p} value={p}>
                                            {p}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="pixel-editor-field" title="导出片段的常量名">
                                <span>常量名</span>
                                <input
                                    type="text"
                                    value={constName}
                                    onChange={(e) => setConstName(e.target.value)}
                                    spellCheck={false}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="pixel-editor-field" title="载入已有武器美术当底稿（32×32）">
                            <span>武器</span>
                            <SearchSelect
                                value={weaponId}
                                options={WEAPON_IDS_WITH_ART.map((id) => ({ value: id, label: WEAPON_NAME[id] ?? id }))}
                                onChange={(id) => {
                                    setWeaponId(id)
                                    const { grid, palette } = weaponOverlayToGrid(id)
                                    loadMap(grid, `已载入武器「${WEAPON_NAME[id] ?? id}」`, palette)
                                }}
                                searchPlaceholder="搜索武器…"
                            />
                        </div>
                    )}
                </section>

                <section className="pixel-editor-panel">
                    <h3
                        title={
                            mode === 'frame'
                                ? '槽位：颜色含义由角色配色决定，数字就是导出的槽位号'
                                : '自由配色：颜色随便加，导出时写进武器的 palette'
                        }
                    >
                        调色板
                    </h3>
                    <div className="pixel-editor-palette">
                        {slotList.map((i) => (
                            <span key={i} className="pixel-editor-swatch-wrap">
                                <button
                                    className={`pixel-editor-swatch ${slot === i ? 'active' : ''}`}
                                    title={
                                        mode === 'frame'
                                            ? (SLOT_TIPS[i] ?? `槽位 ${i}`)
                                            : `颜色 ${i}（${weaponPalette[i] ?? ''}）`
                                    }
                                    onClick={() => selectSlot(i)}
                                >
                                    <span
                                        className="pixel-editor-swatch-color"
                                        style={{ background: colorOf(i) ?? 'transparent' }}
                                    />
                                    {mode === 'frame' && (
                                        <span className="pixel-editor-swatch-label">{SLOT_LABELS[i] ?? i}</span>
                                    )}
                                </button>
                                {mode === 'frame' && !SLOT_TO_COLOR_KEY[i] && i !== 0 && (
                                    <span className="pixel-editor-swatch-tools">
                                        <input
                                            type="color"
                                            title={`改「${SLOT_LABELS[i]}」的颜色（槽位 ${i}；只影响编辑器预览）`}
                                            value={colorOf(i) ?? '#000000'}
                                            onChange={(e) =>
                                                setFixedSlotOverrides((prev) => ({ ...prev, [i]: e.target.value }))
                                            }
                                        />
                                    </span>
                                )}
                                {mode === 'frame' && SLOT_TO_COLOR_KEY[i] && (
                                    <span className="pixel-editor-swatch-tools">
                                        <input
                                            type="color"
                                            title={`改「${SLOT_LABELS[i]}」的颜色（只影响编辑器预览；用下面的「复制配色片段」落回 palette.ts）`}
                                            value={effectiveColors[SLOT_TO_COLOR_KEY[i]]}
                                            onChange={(e) =>
                                                setColorOverrides((prev) => ({
                                                    ...prev,
                                                    [charId]: { ...prev[charId], [SLOT_TO_COLOR_KEY[i]]: e.target.value },
                                                }))
                                            }
                                        />
                                    </span>
                                )}
                                {mode === 'weapon' && (
                                    <span className="pixel-editor-swatch-tools">
                                        <input
                                            type="color"
                                            title="改这个颜色"
                                            value={
                                                /^#[0-9a-f]{6}$/i.test(weaponPalette[i] ?? '')
                                                    ? (weaponPalette[i] as string)
                                                    : '#ffffff'
                                            }
                                            onChange={(e) => setWeaponColorAt(i, e.target.value)}
                                        />
                                        <button title="删掉这个颜色（没在用才可以删）" onClick={() => removeWeaponColor(i)}>
                                            ×
                                        </button>
                                    </span>
                                )}
                            </span>
                        ))}
                        {mode === 'weapon' && (
                            <button className="pixel-editor-tool" title="加一个颜色" onClick={addWeaponColor}>
                                + 加色
                            </button>
                        )}
                    </div>
                    {mode === 'frame' && missingSlots.length > 0 && (
                        <p className="pixel-editor-warn">
                            角色调色板缺槽位 {missingSlots.join('/')}，已用兜底色（刷新页面即可）
                        </p>
                    )}
                    {mode === 'frame' && (
                        <div className="pixel-editor-field" title="配色预览：槽位色随角色变化；发色/皮肤/瞳色/衣物/装饰都可以改">
                            <span>角色配色</span>
                            <SearchSelect
                                value={charId}
                                options={CHARACTER_IDS.map((id) => ({ value: id, label: NAME_BY_ID[id] ?? id }))}
                                onChange={setCharId}
                                searchPlaceholder="搜索角色…"
                            />
                        </div>
                    )}
                    {mode === 'frame' && (
                        <div className="pixel-editor-row">
                            <span
                                className="pixel-editor-colorline"
                                title="改过的角色配色（发色等）；没改过的槽位维持 palette.ts 的登记值"
                            >
                                {colorOverridden ? '配色已改动' : '配色＝palette.ts 登记值'}
                            </span>
                            <button
                                className="pixel-editor-btn"
                                title="复制这段粘进 palette.ts 的 CHARACTER_COLORS，改色就落到代码里"
                                onClick={() =>
                                    copy(formatCharacterColorsSnippet(charId, effectiveColors), '配色片段已复制')
                                }
                            >
                                复制配色片段
                            </button>
                            <button
                                className="pixel-editor-btn"
                                disabled={!colorOverridden}
                                title="丢弃本角色的改色，回到 palette.ts 的登记值"
                                onClick={() => {
                                    setColorOverrides((prev) => {
                                        const next = { ...prev }
                                        delete next[charId]
                                        return next
                                    })
                                    setFixedSlotOverrides({})
                                    setStatus(`「${NAME_BY_ID[charId] ?? charId}」的配色已恢复为 palette.ts 的登记值`)
                                }}
                            >
                                重置配色
                            </button>
                        </div>
                    )}
                    {mode === 'frame' && (
                        <details className="pixel-editor-code">
                            <summary title="展开看配色对应的 palette.ts 文本（剪贴板不可用时从这里手动复制）">
                                查看配色代码
                            </summary>
                            <textarea
                                className="pixel-editor-textarea pixel-editor-textarea--export"
                                readOnly
                                rows={1}
                                value={formatCharacterColorsSnippet(charId, effectiveColors)}
                            />
                            {Object.keys(fixedSlotOverrides).length > 0 && (
                                <textarea
                                    className="pixel-editor-textarea pixel-editor-textarea--export"
                                    readOnly
                                    rows={3}
                                    title="固定槽位（描边/白/金边）改动的落点：palette.ts 的 buildPalette / 主题描边常量"
                                    value={[
                                        `// palette.ts · buildPalette 里的固定槽位`,
                                        `'1': '${colorOf(1) ?? '#000000'}', '7': '${colorOf(7) ?? '#ffffff'}', '9': '${colorOf(9) ?? '#ffd24a'}',`,
                                        `// 描边想换：改 SPRITE_OUTLINE_LIGHT（浅色主题）/ SPRITE_OUTLINE_DARK（深色主题）`,
                                    ].join('\n')}
                                />
                            )}
                        </details>
                    )}
                    {mode === 'frame' && (
                        <div className="pixel-editor-field" title="预览里挂的武器">
                            <span>预览武器</span>
                            <SearchSelect
                                value={previewWeaponId}
                                options={Object.keys(WEAPON_OVERLAYS).map((id) => ({
                                    value: id,
                                    label: WEAPON_NAME[id] ?? id,
                                }))}
                                onChange={setPreviewWeaponId}
                                searchPlaceholder="搜索武器…"
                            />
                        </div>
                    )}
                </section>

                <section className="pixel-editor-panel">
                    <h3
                        title={
                            mode === 'frame'
                                ? '导入：粘贴 sprites.ts 的整段或导出的 JSON（也可把 .json/.txt 拖到页面上）｜导出：TS 片段可直接替换 sprites.ts 的常量'
                                : '导入：粘贴武器条目 { pixels, palette }｜导出：片段可直接粘进 WEAPON_OVERLAYS'
                        }
                    >
                        导入 / 导出
                    </h3>
                    <textarea
                        className="pixel-editor-textarea"
                        placeholder={
                            mode === 'frame'
                                ? '粘贴一张图的 [[...]]（或 export const X: PixelMap = [...]）'
                                : '粘贴武器条目：{ pixels: [[x,y,色]], palette: {...} }'
                        }
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        rows={3}
                    />
                    <div className="pixel-editor-row">
                        <button className="pixel-editor-btn" onClick={() => importText(pasteText, '粘贴内容')}>
                            载入粘贴
                        </button>
                        <button className="pixel-editor-btn" onClick={() => fileInputRef.current?.click()}>
                            导入文件
                        </button>
                        <button
                            className="pixel-editor-btn"
                            title={mode === 'frame' ? '新建空白 48×48 身体帧' : '新建空白 32×32 武器图'}
                            onClick={() =>
                                loadMap(
                                    blankPixelMap(
                                        mode === 'frame' ? SOURCE_W : WEAPON_WIDTH,
                                        mode === 'frame' ? SOURCE_H : WEAPON_HEIGHT,
                                    ),
                                    '已新建空白图',
                                    mode === 'weapon' ? [''] : undefined,
                                )
                            }
                        >
                            空白
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json,text/plain"
                            className="pixel-editor-file"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) void importFile(file)
                                e.target.value = ''
                            }}
                        />
                    </div>

                    <div className="pixel-editor-row">
                        <button
                            className="pixel-editor-btn"
                            title="复制导出片段"
                            onClick={() => copy(exported, mode === 'frame' ? 'TS 片段已复制' : '武器片段已复制')}
                        >
                            复制片段
                        </button>
                        {mode === 'frame' && (
                            <>
                                <button
                                    className="pixel-editor-btn"
                                    onClick={() => copy(formatPixelMapLiteral(map), '数组已复制')}
                                >
                                    复制数组
                                </button>
                                <button
                                    className="pixel-editor-btn"
                                    onClick={() => copy(stringifyPixelMap(map), '单行 JSON 已复制')}
                                >
                                    单行 JSON
                                </button>
                            </>
                        )}
                        <button className="pixel-editor-btn" onClick={download}>
                            下载 .json
                        </button>
                        <button
                            className="pixel-editor-btn"
                            title="清掉本地存档并回到默认状态（默认身体帧 buff + 默认武器）。平时不用点：保存代码触发的整页刷新会自动恢复"
                            onClick={() => {
                                try {
                                    localStorage.removeItem(EDITOR_STATE_KEY)
                                } catch {
                                    /* 忽略 */
                                }
                                setMap(cloneMap(DEFAULT_BUFF))
                                setPoseName('buff')
                                setConstName('DEFAULT_BUFF')
                                setSourceKey('buff')
                                const d = weaponOverlayToGrid(firstWeaponId)
                                setWeaponId(firstWeaponId)
                                setWeaponGrid(d.grid)
                                setWeaponPalette(d.palette)
                                setSlot(1)
                                setManualZoom(null)
                                setColorOverrides({})
                                setFixedSlotOverrides({})
                                historyRef.current = { past: [], future: [] }
                                setStatus('已清掉本地存档，回到默认状态')
                            }}
                        >
                            清存档
                        </button>
                    </div>
                    <details className="pixel-editor-code">
                        <summary title="展开看导出的代码文本（上面的按钮已经能直接复制，这里只是方便手动查看/复制）">
                            查看代码
                        </summary>
                        <textarea
                            className="pixel-editor-textarea pixel-editor-textarea--export"
                            readOnly
                            value={exported}
                            rows={7}
                        />
                    </details>
                </section>

                {mode === 'frame' && (
                    <details className="pixel-editor-panel" open={anchorEdit}>
                        <summary title="手部锚点决定武器挂在哪：握点 + 2×2 遮罩格，对应 weapons.ts 的四张表">
                            手部锚点{anchorDirty ? '（已改动）' : ''}
                        </summary>
                        <div className="pixel-editor-row">
                            <button
                                className={`pixel-editor-btn ${anchorEdit ? 'active' : ''}`}
                                onClick={() => {
                                    setAnchorEdit((v) => !v)
                                    setShowAnchors(true)
                                }}
                            >
                                {anchorEdit ? '正在拖动' : '拖动锚点'}
                            </button>
                            <button
                                className="pixel-editor-btn"
                                title="把两边锚点吸到最近的 2×2 皮肤块"
                                onClick={() => {
                                    if (!anchorData) return
                                    const m = activeRef.current
                                    const main = snapAnchorToSkin(m, anchorData.main)
                                    const off = snapAnchorToSkin(m, anchorData.off)
                                    if (!main && !off) {
                                        setStatus('没找到 2×2 皮肤块 —— 先把手画出来（槽位「皮肤」）')
                                        return
                                    }
                                    setAnchorOverride({
                                        pose: poseName,
                                        main: main ?? anchorData.main,
                                        off: off ?? anchorData.off,
                                    })
                                    setStatus('已吸附到最近的皮肤块')
                                }}
                            >
                                吸附到皮肤
                            </button>
                            <button
                                className="pixel-editor-btn"
                                disabled={!anchorDirty}
                                onClick={() => {
                                    setAnchorOverride(null)
                                    setStatus('已恢复 weapons.ts 的登记值')
                                }}
                            >
                                重置
                            </button>
                        </div>
                        <button className="pixel-editor-btn" onClick={() => copy(anchorSnippet, '锚点片段已复制')}>
                            复制锚点片段
                        </button>
                        <details className="pixel-editor-code">
                            <summary title="展开看 weapons.ts 的四张表片段（剪贴板不可用时手动复制）">查看锚点代码</summary>
                            <textarea
                                className="pixel-editor-textarea pixel-editor-textarea--export"
                                readOnly
                                value={anchorSnippet}
                                rows={6}
                            />
                        </details>
                    </details>
                )}
            </aside>
            )}
        </div>
    )
}
