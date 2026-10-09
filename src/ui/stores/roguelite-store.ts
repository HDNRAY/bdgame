import { create } from 'zustand'
import { RogueliteRun } from '../../game/roguelite/engine'
import { recordRunStart } from '../../game/meta-save'
import { track } from '../../bridge/analytics'
import { diffRunEvents } from './roguelite-analytics'
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
    /** 真结局的终章页是否已读过（本局；读完才显示结算页） */
    endingSeen: boolean

    select: (index: number) => void
    setMode: (mode: 'view' | 'build') => void
    saveBuild: (build: CharacterBuild) => void
    confirmWorldIntro: () => void
    confirmChapterIntro: () => void
    confirmEnding: () => void
    reset: () => void
}

export const useRogueliteStore = create<RogueliteState>((set, get) => {
    /** 订阅引擎：同步 gameState，并在跨过 11→12 / 22→23 时弹章节页 */
    function watch(engine: RogueliteRun): void {
        let lastNode = engine.getState().nodeIndex
        // 埋点差分基线（上一份快照）。`run_end.node` 取基线里的 nodeIndex：结局那一步引擎
        // 先自增到 34 再判结束，直接读 next.nodeIndex 会拿到 34
        let prevState = engine.getState()
        // 同一次 emit 里可能先打一场再结束（大会决赛落败）：事件顺序由 diffRunEvents 固定
        engine.subscribe((state) => {
            set({ gameState: state })
            for (const c of diffRunEvents(prevState, state)) track(c.event, c.data)
            prevState = state
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
        endingSeen: false,

        select: (index: number) => {
            get().engine.selectChoice(index)
        },

        setMode: (mode) => set({ mode }),

        saveBuild: (build: CharacterBuild, remainingPoints?: number) => {
            get().engine.updateBuild(build, remainingPoints)
            set({ mode: 'view' })
        },

        confirmWorldIntro: () => {
            // 进入本局（元进度：总轮数 +1；跨局存档见 docs/ending-design.md 第四节）
            recordRunStart()
            // 开局埋点：这条路径只走 store 的 set，不经过引擎 _emit()，订阅差分看不到它，必须显式发
            const st = get().gameState
            track('run_start', { has_cleared: st?.flags['cleared_before'] === true })
            // 首屏背景读完后紧接「第一章」章页（此时还没选故事线，正文用公共文案）
            set({ worldIntroShown: true, chapterIntro: { chapter: 1, story: '' } })
        },

        confirmEnding: () => set({ endingSeen: true }),

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
                endingSeen: false,
            })
        },
    }
})
