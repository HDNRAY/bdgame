import { useState } from 'react'
import { PixelInspector } from './PixelInspector/PixelInspector'
import { TournamentSim } from './TournamentSim/TournamentSim'
import './DevMode.scss'

const NAV_ITEMS = [
    { id: 'pixel', label: '像素图测试' },
    { id: 'tournament', label: '大会模拟' },
] as const

type NavId = (typeof NAV_ITEMS)[number]['id']

export function DevMode() {
    const [activeId, setActiveId] = useState<NavId>('pixel')

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
                ) : (
                    <TournamentSim />
                )}
            </main>
        </div>
    )
}
