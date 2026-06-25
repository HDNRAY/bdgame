import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/app-store'
import { BattlePanel } from '../../components/BattlePanel/BattlePanel'
import './BattleScreen.scss'

export function BattleScreen() {
    const navigate = useNavigate()
    const lastBuilds = useAppStore((s) => s.lastBuilds)

    if (!lastBuilds) {
        navigate('/select')
        return null
    }

    return (
        <div className="battle-screen-root">
            <div className="battle-screen-header">
                <button className="bs-header-btn" onClick={() => navigate('/select')}>
                    ← 返回选人
                </button>
                <span className="bs-header-title">
                    {lastBuilds.a.name} vs {lastBuilds.b.name}
                </span>
            </div>
            <BattlePanel buildA={lastBuilds.a} buildB={lastBuilds.b} />
        </div>
    )
}
