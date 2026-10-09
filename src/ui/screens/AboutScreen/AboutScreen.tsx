import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button/Button'
import './AboutScreen.scss'

/** 反馈入口：仓库地址取自 `git remote`（github.com/HDNRAY/bdgame），部署 workflow 把构建产物推到 HDNRAY.github.io 的 /bdgame */
const ISSUES_URL = 'https://github.com/HDNRAY/bdgame/issues'

export function AboutScreen() {
    const navigate = useNavigate()
    return (
        <div className="about-screen">
            <div className="about-title">关于</div>
            <div className="about-desc">
                炁
                <br />
                <br />
                赛博朋克 + 炼炁士 主题 1v1 肉鸽
                <br />
                TypeScript + Vite + React 构建
            </div>
            <div className="about-feedback">
                遇到 bug 或有想说的，欢迎到 GitHub 的 issues 里提。
                <br />
                <a className="about-link" href={ISSUES_URL} target="_blank" rel="noreferrer">
                    github.com/HDNRAY/bdgame/issues
                </a>
            </div>
            <Button variant="default" size="md" onClick={() => navigate('/')}>
                返回
            </Button>
        </div>
    )
}
