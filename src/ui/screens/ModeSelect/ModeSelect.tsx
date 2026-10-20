import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button/Button'
import { Panel } from '../../components/ui/Panel/Panel'
import { CHAPTERS } from '../../../data/story-intros'
import './ModeSelect.scss'

/** 章序中文（首页眉标用；CHAPTERS 目前只有 1-3） */
const CHAPTER_CN = ['一', '二', '三']

/** 模式选择界面 */
export function ModeSelect() {
    const navigate = useNavigate()
    // /dev（DevMode）隐藏入口：右上角透明热区，仅构建时开启 dev 才渲染
    const devEnabled = import.meta.env.VITE_ENABLE_DEV_MODE === 'true'
    const firstChapter = CHAPTERS[0]
    const chapterLabel = firstChapter
        ? `第${CHAPTER_CN[firstChapter.chapter - 1] ?? firstChapter.chapter}章 · ${firstChapter.title}`
        : ''

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
                <p className="mode-select-kicker">{chapterLabel}</p>

                <div className="mode-select-title">{import.meta.env.VITE_APP_TITLE}</div>

                {/* 移动：题记在标题下；桌面：题记移到右栏（题记 + 节点数） */}
                <aside className="mode-select-aside">
                    <p className="mode-select-aside-label">题记</p>
                    <p className="mode-select-epigraph">
                        <span>每一次获得都是一场赌博——</span><span>你无从知晓，自己能否承受其代价</span>
                    </p>
                    <div className="mode-select-aside-foot">
                        <span>33 个节点</span>
                        <span>三十二强</span>
                    </div>
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
