import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, type ThemeMode } from '../../stores/app-store'
import './SettingsScreen.scss'

const SCALE_PRESETS = [
    { label: '小', value: 0.75 },
    { label: '中', value: 1.0 },
    { label: '大', value: 1.5 },
    { label: '超大', value: 2.0 },
] as const

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
    { label: '☀️ 浅色', value: 'light' },
    { label: '🌙 深色', value: 'dark' },
    { label: '💻 系统', value: 'system' },
]

export function SettingsScreen() {
    const navigate = useNavigate()
    const { theme, uiScale, typewriter } = useAppStore((s) => s.uiConfig)
    const setTheme = useAppStore((s) => s.setTheme)
    const setUiScale = useAppStore((s) => s.setUiScale)
    const setTypewriter = useAppStore((s) => s.setTypewriter)

    // 滑块拖拽时只更新本地状态，mouseup 才提交到 store
    const [dragScale, setDragScale] = useState(uiScale)

    function commitScale(scale: number) {
        const clamped = Math.min(2, Math.max(0.5, scale))
        setDragScale(clamped)
        setUiScale(clamped)
    }

    return (
        <div className="settings-screen">
            <div className="settings-title">设 置</div>

            {/* ── 主题 ── */}
            <div className="settings-section">
                <div className="settings-section-title">主题</div>
                <div className="theme-options">
                    {THEME_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            className={`theme-btn${theme === opt.value ? ' active' : ''}`}
                            onClick={() => setTheme(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 缩放 ── */}
            <div className="settings-section">
                <div className="settings-section-title">UI 缩放</div>
                <div className="settings-row">
                    <span className="settings-label">缩放比例</span>
                    <div className="scale-control">
                        <input
                            type="range"
                            className="scale-slider"
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            value={dragScale}
                            onChange={(e) => setDragScale(parseFloat(e.target.value))}
                            onMouseUp={(e) => commitScale(parseFloat((e.target as HTMLInputElement).value))}
                            onPointerUp={(e) => commitScale(parseFloat((e.target as HTMLInputElement).value))}
                        />
                        <span className="scale-value">{dragScale.toFixed(1)}×</span>
                    </div>
                </div>
                <div className="scale-presets">
                    {SCALE_PRESETS.map((preset) => (
                        <button
                            key={preset.value}
                            className={`scale-preset${uiScale === preset.value ? ' active' : ''}`}
                            onClick={() => commitScale(preset.value)}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
                <div className="settings-hint">拖动滑块或点击预设调整界面大小（0.5× ~ 2.0×）</div>
            </div>

            {/* ── 叙事 ── */}
            <div className="settings-section">
                <div className="settings-section-title">叙事</div>
                <div className="settings-row">
                    <span className="settings-label">逐字显示</span>
                    <label className="toggle-switch">
                        <input type="checkbox" checked={typewriter} onChange={(e) => setTypewriter(e.target.checked)} />
                        <span className="toggle-slider" />
                    </label>
                </div>
                <div className="settings-hint">开启后事件描述会逐字打出，点击文字可跳过</div>
            </div>

            {/* ── 返回 ── */}
            <button className="settings-back" onClick={() => navigate('/')}>
                ← 返回主菜单
            </button>
        </div>
    )
}
