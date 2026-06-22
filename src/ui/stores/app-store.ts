import { create } from 'zustand'
import type { CharacterBuild } from '../../engine/entities/character-build'
import type { BattleSnapshot } from '../../engine/combat/types'
import type { Character } from '../../engine/entities/character'

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

    setLastBuilds: (builds: { a: CharacterBuild; b: CharacterBuild }) => void
    setBattleData: (data: AppState['battleData']) => void
    setCurrentSnapshot: (snap: BattleSnapshot | null) => void
    incrementBattleKey: () => void
}

export const useAppStore = create<AppState>((set) => ({
    lastBuilds: null,
    battleKey: 0,
    battleData: null,
    currentSnapshot: null,

    setLastBuilds: (builds) => set({ lastBuilds: builds }),
    setBattleData: (data) => set({ battleData: data }),
    setCurrentSnapshot: (snap) => set({ currentSnapshot: snap }),
    incrementBattleKey: () => set((s) => ({ battleKey: s.battleKey + 1 })),
}))
