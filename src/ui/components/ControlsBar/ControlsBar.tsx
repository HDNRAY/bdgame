import { Button } from '../ui/Button/Button'
import './ControlsBar.scss'

interface ControlsBarProps {
    playing: boolean
    speed: number
    progress: number
    currentTime: number
    turn?: number
    onTogglePlay: () => void
    onChangeSpeed: (s: number) => void
    onSeek: (e: React.MouseEvent<HTMLDivElement>) => void
    onReplay?: () => void
}

export function ControlsBar({
    playing,
    speed,
    progress,
    currentTime,
    turn,
    onTogglePlay,
    onChangeSpeed,
    onSeek,
    onReplay,
}: ControlsBarProps) {
    return (
        <div className="controls-bar">
            <Button variant="bare" size="sm" className="ctrl-btn" onClick={onTogglePlay}>
                {playing ? '⏸' : '▶'}
            </Button>
            {[0.5, 1, 2, 4].map((s) => (
                <Button
                    key={s}
                    variant="bare"
                    size="sm"
                    className={`ctrl-btn ${speed === s ? 'active' : ''}`}
                    onClick={() => onChangeSpeed(s)}
                >
                    {s}×
                </Button>
            ))}
            <div className="progress" onClick={onSeek}>
                <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            {turn !== undefined && turn > 0 && <span className="turn-tag">回合{turn}</span>}
            <span className="timestamp">{(currentTime / 1000).toFixed(1)}s</span>

            {onReplay && (
                <Button variant="bare" size="sm" className="ctrl-btn replay-btn" onClick={onReplay} title="重播">
                    ↺
                </Button>
            )}
        </div>
    )
}
