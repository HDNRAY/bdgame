import { HashRouter, Routes, Route } from 'react-router-dom'
import { ModeSelect } from './ui/screens/ModeSelect/ModeSelect'
import { SelectionPanel } from './ui/components/SelectionPanel/SelectionPanel'
import { BuildScreen } from './ui/screens/BuildScreen/BuildScreen'
import { SettingsScreen } from './ui/screens/SettingsScreen/SettingsScreen'
import { AboutScreen } from './ui/screens/AboutScreen/AboutScreen'
import { BattleScreen } from './ui/screens/BattleScreen/BattleScreen'
import { QuickRunScreen } from './ui/screens/QuickRunScreen/QuickRunScreen'
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
                <Route path="/battle" element={<BattleScreen />} />
                <Route path="/quick" element={<QuickRunScreen />} />
            </Routes>
        </HashRouter>
    )
}

export default App
