import { describe, it, expect, beforeEach } from 'vitest'
import type { CharacterBuild } from '../entities/character-build'
import {
    META_SAVE_KEY,
    emptyMeta,
    hasCleared,
    loadMeta,
    recordBossResult,
    recordClear,
    recordRunStart,
    resetMeta,
    saveMeta,
    setMetaStorage,
    updateMeta,
} from '../meta-save'

/** 内存版 localStorage */
function fakeStorage() {
    const map = new Map<string, string>()
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
        raw: map,
    }
}

const build = (name: string): CharacterBuild => ({
    id: name,
    name,
    battleStyle: 'melee',
    baseAttrs: { strength: 10 },
    weapon: 'peach_sword',
    rewards: [],
})

describe('meta-save', () => {
    let store: ReturnType<typeof fakeStorage>

    beforeEach(() => {
        store = fakeStorage()
        setMetaStorage(store)
    })

    it('无档时返回空档', () => {
        expect(loadMeta()).toEqual(emptyMeta())
        expect(hasCleared()).toBe(false)
    })

    it('无后端时不抛错（禁用持久化）', () => {
        setMetaStorage(null)
        expect(loadMeta()).toEqual(emptyMeta())
        expect(recordRunStart().runs).toBe(1)
        expect(() => resetMeta()).not.toThrow()
    })

    it('开局累计轮数', () => {
        recordRunStart()
        recordRunStart()
        expect(loadMeta().runs).toBe(2)
        expect(hasCleared()).toBe(false)
    })

    it('通关记录结局、成绩与 build', () => {
        const m = recordClear({ build: build('甲'), ending: 'loop', injuries: 30, rewards: 13, at: 1000 })
        expect(m.clears).toBe(1)
        expect(m.loopClears).toBe(1)
        expect(m.trueEndingDone).toBe(false)
        expect(m.lastWinEnding).toBe('loop')
        expect(m.lastWinAt).toBe(1000)
        expect(m.lastWinBuild?.name).toBe('甲')
        expect(m.bestClear).toEqual({ injuries: 30, rewards: 13, at: 1000 })
        expect(hasCleared()).toBe(true)

        const m2 = recordClear({ build: build('乙'), ending: 'true', injuries: 10, rewards: 12, at: 2000 })
        expect(m2.clears).toBe(2)
        expect(m2.trueEndingDone).toBe(true)
        expect(m2.lastWinEnding).toBe('true')
        expect(m2.lastWinBuild?.name).toBe('乙')
        // 伤势更少 → 刷新最佳
        expect(m2.bestClear?.injuries).toBe(10)
    })

    it('最佳通关：先比伤势，再比奖励', () => {
        recordClear({ build: build('a'), ending: 'loop', injuries: 20, rewards: 5, at: 1 })
        recordClear({ build: build('b'), ending: 'loop', injuries: 20, rewards: 9, at: 2 })
        expect(loadMeta().bestClear?.rewards).toBe(9)
        recordClear({ build: build('c'), ending: 'loop', injuries: 25, rewards: 13, at: 3 })
        expect(loadMeta().bestClear?.rewards).toBe(9)
    })

    it('隐藏boss 战绩分开记', () => {
        recordBossResult(true)
        recordBossResult(false)
        recordBossResult(false)
        const m = loadMeta()
        expect(m.bossWins).toBe(1)
        expect(m.bossLosses).toBe(2)
    })

    it('损坏 JSON / 版本不符 → 按空档处理', () => {
        store.raw.set(META_SAVE_KEY, '{ 坏档')
        expect(loadMeta()).toEqual(emptyMeta())
        store.raw.set(META_SAVE_KEY, JSON.stringify({ schemaVersion: 999, runs: 5 }))
        expect(loadMeta()).toEqual(emptyMeta())
        store.raw.set(META_SAVE_KEY, JSON.stringify({ runs: 3 }))
        expect(loadMeta()).toEqual(emptyMeta())
    })

    it('脏字段被收敛成默认值', () => {
        store.raw.set(
            META_SAVE_KEY,
            JSON.stringify({ schemaVersion: 1, runs: 'x', clears: null, bossWins: 2, trueEndingDone: 'yes' }),
        )
        const m = loadMeta()
        expect(m.runs).toBe(0)
        expect(m.clears).toBe(0)
        expect(m.bossWins).toBe(2)
        expect(m.trueEndingDone).toBe(false)
    })

    it('清档后回到空档', () => {
        recordRunStart()
        resetMeta()
        expect(loadMeta()).toEqual(emptyMeta())
    })

    it('updateMeta 就地读改写，并重新盖上当前版本号', () => {
        saveMeta({ ...emptyMeta(), runs: 1, schemaVersion: 0 })
        const m = updateMeta((x) => {
            x.bossWins += 1
        })
        expect(m.bossWins).toBe(1)
        expect(m.schemaVersion).toBe(1)
        expect(loadMeta().bossWins).toBe(1)
    })
})
