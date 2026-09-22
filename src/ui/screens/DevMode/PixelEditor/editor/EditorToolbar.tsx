import { SPRITE_AURA_SLOT } from '../../../../pixel-sprites'
import type { HandAnchorData } from '../../../../pixel-sprites'
import { BackdropPicker } from './BackdropPicker'
import { SLOT_LABELS, TOOLS, ZOOM_MAX, ZOOM_MIN } from './constants'
import type { EditorMode, Tool } from './constants'

export interface EditorToolbarProps {
    mode: EditorMode
    tool: Tool
    onToolChange: (tool: Tool) => void
    mirror: boolean
    onToggleMirror: () => void
    onUndo: () => void
    onRedo: () => void
    /** 身体帧：给贴背景的格子补描边 */
    onAutoOutline: () => void
    /** 身体帧：给剪影外侧加一层金边 */
    onAddAuraRing: () => void
    anchorEdit: boolean
    onToggleAnchorEdit: () => void
    onClear: () => void
    showGrid: boolean
    onShowGridChange: (show: boolean) => void
    showAnchors: boolean
    onShowAnchorsChange: (show: boolean) => void
    zoom: number
    autoFit: boolean
    onZoomChange: (zoom: number) => void
    onFit: () => void
    backdropId: string
    customBackdrop: string
    onBackdropIdChange: (id: string) => void
    onCustomBackdropChange: (color: string) => void
    /** 读数格子：锚点模式 / 画笔模式共用 */
    anchorMode: boolean
    anchorData: { main: HandAnchorData; off: HandAnchorData } | null
    anchorDirty: boolean
    slot: number
    colorOf: (v: number) => string | undefined
    /** 武器模式：整图平移 */
    onNudge: (dx: number, dy: number) => void
    status: string
    avail: { w: number; h: number } | null
    gridW: number
}

/** 画布上方的两行工具栏（工具 / 镜像 / 撤销重做 / 描边金边 / 缩放 / 底板 / 读数）+ 状态行 */
export function EditorToolbar({
    mode,
    tool,
    onToolChange,
    mirror,
    onToggleMirror,
    onUndo,
    onRedo,
    onAutoOutline,
    onAddAuraRing,
    anchorEdit,
    onToggleAnchorEdit,
    onClear,
    showGrid,
    onShowGridChange,
    showAnchors,
    onShowAnchorsChange,
    zoom,
    autoFit,
    onZoomChange,
    onFit,
    backdropId,
    customBackdrop,
    onBackdropIdChange,
    onCustomBackdropChange,
    anchorMode,
    anchorData,
    anchorDirty,
    slot,
    colorOf,
    onNudge,
    status,
    avail,
    gridW,
}: EditorToolbarProps) {
    return (
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
                        onClick={() => onToolChange(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
                <button
                    className={`pixel-editor-tool ${mirror ? 'active' : ''}`}
                    title="左右镜像同时落笔（X）"
                    onClick={onToggleMirror}
                >
                    镜像
                </button>
                <button className="pixel-editor-tool" title="撤销（Ctrl+Z）" onClick={onUndo}>
                    撤销
                </button>
                <button className="pixel-editor-tool" title="重做（Ctrl+Shift+Z）" onClick={onRedo}>
                    重做
                </button>
                {mode === 'frame' && (
                    <>
                        <button
                            className="pixel-editor-tool"
                            title="给所有「身体像素贴着背景」的格子补描边（斜边、拐角不容易漏）"
                            onClick={onAutoOutline}
                        >
                            自动描边
                        </button>
                        <button
                            className="pixel-editor-tool"
                            title={`给整个剪影外侧加一层金边（槽位 ${SPRITE_AURA_SLOT}）`}
                            onClick={onAddAuraRing}
                        >
                            加金边
                        </button>
                        <button
                            className={`pixel-editor-tool ${anchorEdit ? 'active' : ''}`}
                            title="开启后画布上拖动的是手部锚点（青=主手、黄=副手），不涂像素"
                            onClick={onToggleAnchorEdit}
                        >
                            拖锚点
                        </button>
                    </>
                )}
                <button className="pixel-editor-tool" title="清空成透明" onClick={onClear}>
                    清空
                </button>
            </div>

            <div className="pixel-editor-row">
                <label className="pixel-editor-toggle" title="显示像素网格">
                    <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => onShowGridChange(e.target.checked)}
                    />
                    网格
                </label>
                {mode === 'frame' && (
                    <label className="pixel-editor-toggle" title="显示该姿势的手部遮罩格与握点（青=主手、黄=副手）">
                        <input
                            type="checkbox"
                            checked={showAnchors || anchorEdit}
                            onChange={(e) => onShowAnchorsChange(e.target.checked)}
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
                        onChange={(e) => onZoomChange(Number(e.target.value))}
                    />
                    <span>{zoom}x</span>
                </label>
                <button
                    className={`pixel-editor-tool ${autoFit ? 'active' : ''}`}
                    title="按可用区域取最大整数倍（画布铺满可视区）"
                    onClick={onFit}
                >
                    适应
                </button>
                <BackdropPicker
                    backdropId={backdropId}
                    customBackdrop={customBackdrop}
                    onBackdropIdChange={onBackdropIdChange}
                    onCustomBackdropChange={onCustomBackdropChange}
                />
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
                            {TOOLS.find((t) => t.id === tool)?.label}
                            {mode === 'frame'
                                ? ` · ${SLOT_LABELS[slot] ?? `颜色 ${slot}`}${slot === 0 ? '（＝橡皮）' : ''}`
                                : ''}
                        </>
                    )}
                </span>

                {mode === 'weapon' && (
                    <div className="pixel-editor-row pixel-editor-row--end">
                        <span className="pixel-editor-col-label" title="把这张武器图里所有已画的像素一起平移（挪出画布的点会丢）">
                            整图平移
                        </span>
                        <button className="pixel-editor-tool" title="整体上移 1 格" onClick={() => onNudge(0, -1)}>
                            ↑
                        </button>
                        <button className="pixel-editor-tool" title="整体下移 1 格" onClick={() => onNudge(0, 1)}>
                            ↓
                        </button>
                        <button className="pixel-editor-tool" title="整体左移 1 格" onClick={() => onNudge(-1, 0)}>
                            ←
                        </button>
                        <button className="pixel-editor-tool" title="整体右移 1 格" onClick={() => onNudge(1, 0)}>
                            →
                        </button>
                    </div>
                )}
            </div>

            <p className="pixel-editor-status">
                {status || '\u00a0'}
                {avail && gridW * zoom > avail.w && !autoFit ? '（画布比可视区宽：可滚动，或点「适应」）' : ''}
            </p>
        </div>
    )
}
