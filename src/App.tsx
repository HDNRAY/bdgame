import { useState, useMemo, useCallback, useRef } from 'react'
import { Character } from './engine/entities/character'
import { runBattle } from './engine/battle-runner'
import { formatBattleLog } from './engine/format-log'
import type { BattleSnapshot } from './engine/combat/types'
import { BuildPanel } from './ui/components/BuildPanel/BuildPanel'
import { BattlePanel } from './ui/components/BattlePanel/BattlePanel'
import { ReplayPanel } from './ui/components/ReplayPanel/ReplayPanel'
import { SelectionPanel } from './ui/components/SelectionPanel/SelectionPanel'
import type { CharacterBuild } from './engine/entities/character-build'
import './App.scss'

type Screen = 'select' | 'battle'

function App() {
    const [screen, setScreen] = useState<Screen>('select')
    const [battleKey, setBattleKey] = useState(0)
    const [battleData, setBattleData] = useState<{
        log: string[]
        chars: { a: Character; b: Character }
        entries: unknown[]
        snapshots: BattleSnapshot[]
    } | null>(null)
    const [currentSnapshot, setCurrentSnapshot] = useState<BattleSnapshot | null>(null)
    const lastBuilds = useRef<{ a: CharacterBuild; b: CharacterBuild } | null>(null)

    const runOneBattle = useCallback((buildA: CharacterBuild, buildB: CharacterBuild) => {
        const a = new Character(buildA)
        const b = new Character(buildB)
        const { engine } = runBattle(a, b, undefined, 6)
        const snapshots = engine.state.log.getAll().map((e) => e.event.snapshot)
        setBattleData({
            log: formatBattleLog(engine.state.log),
            chars: { a: engine.state.characters[0], b: engine.state.characters[1] },
            entries: engine.state.log.getAll(),
            snapshots,
        })
        setCurrentSnapshot(snapshots[0] ?? null)
        setBattleKey((k) => k + 1)
        setScreen('battle')
    }, [])

    const handleStart = useCallback(
        (buildA: CharacterBuild, buildB: CharacterBuild) => {
            lastBuilds.current = { a: buildA, b: buildB }
            runOneBattle(buildA, buildB)
        },
        [runOneBattle],
    )

    const handleRefight = useCallback(() => {
        const builds = lastBuilds.current
        if (!builds) return
        runOneBattle(builds.a, builds.b)
    }, [runOneBattle])

    const handleFrame = useCallback((snapshot: BattleSnapshot) => {
        setCurrentSnapshot(snapshot)
    }, [])

    const handleBack = useCallback(() => {
        setScreen('select')
    }, [])

    // Hooks 必须无条件调用（不能在 return 之后）
    const chars = battleData?.chars
    const charAInfo = useMemo(
        () => (chars ? { id: chars.a.id, name: chars.a.name, color: '#4ecdc4' as const } : null),
        [chars],
    )
    const charBInfo = useMemo(
        () => (chars ? { id: chars.b.id, name: chars.b.name, color: '#ff6b6b' as const } : null),
        [chars],
    )

    if (screen === 'select') {
        return <SelectionPanel onStart={handleStart} />
    }

    if (!battleData || !charAInfo || !charBInfo) return null

    const { log, entries, snapshots } = battleData
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

export default App
