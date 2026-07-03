import { create } from 'zustand'
import { RogueliteRun } from '../../engine/systems/roguelite/engine'
import type { GameState } from '../../engine/entities/state'

interface RogueliteState {
    engine: RogueliteRun
    gameState: GameState | null
    mode: 'view' | 'build'

    select: (index: number) => void
    setMode: (mode: 'view' | 'build') => void
    reset: () => void
}

function createEngine(): RogueliteRun {
    const engine = new RogueliteRun()
    return engine
}

export const useRogueliteStore = create<RogueliteState>((set, get) => {
    const engine = createEngine()

    engine.subscribe((state) => {
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

        reset: () => {
            const engine = createEngine()
            engine.subscribe((state) => {
                set({ engine, gameState: state })
            })
            set({ engine, gameState: engine.getState(), mode: 'view' })
        },
    }
})
