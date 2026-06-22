import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CharacterBuild } from '../../../engine/entities/character-build'
import { Character } from '../../../engine/entities/character'
import { runBattle } from '../../../engine/battle-runner'
import { formatBattleLog } from '../../../engine/format-log'
import { BuildPanel } from '../BuildPanel/BuildPanel'
import { BattlePanel } from '../BattlePanel/BattlePanel'
import { ReplayPanel } from '../ReplayPanel/ReplayPanel'
import { useAppStore } from '../../stores/app-store'

export function BattleScreen() {
    const navigate = useNavigate()
    const lastBuilds = useAppStore((s) => s.lastBuilds)
    const battleKey = useAppStore((s) => s.battleKey)
    const battleData = useAppStore((s) => s.battleData)
    const currentSnapshot = useAppStore((s) => s.currentSnapshot)
    const setBattleData = useAppStore((s) => s.setBattleData)
    const setCurrentSnapshot = useAppStore((s) => s.setCurrentSnapshot)
    const incrementBattleKey = useAppStore((s) => s.incrementBattleKey)

    const runOneBattle = useCallback(
        (buildA: CharacterBuild, buildB: CharacterBuild) => {
            const a = new Character(buildA)
            const b = new Character(buildB)
            const { engine } = runBattle(a, b, undefined, 6)
            const snapshots = engine.state.log.getAll().map((e) => e.event.snapshot)
            const { lines: log, eventToLine } = formatBattleLog(engine.state.log)
            setBattleData({
                log,
                chars: { a: engine.state.characters[0], b: engine.state.characters[1] },
                entries: engine.state.log.getAll(),
                snapshots,
                eventToLine,
            })
            setCurrentSnapshot(snapshots[0] ?? null)
            incrementBattleKey()
        },
        [setBattleData, setCurrentSnapshot, incrementBattleKey],
    )

    const handleRefight = useCallback(() => {
        if (!lastBuilds) return
        runOneBattle(lastBuilds.a, lastBuilds.b)
    }, [lastBuilds, runOneBattle])

    const handleFrame = useCallback(
        (snapshot: typeof currentSnapshot) => {
            setCurrentSnapshot(snapshot)
        },
        [setCurrentSnapshot],
    )

    const handleBack = useCallback(() => {
        navigate('/select')
    }, [navigate])

    const chars = battleData?.chars
    const charAInfo = useMemo(
        () => (chars ? { id: chars.a.id, name: chars.a.name, color: '#4ecdc4' as const } : null),
        [chars],
    )
    const charBInfo = useMemo(
        () => (chars ? { id: chars.b.id, name: chars.b.name, color: '#ff6b6b' as const } : null),
        [chars],
    )

    if (!battleData || !charAInfo || !charBInfo) {
        // 没有战斗数据，回到选人
        navigate('/select')
        return null
    }

    const { log, eventToLine, entries, snapshots } = battleData
    const { a: charA, b: charB } = battleData.chars
    const snap = currentSnapshot ?? snapshots[0]

    return (
        <div className="app-root">
            <BuildPanel character={charA} accentColor={charAInfo.color} />
            <div className="app-center">
                <ReplayPanel
                    key={battleKey}
                    entries={entries as never[]}
                    charA={charAInfo}
                    charB={charBInfo}
                    logLines={log}
                    eventToLine={eventToLine}
                    snapshots={snapshots}
                    onFrame={handleFrame}
                    onRefight={handleRefight}
                    onBack={handleBack}
                />
                {snap && <BattlePanel snapshot={snap} charAName={charA.name} charBName={charB.name} />}
            </div>
            <BuildPanel character={charB} accentColor={charBInfo.color} />
        </div>
    )
}
