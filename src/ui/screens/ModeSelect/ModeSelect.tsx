import { useNavigate } from 'react-router-dom'
import './ModeSelect.scss'

/** 模式选择界面 */
export function ModeSelect() {
    const navigate = useNavigate()
    return (
        <div className="mode-select">
            <div className="mode-select-title">{import.meta.env.VITE_APP_TITLE}</div>

            <div className="mode-select-buttons">
                <button className="mode-select-btn mode-select-btn-main" onClick={() => navigate('/roguelite')}>
                    肉鸽模式
                    <span className="mode-select-btn-hint">游戏本体 · 开发中</span>
                </button>
                <button className="mode-select-btn mode-select-btn-main" onClick={() => navigate('/quick')}>
                    快速模式
                    <span className="mode-select-btn-hint">跳过战斗 · 测试用 · 开发中</span>
                </button>
                <button className="mode-select-btn mode-select-btn-main" onClick={() => navigate('/select')}>
                    单挑模式
                    <span className="mode-select-btn-hint">1v1 快速对决</span>
                </button>
            </div>

            <div className="mode-select-footer">
                <button className="mode-select-btn mode-select-btn-sm" onClick={() => navigate('/settings')}>
                    设置
                </button>
                <button className="mode-select-btn mode-select-btn-sm" onClick={() => navigate('/about')}>
                    关于
                </button>
            </div>
        </div>
    )
}
