import { useEffect, useRef } from 'react'
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
import { useAppStore } from './ui/stores/app-store'
import { useSystemTheme } from './ui/hooks/useSystemTheme'

/**
 * AppShell — 全局配置注入层
 * 负责将 theme / uiScale 应用到 <html> 的 data-theme 和 CSS 变量
 */
function AppShell({ children }: { children: React.ReactNode }) {
    const { theme, uiScale } = useAppStore((s) => s.uiConfig)
    const systemTheme = useSystemTheme()
    const effectiveTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme
    const initRef = useRef(false)

    useEffect(() => {
        document.documentElement.dataset.theme = effectiveTheme
    }, [effectiveTheme])

    useEffect(() => {
        document.documentElement.style.setProperty('--ui-scale', String(uiScale))
    }, [uiScale])

    // 初始加载时确保一致性
    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true
            document.documentElement.dataset.theme = effectiveTheme
            document.documentElement.style.setProperty('--ui-scale', String(uiScale))
        }
    }, [effectiveTheme, uiScale])

    return <>{children}</>
}

function App() {
    return (
        <HashRouter>
            <AppShell>
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
            </AppShell>
        </HashRouter>
    )
}

export default App
