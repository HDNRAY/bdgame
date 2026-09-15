import type { CharacterBuild } from './entities/character-build'

/**
 * 元进度存档（跨局的「游戏结果」）。
 * 设计见 `docs/ending-design.md` 第四节：总轮数 / 通关数 / 循环结局次数 / 真结局标记 /
 * 隐藏boss 战绩 / 最近一次通关的完整 build（n33.5 隐藏boss 的来源）。
 *
 * 后端默认用 localStorage；测试注入假实现（`setMetaStorage`）或传 null 禁用。
 */
export const META_SAVE_KEY = 'dantiao:meta:v1'
export const META_SCHEMA_VERSION = 1

/** 一次通关的成绩快照 */
export interface MetaClearRecord {
    injuries: number
    rewards: number
    at: number
}

export interface MetaSave {
    schemaVersion: number
    /** 总轮数：每开一局 +1 */
    runs: number
    /** 通关数：打过 n33 决赛 */
    clears: number
    /** 循环结局（许愿回到过去）次数 */
    loopClears: number
    /** 真结局（转身离开）是否达成 */
    trueEndingDone: boolean
    /** 击败隐藏boss 次数 */
    bossWins: number
    /** 败给隐藏boss 次数 */
    bossLosses: number
    /** 最漂亮的一次通关：先比伤势少，再比奖励多 */
    bestClear?: MetaClearRecord
    /** 最近一次通关的时间戳 */
    lastWinAt?: number
    /** 最近一次通关的结局种类 */
    lastWinEnding?: 'loop' | 'true'
    /** 最近一次通关的完整 build（下一局 n33.5 隐藏boss 用） */
    lastWinBuild?: CharacterBuild
}

/** 存档后端（浏览器即 localStorage） */
export interface MetaStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

function defaultStorage(): MetaStorage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}

let backend: MetaStorage | null | undefined
function storage(): MetaStorage | null {
    if (backend === undefined) backend = defaultStorage()
    return backend
}

/** 注入存档后端（测试用；传 null 禁用持久化） */
export function setMetaStorage(s: MetaStorage | null): void {
    backend = s
}

export function emptyMeta(): MetaSave {
    return {
        schemaVersion: META_SCHEMA_VERSION,
        runs: 0,
        clears: 0,
        loopClears: 0,
        trueEndingDone: false,
        bossWins: 0,
        bossLosses: 0,
    }
}

function num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** 把任意来源的对象收敛成合法存档（缺字段补默认，脏数据丢弃） */
function normalize(raw: unknown): MetaSave | null {
    if (!raw || typeof raw !== 'object') return null
    const o = raw as Record<string, unknown>
    if (num(o.schemaVersion) !== META_SCHEMA_VERSION) return null
    const meta = emptyMeta()
    meta.runs = num(o.runs)
    meta.clears = num(o.clears)
    meta.loopClears = num(o.loopClears)
    meta.trueEndingDone = o.trueEndingDone === true
    meta.bossWins = num(o.bossWins)
    meta.bossLosses = num(o.bossLosses)
    if (o.bestClear && typeof o.bestClear === 'object') {
        const b = o.bestClear as Record<string, unknown>
        meta.bestClear = { injuries: num(b.injuries), rewards: num(b.rewards), at: num(b.at) }
    }
    if (typeof o.lastWinAt === 'number') meta.lastWinAt = o.lastWinAt
    if (o.lastWinEnding === 'loop' || o.lastWinEnding === 'true') meta.lastWinEnding = o.lastWinEnding
    if (o.lastWinBuild && typeof o.lastWinBuild === 'object') meta.lastWinBuild = o.lastWinBuild as CharacterBuild
    return meta
}

/** 读档：缺档 / 损坏 / 版本不符都按空档处理 */
export function loadMeta(): MetaSave {
    const s = storage()
    if (!s) return emptyMeta()
    try {
        const raw = s.getItem(META_SAVE_KEY)
        if (!raw) return emptyMeta()
        return normalize(JSON.parse(raw)) ?? emptyMeta()
    } catch {
        return emptyMeta()
    }
}

/** 落盘：写失败（无后端 / 超配额 / 隐私模式）静默忽略 */
export function saveMeta(meta: MetaSave): void {
    const s = storage()
    if (!s) return
    try {
        s.setItem(META_SAVE_KEY, JSON.stringify(meta))
    } catch {
        /* 存不下忽略 */
    }
}

/** 读改写：patch 就地修改当前存档，然后落盘 */
export function updateMeta(patch: (meta: MetaSave) => void): MetaSave {
    const meta = loadMeta()
    patch(meta)
    meta.schemaVersion = META_SCHEMA_VERSION
    saveMeta(meta)
    return meta
}

/** 清档（DevMode 用） */
export function resetMeta(): void {
    const s = storage()
    if (!s) return
    try {
        s.removeItem(META_SAVE_KEY)
    } catch {
        /* 忽略 */
    }
}

/** 是否已有通关记录（决定 n33.5 是否出现、是否给「转身离开」） */
export function hasCleared(): boolean {
    return loadMeta().clears > 0
}

/** 开局 +1 */
export function recordRunStart(): MetaSave {
    return updateMeta((m) => {
        m.runs += 1
    })
}

/** 隐藏boss 战绩 */
export function recordBossResult(won: boolean): MetaSave {
    return updateMeta((m) => {
        if (won) m.bossWins += 1
        else m.bossLosses += 1
    })
}

/** 通关结算：记次数/结局/成绩，并保存本局 build（下次 n33.5 的隐藏boss） */
export function recordClear(input: {
    build: CharacterBuild
    ending: 'loop' | 'true'
    injuries: number
    rewards: number
    at?: number
}): MetaSave {
    const at = input.at ?? Date.now()
    return updateMeta((m) => {
        m.clears += 1
        if (input.ending === 'loop') m.loopClears += 1
        else m.trueEndingDone = true
        m.lastWinAt = at
        m.lastWinEnding = input.ending
        m.lastWinBuild = input.build
        const best = m.bestClear
        const better =
            !best ||
            input.injuries < best.injuries ||
            (input.injuries === best.injuries && input.rewards > best.rewards)
        if (better) m.bestClear = { injuries: input.injuries, rewards: input.rewards, at }
    })
}
