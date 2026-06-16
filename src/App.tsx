import { useMemo } from 'react'
import { Character } from './engine/entities/character'
import { QILAN, YIDAO } from './engine/data/opponents/index'
import { runBattle } from './engine/battle-runner'
import { formatBattleLog } from './engine/format-log'
import { BuildPanel } from './ui/components/BuildPanel/BuildPanel'
import { BattlePanel } from './ui/components/BattlePanel/BattlePanel'
import { ReplayPanel } from './ui/components/ReplayPanel/ReplayPanel'
import './App.scss'

function App() {
    const { log, chars, entries, snapshots } = useMemo(() => {
        const a = new Character(YIDAO.generate(33))
        const b = new Character(QILAN.generate(33))
        const { engine } = runBattle(a, b)
        return {
            log: formatBattleLog(engine.state.log),
            chars: { a: engine.state.characters[0], b: engine.state.characters[1] },
            entries: engine.state.log.getAll(),
            snapshots: engine.state.log.getAll().map((e) => e.event.snapshot),
        }
    }, [])

    return (
        <div className="app-root">
            <BuildPanel character={chars.a} />
            <div className="app-center">
                <ReplayPanel
                    entries={entries}
                    charA={{ id: chars.a.id, name: chars.a.name, color: '#4ecdc4' }}
                    charB={{ id: chars.b.id, name: chars.b.name, color: '#ff6b6b' }}
                    logLines={log}
                />
                {snapshots.length > 0 && (
                    <BattlePanel
                        snapshot={snapshots[snapshots.length - 1]}
                        charAName={chars.a.name}
                        charBName={chars.b.name}
                    />
                )}
            </div>
            <BuildPanel character={chars.b} />
        </div>
    )
}

export default App
