import { create } from 'zustand'
import { RogueliteRun } from '../../engine/systems/roguelite/engine'
import type { GameState } from '../../engine/entities/state'

interface RogueliteState {
    engine: RogueliteRun
    gameState: GameState | null
    isPrepping: boolean

    select: (index: number) => void
    enterPrep: () => void
    exitPrep: () => void
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
        isPrepping: false,

        select: (index: number) => {
            get().engine.selectChoice(index)
        },

        enterPrep: () => set({ isPrepping: true }),
        exitPrep: () => set({ isPrepping: false }),

        reset: () => {
            const engine = createEngine()
            engine.subscribe((state) => {
                set({ engine, gameState: state })
            })
            set({ engine, gameState: engine.getState(), isPrepping: false })
        },
    }
})
