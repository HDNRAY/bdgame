import { create } from 'zustand'
import { RogueliteRun } from '../../game/roguelite/engine'
import type { GameState } from '../../game/entities/state'
import type { CharacterBuild } from '../../game/entities/character-build'

interface ChapterIntro {
    chapter: number
    /** 故事线 id；第一章在选线之前播放，此时为空串 */
    story: string
}

interface RogueliteState {
    engine: RogueliteRun
    gameState: GameState | null
    mode: 'view' | 'build'

    /** 开场背景页（选线前）是否已看过（新 run 重置为 false） */
    worldIntroShown: boolean
    /** 当前要展示的章节页（null = 无） */
    chapterIntro: ChapterIntro | null
    /** 本 run 已展示过的章节号 */
    chaptersShown: number[]

    select: (index: number) => void
    setMode: (mode: 'view' | 'build') => void
    saveBuild: (build: CharacterBuild) => void
    confirmWorldIntro: () => void
    confirmChapterIntro: () => void
    reset: () => void
}

export const useRogueliteStore = create<RogueliteState>((set, get) => {
    /** 订阅引擎：同步 gameState，并在跨过 11→12 / 22→23 时弹章节页 */
    function watch(engine: RogueliteRun): void {
        let lastNode = engine.getState().nodeIndex
        engine.subscribe((state) => {
            set({ gameState: state })
            const s = get()
            if (s.chapterIntro) return
            if (state.nodeIndex === 12 && lastNode < 12 && state.build.story && !s.chaptersShown.includes(2)) {
                set({ chapterIntro: { chapter: 2, story: state.build.story } })
            } else if (state.nodeIndex === 23 && lastNode < 23 && state.build.story && !s.chaptersShown.includes(3)) {
                set({ chapterIntro: { chapter: 3, story: state.build.story } })
            }
            lastNode = state.nodeIndex
        })
    }

    const engine = new RogueliteRun()
    watch(engine)

    return {
        engine,
        gameState: engine.getState(),
        mode: 'view',
        worldIntroShown: false,
        chapterIntro: null,
        chaptersShown: [],

        select: (index: number) => {
            get().engine.selectChoice(index)
        },

        setMode: (mode) => set({ mode }),

        saveBuild: (build: CharacterBuild, remainingPoints?: number) => {
            get().engine.updateBuild(build, remainingPoints)
            set({ mode: 'view' })
        },

        confirmWorldIntro: () =>
            // 首屏背景读完后紧接「第一章」章页（此时还没选故事线，正文用公共文案）
            set({ worldIntroShown: true, chapterIntro: { chapter: 1, story: '' } }),

        confirmChapterIntro: () => {
            const ci = get().chapterIntro
            if (!ci) return
            set((s) => ({
                chapterIntro: null,
                chaptersShown: s.chaptersShown.includes(ci.chapter) ? s.chaptersShown : [...s.chaptersShown, ci.chapter],
            }))
        },

        reset: () => {
            const engine = new RogueliteRun()
            watch(engine)
            set({
                engine,
                gameState: engine.getState(),
                mode: 'view',
                worldIntroShown: false,
                chapterIntro: null,
                chaptersShown: [],
            })
        },
    }
})
