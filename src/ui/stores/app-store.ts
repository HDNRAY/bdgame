import { create } from 'zustand'
import type { CharacterBuild } from '../../engine/entities/character-build'
import type { BattleSnapshot } from '../../engine/combat/types'
import type { Character } from '../../engine/entities/character'

// ── 主题与缩放配置 ──

export type ThemeMode = 'light' | 'dark' | 'system'

export interface UiConfig {
    theme: ThemeMode
    uiScale: number // 0.5 ~ 2.0
    typewriter: boolean // 逐字显示
}

const UI_CONFIG_KEY = 'bdgame-ui-config'

function loadUiConfig(): UiConfig {
    try {
        const raw = localStorage.getItem(UI_CONFIG_KEY)
        if (raw) return JSON.parse(raw)
    } catch {
        /* ignore */
    }
    return { theme: 'system', uiScale: 1, typewriter: true }
}

function saveUiConfig(config: UiConfig) {
    localStorage.setItem(UI_CONFIG_KEY, JSON.stringify(config))
}

// ── 计算当前生效主题 ──

export function getEffectiveTheme(theme: ThemeMode): 'light' | 'dark' {
    if (theme !== 'system') return theme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// ── Store ──

interface AppState {
    lastBuilds: { a: CharacterBuild; b: CharacterBuild } | null
    battleKey: number
    battleData: {
        log: string[]
        eventToLine: number[]
        chars: { a: Character; b: Character }
        entries: unknown[]
        snapshots: BattleSnapshot[]
    } | null
    currentSnapshot: BattleSnapshot | null
    uiConfig: UiConfig

    setLastBuilds: (builds: { a: CharacterBuild; b: CharacterBuild }) => void
    setBattleData: (data: AppState['battleData']) => void
    setCurrentSnapshot: (snap: BattleSnapshot | null) => void
    incrementBattleKey: () => void
    setTheme: (theme: ThemeMode) => void
    setUiScale: (scale: number) => void
    setTypewriter: (enabled: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
    lastBuilds: null,
    battleKey: 0,
    battleData: null,
    currentSnapshot: null,
    uiConfig: loadUiConfig(),

    setLastBuilds: (builds) => set({ lastBuilds: builds }),
    setBattleData: (data) => set({ battleData: data }),
    setCurrentSnapshot: (snap) => set({ currentSnapshot: snap }),
    incrementBattleKey: () => set((s) => ({ battleKey: s.battleKey + 1 })),

    setTheme: (theme) =>
        set((s) => {
            const next = { ...s.uiConfig, theme }
            saveUiConfig(next)
            return { uiConfig: next }
        }),

    setUiScale: (uiScale) =>
        set((s) => {
            const clamped = Math.min(2, Math.max(0.5, uiScale))
            const next = { ...s.uiConfig, uiScale: clamped }
            saveUiConfig(next)
            return { uiConfig: next }
        }),

    setTypewriter: (typewriter) =>
        set((s) => {
            const next = { ...s.uiConfig, typewriter }
            saveUiConfig(next)
            return { uiConfig: next }
        }),
}))
