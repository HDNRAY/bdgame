import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    POSE_NAMES,
    SPRITE_HEIGHT,
    SPRITE_PAD_LEFT,
    SPRITE_WIDTH,
    WEAPON_HEIGHT,
    WEAPON_WIDTH,
    addAuraRing,
    autoOutline,
    blankPixelMap,
    formatPixelMapJson,
    formatPixelMapLiteral,
    formatPixelMapSource,
    formatSharedPaletteSnippet,
    formatWeaponEntrySnippet,
    formatWeaponArtSnippet,
    formatWeaponOverlaySnippet,
    frameSize,
    frameStats,
    parsePixelMap,
    parseWeaponArtSnippet,
    snapAnchorToSkin,
    stringifyPixelMap,
    unpadRenderedFrame,
} from '../../../pixel-sprites'
import type { PixelEditorSavedState, PixelMap } from '../../../pixel-sprites'
import { DEFAULT_BUFF } from '../../../pixel-sprites/sprites'
import type { CharacterColors } from '../../../pixel-sprites/palette'
import { WeaponMountPanel } from './WeaponMountPanel'
import { AnchorPanel } from './editor/AnchorPanel'
import { EditorPreview } from './editor/EditorPreview'
import { EditorToolbar } from './editor/EditorToolbar'
import { useBackdrop } from './editor/hooks/useBackdrop'
import { useCanvasRenderer } from './editor/hooks/useCanvasRenderer'
import { useCanvasPainting } from './editor/hooks/useCanvasPainting'
import { useEditHistory } from './editor/hooks/useEditHistory'
import { useEditorAutosave } from './editor/hooks/useEditorAutosave'
import { useEditorHotkeys } from './editor/hooks/useEditorHotkeys'
import { useEditorPalette } from './editor/hooks/useEditorPalette'
import { useEditorZoom } from './editor/hooks/useEditorZoom'
import { useFrameAnchors } from './editor/hooks/useFrameAnchors'
import type { AnchorOverride } from './editor/hooks/useFrameAnchors'
import { ExportBar } from './editor/ExportBar'
import { PalettePanel } from './editor/PalettePanel'
import { PoseArtBar } from './editor/PoseArtBar'
import { SourcePanel } from './editor/SourcePanel'
import type { WeaponPoseConfig, WeaponSlot } from '../../../pixel-sprites'
import {
    BUILTIN_FRAMES,
    EDITOR_STATE_KEY,
    FRAME_SLOT_ORDER,
    SOURCE_H,
    SOURCE_W,
    WEAPON_BASE_SLOT,
    WEAPON_IDS_WITH_ART,
    WEAPON_NAME,
} from './editor/constants'
import type { EditorMode, Tool } from './editor/constants'
import {
    canPasteInto,
    cloneMap,
    firstFreeSlot,
    gridHasPixels,
    initialWeaponView,
    readSavedState,
    removeWeaponPaletteColor,
    weaponArtToGrids,
    weaponGridToJson,
} from './editor/utils'

import './PixelEditor.scss'

