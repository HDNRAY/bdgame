import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button/Button'
import { Panel } from '../../components/ui/Panel/Panel'
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

            <Panel className="mode-select-stage">
                <div className="mode-select-title">{import.meta.env.VITE_APP_TITLE}</div>

                {/* 移动：题记在标题下；桌面：题记移到右栏。只搬位置，不加任何新文案。 */}
                <aside className="mode-select-aside">
                    <p className="mode-select-epigraph">
                        <span>每一次获得都是一场赌博——</span><span>你无从知晓，自己能否承受其代价</span>
                    </p>
                </aside>

                <div className="mode-select-buttons">
                    {/* 主入口只有「进入故事」四个字，按钮内不带副标题 / 说明 */}
                    <Button variant="solid" size="lg" className="mode-select-cta" onClick={() => navigate('/roguelite')}>
                        进入故事
                    </Button>
                </div>
            </Panel>
        </div>
    )
}
