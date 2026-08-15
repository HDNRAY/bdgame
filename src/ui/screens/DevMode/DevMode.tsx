import { useSearchParams } from 'react-router-dom'
import { PixelInspector } from './PixelInspector/PixelInspector'
import { TournamentSim } from './TournamentSim/TournamentSim'
import { ActionCompare } from './ActionCompare/ActionCompare'
import './DevMode.scss'

const NAV_ITEMS = [
    { id: 'pixel', label: '像素图测试' },
    { id: 'tournament', label: '大会模拟' },
    { id: 'ap', label: '招式对比' },
] as const

type NavId = (typeof NAV_ITEMS)[number]['id']

/** 当前 tab 是否合法 */
function isNavId(v: string | null): v is NavId {
    return NAV_ITEMS.some((item) => item.id === v)
}

export function DevMode() {
    const [searchParams, setSearchParams] = useSearchParams()
    const tabParam = searchParams.get('tab')
    const activeId: NavId = isNavId(tabParam) ? tabParam : 'pixel'

    const setActiveId = (id: NavId) => {
        // 保留 PixelInspector 的 char/weapon 参数，仅更新 tab
        const next = new URLSearchParams(searchParams)
        next.set('tab', id)
        setSearchParams(next, { replace: true })
    }

    return (
        <div className="dev-mode">
            <nav className="dev-mode-nav">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        className={`dev-mode-nav-item ${activeId === item.id ? 'active' : ''}`}
                        onClick={() => setActiveId(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
            <main className="dev-mode-content">
                {activeId === 'pixel' ? (
                    <>
                        <h2>像素图测试</h2>
                        <PixelInspector />
                    </>
                ) : activeId === 'tournament' ? (
                    <TournamentSim />
                ) : (
                    <ActionCompare />
                )}
            </main>
        </div>
    )
}
