import { describe, it, expect, vi, beforeEach } from 'vitest'

const battle = vi.hoisted(() => ({ playerWins: true }))

vi.mock('../../engine/battle-runner', () => ({
    runBattle: (_player: unknown, enemy: { id: string }) => ({
        winner: battle.playerWins ? 'player' : enemy.id,
        engine: { state: { log: { getAll: () => [] } } },
    }),
    simulateWinRate: () => ({ aWins: 1, bWins: 0 }),
}))

import { RogueliteRun } from '../roguelite/engine'
import { STORIES } from '../../data/stories'
import { getEvent } from '../../data/events'
import { loadMeta, setMetaStorage } from '../meta-save'

function fakeStorage() {
    const map = new Map<string, string>()
    return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
    }
}

/** 走一局时逐轮记下的信息（state.rounds 在 finished 时会被清空，所以要边走边记） */
interface SeenRound {
    node: number
    title: string
    labels: string[]
    descs: (string | undefined)[]
    hasBoss: boolean
    bossName?: string
    rewardCount: number
}

interface DriveOpts {
    /** 出现该 label 就选它（其余轮次一律选第一项） */
    pickLabel?: string
    /** 只在第一次出现时选它，之后照常选第一项 */
    pickLabelOnce?: string
    /** 走到该标题的轮次时把战斗改成必败（用来打「陨落于山腹」） */
    loseFromTitle?: string
}

/** 打完一整局：选第一条故事线，之后每轮点第一个选项（或指定的 label） */
function driveToEnd(opts: DriveOpts = {}): { run: RogueliteRun; seen: SeenRound[] } {
    battle.playerWins = true
    const run = new RogueliteRun()
    const seen: SeenRound[] = []

    const record = () => {
        const st = run.getState()
        const r = st.rounds[st.rounds.length - 1]
        if (!r) return
        seen.push({
            node: st.nodeIndex,
            title: r.title,
            labels: r.choices.map((c) => c.label),
            descs: r.choices.map((c) => c.description),
            hasBoss: !!r.enemyBuild,
            bossName: r.bossName,
            rewardCount: st.build.rewards.length,
        })
    }

    const first = run.getState().rounds[0]
    const originName = getEvent(STORIES[0].originEventId)?.name
    run.selectChoice(Math.max(0, first.choices.findIndex((c) => c.label === originName)))
    record()

    let usedOnce = false
    let guard = 0
    while (!run.getState().finished && guard++ < 900) {
        const st = run.getState()
        const r = st.rounds[st.rounds.length - 1]
        if (!r || r.choices.length === 0) break
        // 下一轮的选项是在推轮时就结算的：要输掉某场战斗，得在点它之前改结果
        if (opts.loseFromTitle && r.title === opts.loseFromTitle) battle.playerWins = false
        const wanted = opts.pickLabel ? r.choices.findIndex((c) => c.label === opts.pickLabel) : -1
        const once =
            !usedOnce && opts.pickLabelOnce ? r.choices.findIndex((c) => c.label === opts.pickLabelOnce) : -1
        if (once >= 0) usedOnce = true
        run.selectChoice(once >= 0 ? once : wanted >= 0 ? wanted : 0)
        record()
    }
    return { run, seen }
}

const find = (seen: SeenRound[], title: string) => seen.find((s) => s.title === title)

