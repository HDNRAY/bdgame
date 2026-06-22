import './ModeSelect.scss'

interface ModeSelectProps {
    onSelectMode: () => void
}

/** 模式选择界面 */
export function ModeSelect({ onSelectMode }: ModeSelectProps) {
    return (
        <div className="mode-select">
            <div className="mode-select-title">单 挑</div>
            <div className="mode-select-subtitle">1v1 对决</div>
            <button className="mode-select-btn" onClick={onSelectMode}>
                开始
            </button>
            <div className="mode-select-hint">（更多模式开发中）</div>
        </div>
    )
}
