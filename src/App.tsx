import { HashRouter, Routes, Route } from 'react-router-dom'
import { ModeSelect } from './ui/screens/ModeSelect'
import { SelectionPanel } from './ui/components/SelectionPanel/SelectionPanel'
import { CharacterPanel } from './ui/components/CharacterPanel/CharacterPanel'
import { BattleScreen } from './ui/components/BattleScreen/BattleScreen'
import { RotateDevice } from './ui/components/RotateDevice/RotateDevice'

function App() {
    return (
        <HashRouter>
            <RotateDevice />
            <Routes>
                <Route path="/" element={<ModeSelect />} />
                <Route path="/select" element={<SelectionPanel />} />
                <Route path="/build/:charId" element={<CharacterPanel mode="build" />} />
                <Route path="/battle" element={<BattleScreen />} />
            </Routes>
        </HashRouter>
    )
}

export default App