describe('终局流程（n33 → 山腹）', () => {
    beforeEach(() => {
        setMetaStorage(fakeStorage())
    })

    it('首次通关：跳过隐藏boss，只给「回到过去」，并落档', () => {
        const { run, seen } = driveToEnd()
        const st = run.getState()

        expect(find(seen, '最后一扇门')).toBeDefined()
        expect(find(seen, '石室')).toBeDefined()
        // 没有通关记录 → 隐藏boss 那一轮（连同胜负分支轮）被引擎跳过，那具躯体不出现
        expect(seen.some((s) => s.hasBoss)).toBe(false)
        expect(find(seen, '「东西」前面站着一个人')).toBeUndefined()
        expect(find(seen, '击败')).toBeUndefined()
        expect(find(seen, '收招')).toBeUndefined()

        const thing = find(seen, '「东西」面前')!
        // 首次通关没有「转身，离开」；「回到过去」附上那句愿望
        expect(thing.labels).toEqual(['回到过去', '我要变强'])
        expect(thing.descs[0]).toBe('我想再见见那些已经不在的人。')
        expect(find(seen, '陨落于山腹')).toBeUndefined()

        expect(st.finished).toBe(true)
        const meta = loadMeta()
        // runs 由 store 的 confirmWorldIntro 记（本测试只驱动 RogueliteRun）
        expect(meta.runs).toBe(0)
        expect(meta.clears).toBe(1)
        expect(meta.loopClears).toBe(1)
        expect(meta.trueEndingDone).toBe(false)
        expect(meta.lastWinEnding).toBe('loop')
        expect(meta.lastWinBuild?.rewards.length).toBeGreaterThan(0)
    })

    it('二次通关：出现隐藏boss（上一轮 build），给出「击败」与两条结局选项', () => {
        driveToEnd()
        expect(loadMeta().clears).toBe(1)

        const { run, seen } = driveToEnd()
        const boss = find(seen, '「东西」前面站着一个人')
        expect(boss).toBeDefined()
        expect(boss?.hasBoss).toBe(true)
        expect(boss?.bossName).toBe('斗炁协会副会长')
        expect(boss?.labels).toEqual(['收招'])

        // 胜 → 胜负分歧轮只留「去看」→「击败」→「东西」面前
        const branch = find(seen, '收招')
        expect(branch?.labels).toEqual(['去看'])
        expect(find(seen, '击败')).toBeDefined()

        const thing = find(seen, '「东西」面前')!
        expect(thing.labels).toEqual(['回到过去', '我要变强', '转身，离开。'])

        expect(run.getState().finished).toBe(true)
        const meta = loadMeta()
        expect(meta.bossWins).toBe(1)
        expect(meta.bossLosses).toBe(0)
        expect(meta.clears).toBe(2)
        expect(meta.lastWinEnding).toBe('loop')
    })

    it('选「我要变强」→ 被蛊惑一轮，再回到「东西」面前重选', () => {
        driveToEnd()
        const { run, seen } = driveToEnd({ pickLabelOnce: '我要变强' })

        const taunt = find(seen, '蛊惑')
        expect(taunt).toBeDefined()
        expect(taunt?.labels).toEqual(['沉默'])
        // 蛊惑之后回到同一轮，选项重新给出（仍能正常走到结局）
        expect(seen.filter((s) => s.title === '「东西」面前').length).toBeGreaterThanOrEqual(2)
        expect(run.getState().finished).toBe(true)
        expect(loadMeta().clears).toBe(2)
        expect(loadMeta().bossWins).toBe(1)
    })

    it('二次通关选「转身，离开」→ 要连选三次（每次都被蛊惑一句）才到真结局', () => {
        driveToEnd()
        const { seen } = driveToEnd({ pickLabel: '转身，离开。' })
        // 前两次转身都被绕回「东西」面前，第三次才走得到结局轮
        expect(find(seen, '蛊惑（一）')).toBeDefined()
        expect(find(seen, '蛊惑（二）')).toBeDefined()
        expect(seen.filter((s) => s.title === '「东西」面前').length).toBe(3)
        expect(find(seen, '转身，离开')).toBeDefined()

        const meta = loadMeta()
        expect(meta.trueEndingDone).toBe(true)
        expect(meta.lastWinEnding).toBe('true')
        expect(meta.clears).toBe(2)
        expect(meta.loopClears).toBe(1)
    })

    it('「转身，离开」只选一次 → 被蛊惑一轮后回到原处，走不到真结局', () => {
        driveToEnd()
        const { run, seen } = driveToEnd({ pickLabelOnce: '转身，离开。' })
        expect(find(seen, '蛊惑（一）')).toBeDefined()
        expect(find(seen, '蛊惑（二）')).toBeUndefined()
        expect(find(seen, '转身，离开')).toBeUndefined()
        expect(run.getState().flags['leave_step']).toBe(1)

        // 之后照常选了第一项 → 循环结局
        const meta = loadMeta()
        expect(meta.trueEndingDone).toBe(false)
        expect(meta.lastWinEnding).toBe('loop')
        expect(meta.clears).toBe(2)
    })

    it('败给隐藏boss → 「陨落于山腹」，本局结束且不落通关档', () => {
        driveToEnd()
        expect(loadMeta().clears).toBe(1)

        const { run, seen } = driveToEnd({ loseFromTitle: '石室' })
        // 走进石室那一刻改判：boss 战必败，胜负分歧轮只剩「闭眼」
        expect(find(seen, '收招')?.labels).toEqual(['闭眼'])
        expect(find(seen, '击败')).toBeUndefined()
        expect(find(seen, '「东西」面前')).toBeUndefined()
        expect(find(seen, '陨落于山腹')?.labels).toEqual(['闭眼'])

        expect(run.getState().finished).toBe(true)
        const meta = loadMeta()
        expect(meta.bossLosses).toBe(1)
        expect(meta.bossWins).toBe(0)
        // 没有许愿 → 不记通关，最近通关记录仍是上一局
        expect(meta.clears).toBe(1)
        expect(meta.loopClears).toBe(1)
        expect(meta.lastWinEnding).toBe('loop')
    })
})
