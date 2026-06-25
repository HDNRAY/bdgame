import './ControlsBar.scss'

interface ControlsBarProps {
    playing: boolean
    speed: number
    progress: number
    currentTime: number
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
    onTogglePlay,
    onChangeSpeed,
    onSeek,
    onReplay,
}: ControlsBarProps) {
    return (
        <div className="controls-bar">
            <button className="ctrl-btn" onClick={onTogglePlay}>
                {playing ? '⏸' : '▶'}
            </button>
            {[0.5, 1, 2, 4].map((s) => (
                <button key={s} className={`ctrl-btn ${speed === s ? 'active' : ''}`} onClick={() => onChangeSpeed(s)}>
                    {s}×
                </button>
            ))}
            <div className="progress" onClick={onSeek}>
                <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="timestamp">{(currentTime / 1000).toFixed(1)}s</span>

            {onReplay && (
                <button className="ctrl-btn replay-btn" onClick={onReplay} title="重播">
                    ↺
                </button>
            )}
        </div>
    )
}
