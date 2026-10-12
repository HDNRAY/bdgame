import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RotateDevice } from './ui/components/RotateDevice/RotateDevice'
import { BottomBar } from './ui/components/layouts/BottomBar/BottomBar'
import { useAppStore } from './ui/stores/app-store'
import { useSystemTheme } from './ui/hooks/useSystemTheme'
import { applyFontUnits, watchFontUnits } from './ui/boot/font-grid'
import { NotFound } from './ui/screens/NotFound/NotFound'

// 按路由懒加载：避免首屏一次性下载全部 screen / 游戏数据 / DevMode
const ModeSelect = lazy(() => import('./ui/screens/ModeSelect/ModeSelect').then((m) => ({ default: m.ModeSelect })))
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
        // 字号档跟着 --ui-scale 一起重算，并在 resize 时跟着视口重算（返回解绑函数）。
        // 不吞掉 --ui-scale 的写入：字号档是从它推出来的，所以放在同一个 effect 里，顺序有意义。
        return watchFontUnits(document, uiScale)
    }, [uiScale])

    // 初始加载时确保一致性
    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true
            document.documentElement.dataset.theme = effectiveTheme
            document.documentElement.style.setProperty('--ui-scale', String(uiScale))
            applyFontUnits(document, uiScale)
        }
    }, [effectiveTheme, uiScale])

    return <>{children}</>
}

function App() {
    // 路由前缀从 Vite 的 base 推导（`import.meta.env.BASE_URL`，构建期被替换成字面量）：
    //   dev（base='/'）      → ''       —— react-router 的 basename='' 就是「没有 basename」
    //   线上（base='/bdgame/'）→ '/bdgame' —— 与旧的写死值逐字相同，行为不变
    // 末尾那个斜杠必须去掉：react-router 会把 basename 当路径前缀拼接，带尾斜杠会拼出
    // '//roguelite' 这类地址。不要再写死 '/bdgame'：换托管到根路径时它会和 vite.config.ts 的
    // base 脱节，<Router> 直接匹配不上、整站白屏（实测 console：
    // `<Router basename="/bdgame"> is not able to match the URL "/roguelite"`）。
    const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
    // /dev（DevMode）是否开放：由 .env 的 VITE_ENABLE_DEV_MODE 控制（true=开放，含线上部署）
    const devModeEnabled = import.meta.env.VITE_ENABLE_DEV_MODE === 'true'
    return (
        <BrowserRouter basename={basename}>
            <AppShell>
                <RotateDevice />
                {/* 唯一一处给内容让位的容器：路由页根元素都是它的直接子级，
                    由 src/index.css 的一条 `#root .app-content > *` 统一补 --bottom-bar-h */}
                <div className="app-content">
                    <Suspense fallback={<RouteFallback />}>
                        <Routes>
                            <Route path="/" element={<ModeSelect />} />
                            <Route path="/build/:charId" element={<BuildScreen />} />
                            <Route path="/settings" element={<SettingsScreen />} />
                            <Route path="/about" element={<AboutScreen />} />
                            <Route path="/encyclopedia" element={<EncyclopediaScreen />} />
                            <Route path="/battle" element={<BattleScreen />} />
                            <Route path="/roguelite" element={<RogueliteScreen />} />
                            {devModeEnabled && <Route path="/dev" element={<DevMode />} />}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </Suspense>
                </div>
                {/* 常驻底栏：刻意在 <Routes> 之外，所以覆盖全部路由（含 /dev） */}
                <BottomBar />
            </AppShell>
        </BrowserRouter>
    )
}

export default App
