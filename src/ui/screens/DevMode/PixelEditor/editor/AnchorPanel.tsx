export interface AnchorPanelProps {
    /** 是否处于「拖动锚点」模式 */
    anchorEdit: boolean
    /** 当前姿势的锚点在本编辑器里改过 */
    anchorDirty: boolean
    /** 导出的 weapons/hands.ts 片段 */
    anchorSnippet: string
    onToggleAnchorEdit: () => void
    /** 把两边锚点吸到最近的 2×2 皮肤块 */
    onSnapToSkin: () => void
    onResetAnchor: () => void
    onCopyAnchor: () => void
}

/** 右侧「手部锚点」折叠面板：拖动开关 / 吸附 / 重置 / 导出片段 */
export function AnchorPanel({
    anchorEdit,
    anchorDirty,
    anchorSnippet,
    onToggleAnchorEdit,
    onSnapToSkin,
    onResetAnchor,
    onCopyAnchor,
}: AnchorPanelProps) {
    return (
        <details className="pixel-editor-panel" open={anchorEdit}>
            <summary title="手部锚点决定武器挂在哪：握点 + 2×2 遮罩格，对应 weapons/hands.ts 的四张表">
                手部锚点{anchorDirty ? '（已改动）' : ''}
            </summary>
            <div className="pixel-editor-row">
                <button
                    className={`pixel-editor-btn ${anchorEdit ? 'active' : ''}`}
                    onClick={onToggleAnchorEdit}
                >
                    {anchorEdit ? '正在拖动' : '拖动锚点'}
                </button>
                <button className="pixel-editor-btn" title="把两边锚点吸到最近的 2×2 皮肤块" onClick={onSnapToSkin}>
                    吸附到皮肤
                </button>
                <button className="pixel-editor-btn" disabled={!anchorDirty} onClick={onResetAnchor}>
                    重置
                </button>
            </div>
            <button className="pixel-editor-btn" onClick={onCopyAnchor}>
                复制锚点片段
            </button>
            <details className="pixel-editor-code">
                <summary title="展开看 weapons/hands.ts 的四张表片段（剪贴板不可用时手动复制）">查看锚点代码</summary>
                <textarea
                    className="pixel-editor-textarea pixel-editor-textarea--export"
                    readOnly
                    value={anchorSnippet}
                    rows={6}
                />
            </details>
        </details>
    )
}
