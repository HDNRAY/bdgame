import { useRef, useEffect, useState, useMemo } from 'react'
import { OPPONENTS } from '../../../engine/data/opponents/index'
import type { OpponentDef } from '../../../engine/data/opponents/index'
import type { CharacterBuild } from '../../../engine/entities/character-build'
import { Character } from '../../../engine/entities/character'
import { getCharacterAvatar, renderAvatarToCanvas, getWeaponOverlay } from '../../pixel-sprites'
import { simulateWinRate } from '../../../engine/battle-runner'
import { BuildPanel } from '../BuildPanel/BuildPanel'
import './SelectionPanel.scss'

interface SelectionPanelProps {
    onStart: (buildA: CharacterBuild, buildB: CharacterBuild) => void
}

const GRID_COLORS = [
    '#4ecdc4',
    '#ff6b6b',
    '#ffe66d',
    '#2ecc71',
    '#9b59b6',
    '#85c1e9',
    '#f0b27a',
    '#fff',
    '#e74c3c',
    '#f39c12',
    '#3498db',
]

export function SelectionPanel({ onStart }: SelectionPanelProps) {
    const [selectedA, setSelectedA] = useState<OpponentDef | null>(null)
    const [selectedB, setSelectedB] = useState<OpponentDef | null>(null)
    const [simResult, setSimResult] = useState<{ aRate: number; bRate: number } | null>(null)
    const [simulating, setSimulating] = useState(false)

    // 选人完成后自动模拟胜率
    useEffect(() => {
        if (!selectedA || !selectedB) return
        setSimulating(true)
        setSimResult(null)
        const id = setTimeout(() => {
            const buildA = selectedA.generate(33)
            const buildB = selectedB.generate(33)
            const result = simulateWinRate(buildA, buildB, 200, 6)
            setSimResult({ aRate: result.aRate, bRate: result.bRate })
            setSimulating(false)
        }, 50)
        return () => clearTimeout(id)
    }, [selectedA, selectedB])

    const handleStart = () => {
        if (!selectedA || !selectedB) return
        onStart(selectedA.generate(33), selectedB.generate(33))
    }

    // 选中角色的 Character 实例（用于 BuildPanel）
    const charA = useMemo(() => (selectedA ? new Character(selectedA.generate(33)) : null), [selectedA])
    const charB = useMemo(() => (selectedB ? new Character(selectedB.generate(33)) : null), [selectedB])

    return (
        <div className="selection-root">
            <div className="selection-side">
                {charA ? (
                    <BuildPanel character={charA} accentColor="#4ecdc4" />
                ) : (
                    <div className="side-placeholder">请选择 A</div>
                )}
            </div>

            <div className="selection-center">
                <h1>选择对战双方</h1>

                <div className="slots">
                    <div className="slot-label">{selectedA?.name ?? '挑战者 A'}</div>
                    <span className="vs">VS</span>
                    <div className="slot-label">{selectedB?.name ?? '挑战者 B'}</div>
                </div>

                {/* 胜率显示（预留空间防抖动） */}
                <div className="win-rate" style={{ minHeight: 20 }}>
                    {simResult ? (
                        <>
                            {selectedA?.name} {Math.round(simResult.aRate * 100)}%<span className="sep">:</span>
                            {selectedB?.name} {Math.round(simResult.bRate * 100)}%
                        </>
                    ) : simulating ? (
                        <span className="dim">模拟中...</span>
                    ) : (
                        ''
                    )}
                </div>

                <div className="grid">
                    {OPPONENTS.map((opp, i) => (
                        <button
                            key={opp.id}
                            className={`card ${selectedA?.id === opp.id ? 'selected-a' : ''} ${selectedB?.id === opp.id ? 'selected-b' : ''}`}
                            onClick={() => {
                                if (selectedA?.id === opp.id) {
                                    setSelectedA(null)
                                    return
                                }
                                if (selectedB?.id === opp.id) {
                                    setSelectedB(null)
                                    return
                                }
                                if (!selectedA) setSelectedA(opp)
                                else if (!selectedB) setSelectedB(opp)
                                else setSelectedA(opp)
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault()
                                if (selectedA?.id === opp.id) setSelectedA(null)
                                else if (selectedB?.id === opp.id) setSelectedB(null)
                            }}
                        >
                            <div className="card-row">
                                <OpponentAvatarSprite opponentId={opp.id} color={GRID_COLORS[i]} />
                                <WeaponIconSprite weaponId={opp.generate(33).weapon} />
                            </div>
                            <span className="card-name">{opp.name}</span>
                        </button>
                    ))}
                </div>

                <button className="start-btn" disabled={!selectedA || !selectedB} onClick={handleStart}>
                    开始战斗
                </button>
            </div>

            <div className="selection-side">
                {charB ? (
                    <BuildPanel character={charB} accentColor="#ff6b6b" />
                ) : (
                    <div className="side-placeholder">请选择 B</div>
                )}
            </div>
        </div>
    )
}

/** 对手小头像 */
function OpponentAvatarSprite({ opponentId, color }: { opponentId: string; color: string }) {
    const ref = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        const c = ref.current
        if (!c) return
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 32, 32)
        const avatar = getCharacterAvatar(opponentId, color)
        renderAvatarToCanvas(ctx, avatar, 0, 0)
    }, [opponentId, color])
    return <canvas ref={ref} width={32} height={32} className="avatar-sprite" />
}

/** 武器小图标 */
function WeaponIconSprite({ weaponId }: { weaponId: string }) {
    const ref = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        const c = ref.current
        if (!c) return
        const ctx = c.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 32, 32)
        const overlay = getWeaponOverlay(weaponId)
        if (overlay.pixels.length === 0) return
        const minX = Math.min(...overlay.pixels.map((p) => p[0]))
        const maxX = Math.max(...overlay.pixels.map((p) => p[0]))
        const minY = Math.min(...overlay.pixels.map((p) => p[1]))
        const maxY = Math.max(...overlay.pixels.map((p) => p[1]))
        const w = (maxX - minX + 1) * 3
        const h = (maxY - minY + 1) * 3
        const ox = (32 - w) / 2
        const oy = (32 - h) / 2
        for (const [px, py, color] of overlay.pixels) {
            ctx.fillStyle = color
            ctx.fillRect(ox + (px - minX) * 3, oy + (py - minY) * 3, 3, 3)
        }
    }, [weaponId])
    return <canvas ref={ref} width={32} height={32} className="weapon-icon" />
}
