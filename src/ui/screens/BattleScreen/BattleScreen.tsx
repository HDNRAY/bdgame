import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getOpponentDef, gen } from '../../../data/opponents/index'
import { BattlePanel, type BattlePanelHandle } from '../../components/BattlePanel/BattlePanel'
import { CharacterPanel } from '../../components/CharacterPanel/CharacterPanel'
import './BattleScreen.scss'

/** 窄屏断点（px）— 小于该宽度时隐藏常驻侧栏，改用浮动按钮 + 覆盖层 */
const NARROW_MAX_WIDTH = 900

/** 战斗页：角色由 URL 参数 ?a=<oppId>&b=<oppId> 决定（刷新/分享不丢失选人） */
export function BattleScreen() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const idA = searchParams.get('a')
    const idB = searchParams.get('b')

    const defA = idA ? getOpponentDef(idA) : undefined
    const defB = idB ? getOpponentDef(idB) : undefined

    // 缺少/无效参数时回到选人页
    useEffect(() => {
        if (!defA || !defB) navigate('/select', { replace: true })
    }, [defA, defB, navigate])

    // 与选人页一致的 seed 重建 build（保持引用稳定，避免 BattlePanel 重打）
    const buildA = useMemo(() => (defA ? gen(defA, 33) : null), [defA])
    const buildB = useMemo(() => (defB ? gen(defB, 33) : null), [defB])

    // ── 窄屏适配：隐藏常驻侧栏，改为浮动按钮 + 覆盖层面板 ──
    const battleRef = useRef<BattlePanelHandle>(null)
    const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(`(max-width: ${NARROW_MAX_WIDTH}px)`).matches)
    const [sideOverlay, setSideOverlay] = useState<'a' | 'b' | null>(null)
    const wasPlayingRef = useRef(false)

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${NARROW_MAX_WIDTH}px)`)
        const onChange = () => setIsNarrow(mq.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    // 打开/切换面板：首次打开时记录播放状态并暂停；已打开时仅切换目标（保持暂停态）
    const openSide = (side: 'a' | 'b') => {
        if (sideOverlay === null) {
            wasPlayingRef.current = battleRef.current?.getState().playing ?? false
            if (wasPlayingRef.current) battleRef.current?.togglePlay()
        }
        setSideOverlay(side)
    }
    // 关闭面板：若打开前在播放则恢复
    const closeSide = () => {
        setSideOverlay(null)
        if (wasPlayingRef.current) battleRef.current?.togglePlay()
        wasPlayingRef.current = false
    }

    if (!buildA || !buildB) return null

    const sidePanel = (side: 'a' | 'b') =>
        side === 'a' ? (
            <CharacterPanel mode="view" build={buildA} accentColor="#4ecdc4" />
        ) : (
            <CharacterPanel mode="view" build={buildB} accentColor="#ff6b6b" />
        )

    return (
        <div className="battle-screen-root">
            <div className="battle-screen-header">
                <button className="bs-header-btn" onClick={() => navigate('/select')}>
                    ← 返回选人
                </button>
                <span className="bs-header-title">
                    {buildA.name} vs {buildB.name}
                </span>
            </div>
            <div className={isNarrow ? 'bs-body narrow' : 'bs-body'}>
                <BattlePanel ref={battleRef} buildA={buildA} buildB={buildB} showSidePanels={!isNarrow} />
            </div>

            {isNarrow && (
                <div className="bs-side-fab">
                    <button className="bs-side-fab-btn" onClick={() => openSide('a')}>
                        {buildA.name}
                    </button>
                    <button className="bs-side-fab-btn" onClick={() => openSide('b')}>
                        {buildB.name}
                    </button>
                </div>
            )}

            {isNarrow && sideOverlay && (
                <div
                    className={`bs-side-overlay ${sideOverlay === 'a' ? 'from-left' : 'from-right'}`}
                    onClick={closeSide}
                >
                    <div className="bs-side-sheet" onClick={(e) => e.stopPropagation()}>
                        <button className="bs-side-close" onClick={closeSide}>
                            ✕
                        </button>
                        {sidePanel(sideOverlay)}
                    </div>
                </div>
            )}
        </div>
    )
}
