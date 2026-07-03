import { create } from 'zustand'
import { RogueliteRun } from '../../engine/systems/roguelite/engine'
import type { GameState } from '../../engine/entities/state'
import type { CharacterBuild } from '../../engine/entities/character-build'

interface RogueliteState {
    engine: RogueliteRun
    gameState: GameState | null
    mode: 'view' | 'build'

    select: (index: number) => void
    setMode: (mode: 'view' | 'build') => void
    saveBuild: (build: CharacterBuild) => void
    reset: () => void
}

function createEngine(): RogueliteRun {
    const engine = new RogueliteRun()
    return engine
}

export const useRogueliteStore = create<RogueliteState>((set, get) => {
    const engine = createEngine()

    engine.subscribe((state) => {
        console.log('RogueliteStore: state updated', state.rounds)
        set({ gameState: state })
    })

    return {
        engine,
        gameState: engine.getState(),
        mode: 'view',

        select: (index: number) => {
            get().engine.selectChoice(index)
        },

        setMode: (mode) => set({ mode }),

        saveBuild: (build) => {
            get().engine.updateBuild(build)
            set({ mode: 'view' })
        },

        reset: () => {
            const engine = createEngine()
            engine.subscribe((state) => {
                set({ engine, gameState: state })
            })
            set({ engine, gameState: engine.getState(), mode: 'view' })
        },
    }
})