export function PixelEditor() {
    // 只读一次：用它作为各 state 的初值
    const saved = useMemo(() => readSavedState(), [])
    const [mode, setMode] = useState<EditorMode>(saved?.mode ?? 'frame')
    /** 武器挂点实验：武器 id → 姿势 → 改过的配置（空 = 用武器文件里登记的挂点） */
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

    // ── 武器图（通用图 + 六个姿势，共用一份 palette）──
    const firstWeaponId = WEAPON_IDS_WITH_ART[0] ?? 'dark_iron_sword'
    // 只算一次：文件是底色，存档只盖它真记过的槽（老存档不再把六个姿势清空，见 initialWeaponView）
    const initialWeapon = useMemo(() => initialWeaponView(saved, firstWeaponId), [saved, firstWeaponId])
    const [weaponId, setWeaponId] = useState(initialWeapon.id)
    /** 通用图（武器文件里的 overlay:） */
    const [weaponGrid, setWeaponGrid] = useState<PixelMap>(() => initialWeapon.grid)
    /** 逐姿势美术：六个槽始终存在（全 0 = 那个姿势没画，渲染时坍缩） */
    const [weaponPoses, setWeaponPoses] = useState<Record<string, PixelMap>>(() => initialWeapon.poses)
    /** 当前编辑的槽：'base' = 通用图（overlay），其余是姿势名 */
    const [weaponPose, setWeaponPose] = useState<string>(saved?.weapon.pose ?? WEAPON_BASE_SLOT)
    const [weaponPalette, setWeaponPalette] = useState<string[]>(() => initialWeapon.palette)
    const weaponPaletteRef = useRef(weaponPalette)
    useEffect(() => {
        weaponPaletteRef.current = weaponPalette
    }, [weaponPalette])

    // ── 工具/颜色 ──
    const [tool, setTool] = useState<Tool>(saved?.tool ?? 'pen')
    const [slot, setSlot] = useState(saved?.slot ?? 1)
    const [mirror, setMirror] = useState(saved?.mirror ?? false)
    const [manualZoom, setManualZoom] = useState<number | null>(saved?.manualZoom ?? null)
    const [showGrid, setShowGrid] = useState(saved?.showGrid ?? true)
    const [showAnchors, setShowAnchors] = useState(saved?.showAnchors ?? true)
    const { backdropId, setBackdropId, customBackdrop, setCustomBackdrop, backdrop, lightBackdrop } =
        useBackdrop()

    // ── 锚点 ──
    const [anchorEdit, setAnchorEdit] = useState(false)
    const [anchorOverride, setAnchorOverride] = useState<AnchorOverride | null>(null)

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
    const [pasteText, setPasteText] = useState('')
    const [status, setStatus] = useState(saved ? '已恢复上次的编辑内容（保存代码触发的整页刷新不会丢）' : '')
    const warnedTransparentRef = useRef(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    /** 武器模式当前槽的图（画布 / 预览 / 下载共用） */
    const weaponSlotGrid = weaponPose === WEAPON_BASE_SLOT ? weaponGrid : weaponPoses[weaponPose]
    /** 当前编辑的数据（身体帧 / 武器图共用一套绘制与历史逻辑）；武器模式跟随当前槽（通用图或某个姿势） */
    const active = mode === 'frame' ? map : weaponSlotGrid
    /** 事件回调里读当前数据用（在 effect 里同步，避免渲染期写 ref） */
    const activeRef = useRef(active)
    useEffect(() => {
        activeRef.current = active
    }, [active])
    const setActive = useCallback(
        (next: PixelMap) => {
            if (mode === 'frame') setMap(next)
            else if (weaponPose === WEAPON_BASE_SLOT) setWeaponGrid(next)
            else setWeaponPoses((prev) => ({ ...prev, [weaponPose]: next }))
        },
        [mode, weaponPose],
    )

    const { width: gridW, height: gridH } = useMemo(() => frameSize(active), [active])
    const stats = useMemo(() => frameStats(active), [active])

    // ── 调色板 ──
    const { effectiveColors, colorOverridden, framePalette, missingSlots } = useEditorPalette(
        charId,
        colorOverrides,
        fixedSlotOverrides,
    )
    /** 颜色查询：0 = 空 */
    const colorOf = (v: number): string | undefined => {
        if (v === 0) return undefined
        const c = mode === 'frame' ? framePalette[String(v)] : weaponPalette[v]
        return !c || c === 'transparent' ? undefined : c
    }
    /** 面板里露出的色块下标 */
    const slotList = mode === 'frame' ? FRAME_SLOT_ORDER : weaponPalette.map((_, i) => i).filter((i) => i > 0)

    // ── 自适应缩放（宽度和视口高度都要放得下）──
    const { mainRef, wrapRef, avail, autoFit, zoom } = useEditorZoom(gridW, gridH, manualZoom)

    // ── 锚点数据（身体帧模式）──
    const { anchorData, anchorDirty, anchorMode, anchorCells, anchorSnippet } = useFrameAnchors(
        mode,
        poseName,
        anchorEdit,
        anchorOverride,
    )

    // ── 画布绘制 ──
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
    useCanvasRenderer({
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
    })

    const { pushHistory, beginStroke, undo, redo, resetHistory } = useEditHistory(
        activeRef,
        weaponPaletteRef,
        setActive,
        setWeaponPalette,
    )

    // ── 绘制交互 ──
    const { onPointerDown, onPointerMove, endStroke, onPointerLeave, onContextMenu } = useCanvasPainting({
        gridW,
        gridH,
        zoom,
        tool,
        slot,
        mirror,
        anchorMode,
        anchorData,
        poseName,
        activeRef,
        warnedTransparentRef,
        setHover,
        setActive,
        setSlot,
        setTool,
        setStatus,
        setAnchorOverride,
        beginStroke,
    })

    /** 整体平移当前槽的武器图（所有已画的像素一起挪；挪出画布的点丢弃） */
    const nudgeWeapon = useCallback(
        (dx: number, dy: number) => {
            pushHistory()
            const src = activeRef.current
            const w = src[0]?.length ?? 0
            const next = src.map((row) => row.map(() => 0))
            for (let y = 0; y < src.length; y++) {
                for (let x = 0; x < w; x++) {
                    const v = src[y][x]
                    if (!v) continue
                    const nx = x + dx
                    const ny = y + dy
                    if (nx < 0 || ny < 0 || ny >= next.length || nx >= w) continue
                    next[ny][nx] = v
                }
            }
            setActive(next)
        },
        [pushHistory, setActive],
    )

    const selectSlot = useCallback((next: number) => {
        setSlot(next)
        warnedTransparentRef.current = false
    }, [])

    /** 切换武器图编辑的槽：各槽是独立 state，当前内容留在原槽（不串）；历史清空，避免跨槽撤销串图 */
    const switchWeaponPose = (next: string) => {
        if (next === weaponPose) return
        setWeaponPose(next)
        resetHistory()
        setStatus(
            next === WEAPON_BASE_SLOT
                ? '通用图（overlay）：没有逐姿势美术时，所有姿势都用它'
                : `正在编辑「${next}」姿势的美术${
                      gridHasPixels(weaponPoses[next]) ? '' : '（还没画 —— 渲染时坍缩到 idle，再坍缩到通用图）'
                  }`,
        )
    }

    /** 姿势按钮上的「已 / 未」：槽里有像素 = 已画 */
    const filledPoses = useMemo(() => {
        const out: Record<string, boolean> = {}
        for (const pose of POSE_NAMES) out[pose] = gridHasPixels(weaponPoses[pose])
        return out
    }, [weaponPoses])

    // ── 复制 / 粘贴（编辑器内部剪贴板，不走系统剪贴板）──
    /** 当前槽那张图的副本；跨槽、跨模式都留着（复制 idle → 切到 attack → 粘贴） */
    const clipboardRef = useRef<PixelMap | null>(null)

    const copyCurrent = useCallback(() => {
        const src = activeRef.current
        clipboardRef.current = cloneMap(src)
        setStatus(`已复制当前图（${src[0]?.length ?? 0}×${src.length}）—— 切到别的槽按 Ctrl+V 粘贴`)
    }, [])

    const pasteClipboard = useCallback(() => {
        const clip = clipboardRef.current
        if (!clip) {
            setStatus('剪贴板是空的 —— 先按 Ctrl+C（或点「复制」）复制一张图')
            return
        }
        const target = activeRef.current
        if (!canPasteInto(clip, target)) {
            setStatus(
                `粘贴的图是 ${clip[0]?.length ?? 0}×${clip.length}，当前槽是 ` +
                    `${target[0]?.length ?? 0}×${target.length} —— 尺寸不同，只支持同尺寸粘贴`,
            )
            return
        }
        pushHistory()
        setActive(cloneMap(clip))
        setStatus(`已粘贴（${clip[0]?.length ?? 0}×${clip.length}）—— Ctrl+Z 可撤销`)
    }, [pushHistory, setActive])

    /** 清空本站势：清空后该槽触发坍缩（渲染走 idle / 通用图，导出也不写这块） */
    const clearCurrentPose = () => {
        pushHistory()
        const blank = blankPixelMap(WEAPON_WIDTH, WEAPON_HEIGHT)
        if (weaponPose === WEAPON_BASE_SLOT) {
            setWeaponGrid(blank)
            setStatus('已清空通用图')
            return
        }
        setWeaponPoses((prev) => ({ ...prev, [weaponPose]: blank }))
        setStatus(`已清空「${weaponPose}」—— 该姿势渲染时坍缩到 idle / 通用图，导出也不写这一块`)
    }

    /** 载入（身体帧会识别渲染帧并裁掉留白；两种模式都回到「适应」并清空历史） */
    const loadMap = (next: PixelMap, note: string, palette?: string[]) => {
        resetHistory()
        if (mode === 'frame') {
            const { map: normalized, cropped } = unpadRenderedFrame(next, SOURCE_W)
            setMap(cloneMap(normalized))
            setStatus(cropped ? `${note} —— 这是渲染帧（60 宽），已裁掉左侧 ${SPRITE_PAD_LEFT} 列留白` : note)
        } else {
            setActive(cloneMap(next))
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
        resetHistory()
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
    const savePayload = useMemo<PixelEditorSavedState>(
        () => ({
            mode,
            frame: { map, constName, poseName, sourceKey },
            weapon: { id: weaponId, grid: weaponGrid, palette: weaponPalette, poses: weaponPoses, pose: weaponPose },
            colorOverrides,
            fixedSlotOverrides,
            mountConfigs,
            tool,
            slot,
            mirror,
            showGrid,
            showAnchors,
            manualZoom,
        }),
        [mode, map, constName, poseName, sourceKey, weaponId, weaponGrid, weaponPoses, weaponPose, weaponPalette, colorOverrides, fixedSlotOverrides, mountConfigs, tool, slot, mirror, showGrid, showAnchors, manualZoom],
    )
    useEditorAutosave(savePayload)

    // ── 快捷键 ──
    useEditorHotkeys({ undo, redo, copy: copyCurrent, paste: pasteClipboard, slot, selectSlot, setTool, setMirror })

    // ── 武器调色板操作 ──
    const addWeaponColor = () => {
        pushHistory()
        // 填第一个空位（删色留下的），没有空位才往后加 —— 下标不重排，别的图不受影响
        const slot = firstFreeSlot(weaponPalette)
        const next = [...weaponPalette]
        next[slot] = '#ffffff'
        setSlot(slot)
        setWeaponPalette(next)
        setStatus(`已在颜色 ${slot} 加一个颜色（用色块旁的取色器改成想要的颜色）`)
    }
    const setWeaponColorAt = (idx: number, color: string) => {
        pushHistory()
        setWeaponPalette((p) => p.map((c, i) => (i === idx ? color : c)))
    }
    const removeWeaponColor = (idx: number) => {
        // 一把武器一套下标 → 删色只留空位、不重排，所以七张图一张都不用动
        const res = removeWeaponPaletteColor(weaponGrid, weaponPoses, weaponPalette, idx)
        if (res.blocked) {
            setStatus('这个颜色还在画布上用着，先把用它的格子擦掉或换色')
            return
        }
        pushHistory()
        setWeaponPalette(res.palette)
        setStatus(`已把颜色 ${idx} 留空（下标不重排，所有图的颜色都不变）`)
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
            const parsed = parseWeaponArtSnippet(text, WEAPON_WIDTH, WEAPON_HEIGHT)
            if (!parsed.ok) {
                setStatus(`${source} 失败：${parsed.error}`)
                return
            }
            if (parsed.id) setWeaponId(parsed.id)
            resetHistory()
            // 一次可以只粘一块：通用图块写 overlay 槽，姿势块写对应姿势槽
            let landed = WEAPON_BASE_SLOT
            for (const block of parsed.blocks) {
                if (block.pose === null) {
                    setWeaponGrid(cloneMap(block.grid))
                    landed = WEAPON_BASE_SLOT
                } else {
                    const pose = block.pose
                    setWeaponPoses((prev) => ({ ...prev, [pose]: cloneMap(block.grid) }))
                    landed = pose
                }
            }
            // 每把武器只有一份 palette：用片段合并后的那一份（导出片段每块都写同一份）
            setWeaponPalette(parsed.palette)
            // 调色板被整份替换了 → 剪贴板的索引不再对应同一批颜色，作废
            clipboardRef.current = null
            setWeaponPose(landed)
            setManualZoom(null)
            setStatus(
                `已载入 ${source}${parsed.id ? `（${parsed.id}）` : ''}：${parsed.blocks
                    .map((b) => b.pose ?? '通用图')
                    .join(' / ')}`,
            )
        }
    }

    const importFile = async (file: File) => {
        try {
            importText(await file.text(), `文件 ${file.name}`)
        } catch (e) {
            setStatus(`导入 ${file.name} 失败：${(e as Error).message}`)
        }
    }

    /** 已画的姿势（导出 art 块时用：`art:` 是整块替换，必须把画过的姿势都写上，否则贴回去等于删掉别的） */
    const drawnPoses = useMemo(
        () => POSE_NAMES.filter((pose) => gridHasPixels(weaponPoses[pose])),
        [weaponPoses],
    )

    /**
     * 导出哪一块**只看当前在编辑哪个槽**：
     * - 在通用图 → `overlay:` 块（就是这张，跟姿势有没有画无关）；
     * - 在某个姿势 → `art:` 块（含所有画过的姿势，整块替换语义）；
     * - 在某个姿势但一个姿势都没画 → 这张图其实来自通用图（坍缩链），退回 `overlay:` 块。
     *
     * 片段里**不带 palette**：一把武器只有一份调色板 + 一套下标，那份 palette 声明在通用图上，
     * 块里再抄一份只会把文件里的共享 const 顶掉。调色板要带走请用「复制调色板」按钮
     * （这样「复制片段」的内容永远只是像素，不会时有时无）。
     */
    const exported = useMemo(() => {
        if (mode === 'frame') return formatPixelMapSource(constName || 'DEFAULT_FRAME', map)
        const onBaseSlot = weaponPose === WEAPON_BASE_SLOT
        const body =
            onBaseSlot || drawnPoses.length === 0
                ? formatWeaponOverlaySnippet(weaponId, weaponGrid)
                : formatWeaponArtSnippet(
                      weaponId,
                      drawnPoses.map((pose) => ({ pose, grid: weaponPoses[pose] })),
                  )
        return body
    }, [mode, constName, map, weaponId, weaponGrid, weaponPoses, drawnPoses, weaponPose])

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
        const body = isFrame ? formatPixelMapJson(map) : weaponGridToJson(weaponSlotGrid, weaponPalette)
        const blob = new Blob([body + '\n'], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${name}.json`
        a.click()
        URL.revokeObjectURL(url)
        setStatus(`已下载 ${name}.json（可直接再导入）`)
    }

    const handleImportPaste = () => importText(pasteText, '粘贴内容')

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) void importFile(file)
        e.target.value = ''
    }

    const handleNewBlank = () => {
        if (mode === 'frame') {
            loadMap(blankPixelMap(SOURCE_W, SOURCE_H), '已新建空白图')
            return
        }
        // 只清当前槽；palette 是六张图共用的，不能跟着清（否则别的槽颜色全错）
        loadMap(
            blankPixelMap(WEAPON_WIDTH, WEAPON_HEIGHT),
            `已新建空白图（${weaponPose === WEAPON_BASE_SLOT ? '通用图' : weaponPose}；共用调色板保留）`,
        )
    }

    const copyExported = () => copy(exported, mode === 'frame' ? 'TS 片段已复制' : '武器片段已复制')
    /** 只复制当前在编辑的那一条（通用图 / 某个姿势），用来替换文件里对应的那一条 */
    const copyCurrentEntry = () =>
        copy(
            formatWeaponEntrySnippet(weaponId, weaponPose === WEAPON_BASE_SLOT ? null : weaponPose, weaponSlotGrid),
            `已复制「${weaponPose === WEAPON_BASE_SLOT ? '通用图' : weaponPose}」这一条`,
        )
    /** 这把武器共用的那份调色板（文件顶部那份 `const PALETTE`，空位不写） */
    const copyPalette = () =>
        copy(formatSharedPaletteSnippet(weaponId, weaponPalette), '调色板片段已复制')

    const copyLiteral = () => copy(formatPixelMapLiteral(map), '数组已复制')

    const copySingleLine = () => copy(stringifyPixelMap(map), '单行 JSON 已复制')

    const resetAll = () => {
        try {
            localStorage.removeItem(EDITOR_STATE_KEY)
        } catch {
            /* 忽略 */
        }
        setMap(cloneMap(DEFAULT_BUFF))
        setPoseName('buff')
        setConstName('DEFAULT_BUFF')
        setSourceKey('buff')
        const d = weaponArtToGrids(firstWeaponId)
        setWeaponId(firstWeaponId)
        setWeaponGrid(d.grid)
        setWeaponPoses(d.poses)
        setWeaponPose(WEAPON_BASE_SLOT)
        setWeaponPalette(d.palette)
        setSlot(1)
        setManualZoom(null)
        setColorOverrides({})
        setFixedSlotOverrides({})
        resetHistory()
        setStatus('已清掉本地存档，回到默认状态')
    }

    const toggleAnchorEdit = () => {
        setAnchorEdit((v) => !v)
        setShowAnchors(true)
    }

    const snapAnchorsToSkin = () => {
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
    }

    const resetAnchor = () => {
        setAnchorOverride(null)
        setStatus('已恢复武器文件里的登记值')
    }

    const copyAnchorSnippet = () => copy(anchorSnippet, '锚点片段已复制')

    const toggleMirror = () => setMirror((v) => !v)

    const fitAll = () => setManualZoom(null)

    const autoOutlineNow = () => loadMap(autoOutline(activeRef.current), '已自动描边')

    const addAuraRingNow = () => loadMap(addAuraRing(activeRef.current), '已加一层金边')

    const clearCanvas = () => loadMap(blankPixelMap(gridW, gridH), '已清空')

    const loadBuiltinFrame = (key: string) => {
        setSourceKey(key)
        const found = BUILTIN_FRAMES.find((f) => f.key === key)
        if (!found) return
        setPoseName(found.key)
        setConstName(`DEFAULT_${found.key.toUpperCase()}`)
        loadMap(found.map, `已载入内置帧 ${key}`)
    }

    const loadWeapon = (id: string) => {
        setWeaponId(id)
        const { grid, poses, palette } = weaponArtToGrids(id)
        resetHistory()
        setWeaponGrid(grid)
        setWeaponPoses(poses)
        setWeaponPose(WEAPON_BASE_SLOT)
        setWeaponPalette(palette)
        // 换了武器 = 换了一份调色板：剪贴板里那张图的索引不再对应同一批颜色，作废
        clipboardRef.current = null
        setManualZoom(null)
        setStatus(`已载入武器「${WEAPON_NAME[id] ?? id}」`)
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
                                title="实验武器挂在身上哪里、倾角多少（不同动作不同），导出武器文件里的 poses 块"
                                onClick={() => switchMode('mount')}
                            >
                                武器挂点
                            </button>
                        </div>
                </div>
                {mode === 'mount' ? (
                    <WeaponMountPanel
                        backdrop={backdrop}
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
                <EditorToolbar
                    mode={mode}
                    tool={tool}
                    onToolChange={setTool}
                    mirror={mirror}
                    onToggleMirror={toggleMirror}
                    onUndo={undo}
                    onCopy={copyCurrent}
                    onPaste={pasteClipboard}
                    onRedo={redo}
                    onAutoOutline={autoOutlineNow}
                    onAddAuraRing={addAuraRingNow}
                    anchorEdit={anchorEdit}
                    onToggleAnchorEdit={toggleAnchorEdit}
                    onClear={clearCanvas}
                    showGrid={showGrid}
                    onShowGridChange={setShowGrid}
                    showAnchors={showAnchors}
                    onShowAnchorsChange={setShowAnchors}
                    zoom={zoom}
                    autoFit={autoFit}
                    onZoomChange={setManualZoom}
                    onFit={fitAll}
                    backdropId={backdropId}
                    customBackdrop={customBackdrop}
                    onBackdropIdChange={setBackdropId}
                    onCustomBackdropChange={setCustomBackdrop}
                    anchorMode={anchorMode}
                    anchorData={anchorData}
                    anchorDirty={anchorDirty}
                    slot={slot}
                    colorOf={colorOf}
                    onNudge={nudgeWeapon}
                    status={status}
                    avail={avail}
                    gridW={gridW}
                />

                {/* 武器图：逐姿势美术工具条（通用图 + 六个姿势 + 复制/清空） */}
                {mode === 'weapon' && (
                    <PoseArtBar
                        current={weaponPose}
                        filled={filledPoses}
                        baseFilled={gridHasPixels(weaponGrid)}
                        onSelect={switchWeaponPose}
                        onClearCurrent={clearCurrentPose}
                    />
                )}

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
                        onPointerLeave={onPointerLeave}
                        onContextMenu={onContextMenu}
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

                <EditorPreview
                    mode={mode}
                    map={map}
                    framePalette={framePalette}
                    poseName={poseName}
                    previewWeaponId={previewWeaponId}
                    weaponGrid={weaponSlotGrid}
                    weaponPalette={weaponPalette}
                    backdrop={backdrop}
                />
                    </>
                )}
            </div>

            {/* ── 右：设置面板（说明都在 tooltip 里）；武器挂点模式自带全套控件，右栏整个让开 ── */}
            {mode !== 'mount' && (
            <aside className="pixel-editor-side">
                <SourcePanel
                    mode={mode}
                    sourceKey={sourceKey}
                    onLoadBuiltinFrame={loadBuiltinFrame}
                    poseName={poseName}
                    onPoseNameChange={setPoseName}
                    constName={constName}
                    onConstNameChange={setConstName}
                    weaponId={weaponId}
                    onLoadWeapon={loadWeapon}
                />

                <PalettePanel
                    mode={mode}
                    slotList={slotList}
                    slot={slot}
                    selectSlot={selectSlot}
                    colorOf={colorOf}
                    weaponPalette={weaponPalette}
                    effectiveColors={effectiveColors}
                    charId={charId}
                    setCharId={setCharId}
                    colorOverridden={colorOverridden}
                    missingSlots={missingSlots}
                    fixedSlotOverrides={fixedSlotOverrides}
                    setFixedSlotOverrides={setFixedSlotOverrides}
                    setColorOverrides={setColorOverrides}
                    setStatus={setStatus}
                    copy={copy}
                    setWeaponColorAt={setWeaponColorAt}
                    removeWeaponColor={removeWeaponColor}
                    addWeaponColor={addWeaponColor}
                    previewWeaponId={previewWeaponId}
                    setPreviewWeaponId={setPreviewWeaponId}
                />

                <ExportBar
                    mode={mode}
                    pasteText={pasteText}
                    onPasteTextChange={setPasteText}
                    onImportPaste={handleImportPaste}
                    onImportFileClick={() => fileInputRef.current?.click()}
                    fileInputRef={fileInputRef}
                    onFileInputChange={handleFileInputChange}
                    onNewBlank={handleNewBlank}
                    onCopyExported={copyExported}
                    onCopyCurrentEntry={copyCurrentEntry}
                    onCopyPalette={copyPalette}
                    onCopyLiteral={copyLiteral}
                    onCopySingleLine={copySingleLine}
                    onDownload={download}
                    onResetAll={resetAll}
                    exported={exported}
                />

                {mode === 'frame' && (
                    <AnchorPanel
                        anchorEdit={anchorEdit}
                        anchorDirty={anchorDirty}
                        anchorSnippet={anchorSnippet}
                        onToggleAnchorEdit={toggleAnchorEdit}
                        onSnapToSkin={snapAnchorsToSkin}
                        onResetAnchor={resetAnchor}
                        onCopyAnchor={copyAnchorSnippet}
                    />
                )}
            </aside>
            )}
        </div>
    )
}
