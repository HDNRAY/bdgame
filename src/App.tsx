import { HashRouter, Routes, Route } from 'react-router-dom'
import { ModeSelect } from './ui/screens/ModeSelect/ModeSelect'
import { SelectionPanel } from './ui/components/SelectionPanel/SelectionPanel'
import { BuildScreen } from './ui/screens/BuildScreen/BuildScreen'
import { SettingsScreen } from './ui/screens/SettingsScreen/SettingsScreen'
import { AboutScreen } from './ui/screens/AboutScreen/AboutScreen'
import { EncyclopediaScreen } from './ui/screens/EncyclopediaScreen/EncyclopediaScreen'
import { BattleScreen } from './ui/screens/BattleScreen/BattleScreen'
import { RogueliteScreen } from './ui/screens/RogueliteScreen/RogueliteScreen'
import { RotateDevice } from './ui/components/RotateDevice/RotateDevice'

function App() {
    return (
        <HashRouter>
            <RotateDevice />
            <Routes>
                <Route path="/" element={<ModeSelect />} />
                <Route path="/select" element={<SelectionPanel />} />
                <Route path="/build/:charId" element={<BuildScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/about" element={<AboutScreen />} />
                <Route path="/encyclopedia" element={<EncyclopediaScreen />} />
                <Route path="/battle" element={<BattleScreen />} />
                <Route path="/roguelite" element={<RogueliteScreen />} />
            </Routes>
        </HashRouter>
    )
}

export default App
