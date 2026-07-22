import { useMemo } from 'react'
import { makeCharacterSprite } from '../../pixel-sprites'
import { PixelCanvas } from '../../components/ui/PixelCanvas/PixelCanvas'
import './DevMode.scss'

const NAV_ITEMS = [{ id: 'pixel', label: '像素图测试' }]

export function DevMode() {
    const sprite = useMemo(() => makeCharacterSprite('yidao', '#4ecdc4'), [])

    return (
        <div className="dev-mode">
            <nav className="dev-mode-nav">
                {NAV_ITEMS.map((item) => (
                    <button key={item.id} className="dev-mode-nav-item active">
                        {item.label}
                    </button>
                ))}
            </nav>
            <main className="dev-mode-content">
                <h2>像素图测试</h2>
                <PixelCanvas pixels={sprite.frames.idle} palette={sprite.palette} className="dev-mode-canvas" />
            </main>
        </div>
    )
}
