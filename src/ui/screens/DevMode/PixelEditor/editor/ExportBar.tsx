import type { ChangeEvent, RefObject } from 'react'
import type { EditorMode } from './constants'

export interface ExportBarProps {
    mode: EditorMode
    /** 粘贴框内容 */
    pasteText: string
    onPasteTextChange: (text: string) => void
    /** 载入粘贴框里的内容 */
    onImportPaste: () => void
    /** 打开文件选择框 */
    onImportFileClick: () => void
    fileInputRef: RefObject<HTMLInputElement | null>
    /** 选中文件后导入（并清空 input，同一个文件能再选一次） */
    onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void
    /** 新建空白图（身体帧 48×48 / 武器图 32×32） */
    onNewBlank: () => void
    onCopyExported: () => void
    onCopyLiteral: () => void
    onCopySingleLine: () => void
    onDownload: () => void
    /** 清掉本地存档并回到默认状态 */
    onResetAll: () => void
    /** 当前模式下导出的代码文本 */
    exported: string
}

/** 右侧「导入 / 导出」面板：粘贴/文件导入、复制片段、下载、清存档 */
export function ExportBar({
    mode,
    pasteText,
    onPasteTextChange,
    onImportPaste,
    onImportFileClick,
    fileInputRef,
    onFileInputChange,
    onNewBlank,
    onCopyExported,
    onCopyLiteral,
    onCopySingleLine,
    onDownload,
    onResetAll,
    exported,
}: ExportBarProps) {
    return (
        <section className="pixel-editor-panel">
            <h3
                title={
                    mode === 'frame'
                        ? '导入：粘贴姿势帧文件的整段或导出的 JSON（也可把 .json/.txt 拖到页面上）｜导出：TS 片段可直接替换 sprites/<姿势>.ts 的常量'
                        : '导入：粘贴武器文件里的 overlay 块或 { pixels, palette }｜导出：overlay 块可直接粘进 weapons/entries/<武器>.ts'
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
                onChange={(e) => onPasteTextChange(e.target.value)}
                rows={3}
            />
            <div className="pixel-editor-row">
                <button className="pixel-editor-btn" onClick={onImportPaste}>
                    载入粘贴
                </button>
                <button className="pixel-editor-btn" onClick={onImportFileClick}>
                    导入文件
                </button>
                <button
                    className="pixel-editor-btn"
                    title={mode === 'frame' ? '新建空白 48×48 身体帧' : '新建空白 32×32 武器图'}
                    onClick={onNewBlank}
                >
                    空白
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json,text/plain"
                    className="pixel-editor-file"
                    onChange={onFileInputChange}
                />
            </div>

            <div className="pixel-editor-row">
                <button className="pixel-editor-btn" title="复制导出片段" onClick={onCopyExported}>
                    复制片段
                </button>
                {mode === 'frame' && (
                    <>
                        <button className="pixel-editor-btn" onClick={onCopyLiteral}>
                            复制数组
                        </button>
                        <button className="pixel-editor-btn" onClick={onCopySingleLine}>
                            单行 JSON
                        </button>
                    </>
                )}
                <button className="pixel-editor-btn" onClick={onDownload}>
                    下载 .json
                </button>
                <button
                    className="pixel-editor-btn"
                    title="清掉本地存档并回到默认状态（默认身体帧 buff + 默认武器）。平时不用点：保存代码触发的整页刷新会自动恢复"
                    onClick={onResetAll}
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
    )
}
