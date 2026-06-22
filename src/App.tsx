import { HashRouter, Routes, Route } from 'react-router-dom'
import { ModeSelect } from './ui/screens/ModeSelect'
import { SelectionPanel } from './ui/components/SelectionPanel/SelectionPanel'
import { BuildingPanel } from './ui/components/BuildingPanel/BuildingPanel'
import { BattleScreen } from './ui/components/BattleScreen/BattleScreen'

function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<ModeSelect />} />
                <Route path="/select" element={<SelectionPanel />} />
                <Route path="/build/:charId" element={<BuildingPanel />} />
                <Route path="/battle" element={<BattleScreen />} />
            </Routes>
        </HashRouter>
    )
}

export default App
