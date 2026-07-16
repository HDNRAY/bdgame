import { useNavigate } from 'react-router-dom'
import './AboutScreen.scss'

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
            <button className="about-back-btn" onClick={() => navigate('/')}>
                ← 返回
            </button>
        </div>
    )
}
