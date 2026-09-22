import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    SPRITE_HEIGHT,
    SPRITE_PAD_LEFT,
    SPRITE_WIDTH,
    WEAPON_HEIGHT,
    WEAPON_WIDTH,
    addAuraRing,
    autoOutline,
    blankPixelMap,
    removePaletteColor,
    formatPixelMapJson,
    formatPixelMapLiteral,
    formatPixelMapSource,
    formatWeaponOverlaySnippet,
    frameSize,
    frameStats,
    parsePixelMap,
    parseWeaponOverlay,
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
import { SourcePanel } from './editor/SourcePanel'
import type { WeaponPoseConfig, WeaponSlot } from '../../../pixel-sprites'
import {
    BUILTIN_FRAMES,
    EDITOR_STATE_KEY,
    FRAME_SLOT_ORDER,
    SOURCE_H,
    SOURCE_W,
    WEAPON_IDS_WITH_ART,
    WEAPON_NAME,
} from './editor/constants'
import type { EditorMode, Tool } from './editor/constants'
import {
    cloneMap,
    readSavedState,
    weaponGridToJson,
    weaponOverlayToGrid,
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

    // ── 武器图 ──
    const firstWeaponId = WEAPON_IDS_WITH_ART[0] ?? 'dark_iron_sword'
    const [weaponId, setWeaponId] = useState(saved?.weapon.id ?? firstWeaponId)
    const [weaponGrid, setWeaponGrid] = useState<PixelMap>(
        () => saved?.weapon.grid ?? weaponOverlayToGrid(firstWeaponId).grid,
    )
    const [weaponPalette, setWeaponPalette] = useState<string[]>(
        () => saved?.weapon.palette ?? weaponOverlayToGrid(firstWeaponId).palette,
    )
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

    /** 整体平移武器图（所有已画的像素一起挪；挪出画布的点丢弃） */
    const nudgeWeapon = useCallback(
        (dx: number, dy: number) => {
            pushHistory()
            const w = weaponGrid[0]?.length ?? 0
            const next = weaponGrid.map((row) => row.map(() => 0))
            for (let y = 0; y < weaponGrid.length; y++) {
                for (let x = 0; x < w; x++) {
                    const v = weaponGrid[y][x]
                    if (!v) continue
                    const nx = x + dx
                    const ny = y + dy
                    if (nx < 0 || ny < 0 || ny >= next.length || nx >= w) continue
                    next[ny][nx] = v
                }
            }
            setWeaponGrid(next)
        },
        [pushHistory, weaponGrid],
    )

    const selectSlot = useCallback((next: number) => {
        setSlot(next)
        warnedTransparentRef.current = false
    }, [])

    /** 载入（身体帧会识别渲染帧并裁掉留白；两种模式都回到「适应」并清空历史） */
    const loadMap = (next: PixelMap, note: string, palette?: string[]) => {
        resetHistory()
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
        }),
        [mode, map, constName, poseName, sourceKey, weaponId, weaponGrid, weaponPalette, colorOverrides, fixedSlotOverrides, mountConfigs, tool, slot, mirror, showGrid, showAnchors, manualZoom],
    )
    useEditorAutosave(savePayload)

    // ── 快捷键 ──
    useEditorHotkeys({ undo, redo, slot, selectSlot, setTool, setMirror })

    // ── 武器调色板操作 ──
    const addWeaponColor = () => {
        pushHistory()
        setSlot(weaponPalette.length)
        setWeaponPalette((p) => [...p, '#ffffff'])
        setStatus('已加一个颜色（用色块旁的取色器改成想要的颜色）')
    }
    const setWeaponColorAt = (idx: number, color: string) => {
        pushHistory()
        setWeaponPalette((p) => p.map((c, i) => (i === idx ? color : c)))
    }
    const removeWeaponColor = (idx: number) => {
        const res = removePaletteColor(weaponGrid, weaponPalette, idx)
        if (res.blocked) {
            setStatus('这个颜色还在画布上用着，先把用它的格子擦掉或换色')
            return
        }
        pushHistory()
        // 索引前移后，画布上的颜色保持不变（不做这步就会整片错位）
        setWeaponGrid(res.grid)
        setWeaponPalette(res.palette)
        setSlot((s) => (s === idx ? 1 : s > idx ? s - 1 : s))
        setStatus('已删掉这个颜色（其余颜色的索引已同步前移，画面不变）')
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

    const handleImportPaste = () => importText(pasteText, '粘贴内容')

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) void importFile(file)
        e.target.value = ''
    }

    const handleNewBlank = () => {
        loadMap(
            blankPixelMap(mode === 'frame' ? SOURCE_W : WEAPON_WIDTH, mode === 'frame' ? SOURCE_H : WEAPON_HEIGHT),
            '已新建空白图',
            mode === 'weapon' ? [''] : undefined,
        )
    }

    const copyExported = () => copy(exported, mode === 'frame' ? 'TS 片段已复制' : '武器片段已复制')

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
        const d = weaponOverlayToGrid(firstWeaponId)
        setWeaponId(firstWeaponId)
        setWeaponGrid(d.grid)
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
        const { grid, palette } = weaponOverlayToGrid(id)
        loadMap(grid, `已载入武器「${WEAPON_NAME[id] ?? id}」`, palette)
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
                    weaponGrid={weaponGrid}
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
