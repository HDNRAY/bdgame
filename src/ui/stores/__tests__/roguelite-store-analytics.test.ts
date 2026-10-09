import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * store 层埋点接线的集成验证：走**真实引擎**，只把发送后端换成假实现。
 *
 * 覆盖 `diffRunEvents` 覆盖不到的两件事：
 * 1. `run_start` 走的是 store 的 `set`（不经引擎 `_emit()`），订阅差分看不见它 —— 只有真跑一次
 *    `confirmWorldIntro()` 才能证明它确实发了、参数取的是开局时的 `flags.cleared_before`；
 * 2. store 的 `watch()` 是否真的把 `diffRunEvents` 的结果转成了 `track()` 调用。
 *
 * `window.umami` 不存在，全靠 `setAnalyticsBackend` 注入缝；不会产生任何网络请求。
 */

/** 内存版 localStorage（meta-save 的注入缝，见 src/game/meta-save.ts） */
function fakeStorage() {
    const map = new Map<string, string>()
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
    }
}

/** 已通关存档：让 `hasCleared()` 为真（引擎构造时写入 flags.cleared_before） */
const CLEARED_META = JSON.stringify({
    schemaVersion: 1,
    runs: 3,
    clears: 2,
    loopClears: 1,
    trueEndingDone: false,
    bossWins: 1,
    bossLosses: 0,
})

const { setMetaStorage } = await import('../../../game/meta-save')
const storage = fakeStorage()
storage.setItem('dantiao:meta:v1', CLEARED_META)
setMetaStorage(storage)

const { setAnalyticsBackend } = await import('../../../bridge/analytics')
const { useRogueliteStore } = await import('../roguelite-store')

interface Call {
    event: string
    data: unknown
}

function installBackend(): Call[] {
    const calls: Call[] = []
    setAnalyticsBackend({
        track(event: string, data?: unknown) {
            calls.push({ event, data })
        },
    })
    return calls
}

describe('store 埋点接线（真实引擎）', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5)
        useRogueliteStore.getState().reset()
    })
    afterEach(() => {
        vi.restoreAllMocks()
        setMetaStorage(null)
    })

    it('confirmWorldIntro 显式发 run_start，has_cleared 取开局旗标', () => {
        const calls = installBackend()
        useRogueliteStore.getState().confirmWorldIntro()
        expect(calls).toEqual([{ event: 'run_start', data: { has_cleared: true } }])
    })

    it('选故事线走订阅差分发 story_pick；打到第一场战斗发 battle_end（每个节点最多一次）', () => {
        const calls = installBackend()
        const store = () => useRogueliteStore.getState()
        store().confirmWorldIntro()
        calls.length = 0 // run_start 已在上一用例单独验证

        // 逐轮取第一项（不写死具体选项，故事线的位置可能变）：第一次写进 build.story 时应当发 story_pick
        let storyPicked = false
        for (let turn = 0; turn < 40 && !storyPicked; turn++) {
            const st = store().gameState
            if (!st) break
            const round = st.rounds[st.rounds.length - 1]
            if (!round || round.choices.length === 0) break
            store().select(0)
            storyPicked = !!store().gameState?.build.story
        }
        expect(storyPicked, '40 轮内应能选到故事线').toBe(true)
        const picks = calls.filter((c) => c.event === 'story_pick')
        expect(picks).toHaveLength(1)
        expect(picks[0].data).toEqual({ story: store().gameState?.build.story })

        // 继续打到第一场正式战斗结算；教学观战轮（tutorial）不该产生事件
        let battles = 0
        for (let turn = 0; turn < 120 && battles === 0; turn++) {
            const st = store().gameState
            if (!st || st.finished) break
            const round = st.rounds[st.rounds.length - 1]
            if (!round || round.choices.length === 0) break
            store().select(0)
            battles = store().gameState?.runBattles?.total ?? 0
        }
        expect(battles, '应至少打了一场正式战斗').toBeGreaterThan(0)
        const battleCalls = calls.filter((c) => c.event === 'battle_end')
        expect(battleCalls).toHaveLength(battles)
        expect(battleCalls[0].data).toMatchObject({
            won: expect.any(Boolean),
            champion_boss: false,
            tournament: false,
            injury: expect.any(Number),
        })
        // 没有任何逐节点事件混进来
        expect(calls.every((c) => c.event === 'story_pick' || c.event === 'battle_end')).toBe(true)
    })
})
