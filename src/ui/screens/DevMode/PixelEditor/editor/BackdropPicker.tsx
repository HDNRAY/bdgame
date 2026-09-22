import { BACKDROP_PRESETS } from './constants'

export interface BackdropPickerProps {
    backdropId: string
    customBackdrop: string
    onBackdropIdChange: (id: string) => void
    onCustomBackdropChange: (color: string) => void
}

/** 工具栏里的「底板」色系选择（透明区棋盘底色，方便看对比度） */
export function BackdropPicker({
    backdropId,
    customBackdrop,
    onBackdropIdChange,
    onCustomBackdropChange,
}: BackdropPickerProps) {
    return (
        <label className="pixel-editor-backdrop" title="画布底板色系（透明区的棋盘底色，方便看对比度）">
            底板
            <select value={backdropId} onChange={(e) => onBackdropIdChange(e.target.value)}>
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
                    onChange={(e) => onCustomBackdropChange(e.target.value)}
                />
            )}
        </label>
    )
}
