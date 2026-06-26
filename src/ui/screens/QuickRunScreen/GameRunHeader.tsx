import { useCallback } from 'react'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog'
import type { GameRun } from '../../../engine/systems/game-run'

interface GameRunHeaderProps {
    run: React.MutableRefObject<GameRun>
    view: 'play' | 'build' | 'spar'
    setView: (view: 'play' | 'build' | 'spar') => void
    showExitDialog: boolean
    setShowExitDialog: (show: boolean) => void
    onConfirmExit: () => void
}

export function GameRunHeader({
    run,
    view,
    setView,
    showExitDialog,
    setShowExitDialog,
    onConfirmExit,
}: GameRunHeaderProps) {
    const ready = run.current.state.build.story

    const handleExitGame = useCallback(() => {
        setShowExitDialog(true)
    }, [setShowExitDialog])

    return (
        <>
            <div className="qr-header">
                <div className="qr-header-left">
                    <span className="qr-header-title">{import.meta.env.VITE_APP_TITLE}</span>
                    <span className="qr-header-info">
                        修炼点 {run.current.state.unspentCultPoints}
                        <span className="qr-injury-bar">
                            <span className="qr-injury-fill" style={{ width: `${run.current.state.injury}%` }} />
                            <span className="qr-injury-label">伤势 {run.current.state.injury}/100</span>
                        </span>
                    </span>
                </div>
                <div className="qr-header-right">
                    {ready && (
                        <>
                            <button
                                className={'qr-header-btn' + (view === 'play' ? ' qr-header-btn-active' : '')}
                                onClick={() => setView('play')}
                            >
                                游戏
                            </button>
                            <button
                                className={'qr-header-btn' + (view === 'build' ? ' qr-header-btn-active' : '')}
                                onClick={() => setView(view === 'build' ? 'play' : 'build')}
                            >
                                备战
                            </button>
                            <button
                                className={'qr-header-btn' + (view === 'spar' ? ' qr-header-btn-active' : '')}
                                onClick={() => setView(view === 'spar' ? 'play' : 'spar')}
                            >
                                切磋
                            </button>
                        </>
                    )}
                    <button className="qr-header-btn qr-header-btn-exit" onClick={handleExitGame}>
                        退出
                    </button>
                </div>
            </div>

            {showExitDialog && (
                <ConfirmDialog
                    title="退出游戏"
                    message="确定要退出游戏吗？已有进度将丢失。"
                    confirmText="退出"
                    cancelText="继续游戏"
                    isDanger
                    onConfirm={onConfirmExit}
                    onCancel={() => setShowExitDialog(false)}
                />
            )}
        </>
    )
}
