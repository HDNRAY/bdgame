import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RotateDevice } from './ui/components/RotateDevice/RotateDevice'
import { useAppStore } from './ui/stores/app-store'
import { useSystemTheme } from './ui/hooks/useSystemTheme'

// 按路由懒加载：避免首屏一次性下载全部 screen / 游戏数据 / DevMode
const ModeSelect = lazy(() => import('./ui/screens/ModeSelect/ModeSelect').then((m) => ({ default: m.ModeSelect })))
const SelectionPanel = lazy(() =>
    import('./ui/components/SelectionPanel/SelectionPanel').then((m) => ({ default: m.SelectionPanel })),
)
const BuildScreen = lazy(() => import('./ui/screens/BuildScreen/BuildScreen').then((m) => ({ default: m.BuildScreen })))
const SettingsScreen = lazy(() =>
    import('./ui/screens/SettingsScreen/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const AboutScreen = lazy(() => import('./ui/screens/AboutScreen/AboutScreen').then((m) => ({ default: m.AboutScreen })))
const EncyclopediaScreen = lazy(() =>
    import('./ui/screens/EncyclopediaScreen/EncyclopediaScreen').then((m) => ({ default: m.EncyclopediaScreen })),
)
const BattleScreen = lazy(() =>
    import('./ui/screens/BattleScreen/BattleScreen').then((m) => ({ default: m.BattleScreen })),
)
const RogueliteScreen = lazy(() =>
    import('./ui/screens/RogueliteScreen/RogueliteScreen').then((m) => ({ default: m.RogueliteScreen })),
)
const DevMode = lazy(() => import('./ui/screens/DevMode/DevMode').then((m) => ({ default: m.DevMode })))

/** 路由 chunk 加载中的占位 */
function RouteFallback() {
    return (
        <div
            style={{
                display: 'flex',
                height: '100dvh',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-mono)',
            }}
        >
            加载中…
        </div>
    )
}

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
        <BrowserRouter>
            <AppShell>
                <RotateDevice />
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        <Route path="/" element={<ModeSelect />} />
                        <Route path="/select" element={<SelectionPanel />} />
                        <Route path="/build/:charId" element={<BuildScreen />} />
                        <Route path="/settings" element={<SettingsScreen />} />
                        <Route path="/about" element={<AboutScreen />} />
                        <Route path="/encyclopedia" element={<EncyclopediaScreen />} />
                        <Route path="/battle" element={<BattleScreen />} />
                        <Route path="/roguelite" element={<RogueliteScreen />} />
                        <Route path="/dev" element={<DevMode />} />
                    </Routes>
                </Suspense>
            </AppShell>
        </BrowserRouter>
    )
}

export default App
