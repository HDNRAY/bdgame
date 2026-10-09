import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button/Button'
import './ModeSelect.scss'

/** 模式选择界面 */
export function ModeSelect() {
    const navigate = useNavigate()
    // /dev（DevMode）隐藏入口：右上角透明热区，仅构建时开启 dev 才渲染
    const devEnabled = import.meta.env.VITE_ENABLE_DEV_MODE === 'true'
    return (
        <div className="mode-select">
            {devEnabled && (
                <button
                    className="mode-select-dev"
                    aria-label="开发者模式"
                    title="开发者模式"
                    onClick={() => navigate('/dev')}
                />
            )}

            <div className="mode-select-title">{import.meta.env.VITE_APP_TITLE}</div>

            <div className="mode-select-buttons">
                {/* 主入口只有「进入故事」四个字，按钮内不带副标题 / 说明 */}
                <Button
                    variant="default"
                    size="lg"
                    className="mode-select-btn mode-select-btn-main"
                    onClick={() => navigate('/roguelite')}
                >
                    进入故事
                </Button>
            </div>
        </div>
    )
}
