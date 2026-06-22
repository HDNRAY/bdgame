import { useNavigate } from 'react-router-dom'
import './ModeSelect.scss'

/** 模式选择界面 */
export function ModeSelect() {
    const navigate = useNavigate()
    return (
        <div className="mode-select">
            <div className="mode-select-title">单 挑</div>
            <div className="mode-select-subtitle">1v1 对决</div>
            <button className="mode-select-btn" onClick={() => navigate('/select')}>
                开始
            </button>
            <div className="mode-select-hint">（更多模式开发中）</div>
        </div>
    )
}
