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

            {/* 标题 + 题记是一个整体：题记贴着标题，到主按钮的呼吸位由 head 的下边距给 */}
            <div className="mode-select-head">
                <div className="mode-select-title">{import.meta.env.VITE_APP_TITLE}</div>
                {/* 两段分开包 span：窄屏只在破折号处换行，不把「赌博」「其代价」拆开（见 scss） */}
                <p className="mode-select-epigraph">
                    <span>每一次获得都是一场赌博——</span><span>你无从知晓，自己能否承受其代价</span>
                </p>
            </div>

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
