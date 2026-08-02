import { useMemo, useState } from 'react'
import { makeCharacterSprite } from '../../pixel-sprites'
import { PixelCanvas } from '../../components/ui/PixelCanvas/PixelCanvas'
import { TournamentSim } from './TournamentSim/TournamentSim'
import './DevMode.scss'

const NAV_ITEMS = [
    { id: 'pixel', label: '像素图测试' },
    { id: 'tournament', label: '大会模拟' },
] as const

type NavId = (typeof NAV_ITEMS)[number]['id']

export function DevMode() {
    const [activeId, setActiveId] = useState<NavId>('pixel')
    const sprite = useMemo(() => makeCharacterSprite('yidao', '#4ecdc4'), [])

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
                        <PixelCanvas pixels={sprite.frames.idle} palette={sprite.palette} className="dev-mode-canvas" />
                    </>
                ) : (
                    <TournamentSim />
                )}
            </main>
        </div>
    )
}
