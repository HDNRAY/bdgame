import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CharacterBuild } from '../../../../game/entities/character-build'
import type { ActionConfig } from '../../../../game/entities/action-config'
import { STARTING_WEAPONS } from '../../../../data/weapons/starting-weapons'
import { getWeapon, type WeaponDef } from '../../../../data/weapons/weapons'
import { OPPONENTS, gen } from '../../../../data/opponents'
import { resolveCondition } from '../../../../data/conditions'
import type { Reward } from '../../../../game/entities/reward'
import { CharacterPanel } from '../../../components/CharacterPanel/CharacterPanel'
import { SearchSelect, type SelectOption } from '../../../components/ui/SearchSelect/SearchSelect'
import { runSeries, type SeriesJob, type SeriesResult } from './sim-core'
import { BattlePanel } from '../../../components/BattlePanel/BattlePanel'
import { BattleStatsPanel } from '../../../components/BattleStatsPanel/BattleStatsPanel'
import { BattleStats, type BattleStatsSnapshot } from '../../../../engine/combat/battle-stats'
import './BuildSim.scss'

const SAVE_KEY = 'buildsim-save-v1'
/** 与一局肉鸽一致的属性培养总量：16 次 +4 */
const CULT_POINTS = 64
/** 奖励位上限（不含初始武器） */
const REWARD_CAP = 13
/** 对手等级（与斗炁大会同档） */
const ENEMY_LEVEL = 33
/** 初始武器集合（免费位，不计入奖励位） */
const STARTING_IDS = new Set(STARTING_WEAPONS.map((w) => w.id))

/**
 * 可双持 / 可作副手：单人可持的**单手近战兵器**。
 * one_handed 只是必要条件 —— 还要排除御物（imperial）与长柄（polearm，如千机）。
 */
function isOneHanded(weaponId: string): boolean {
    const def = getWeapon(weaponId)
    if (!def) return false
    const t = def.tags
    return t.includes('one_handed') && !t.includes('imperial') && !t.includes('polearm')
}

function freshBuild(): CharacterBuild {
    return {
        id: 'player',
        name: '构筑',
        story: '',
        battleStyle: 'clinch',
        weapon: 'bare_hands',
        baseAttrs: { strength: 3, vitality: 3, agility: 3, dexterity: 3, insight: 3, wisdom: 3 },
        rewards: [],
        actionConfigs: [],
    }
}

interface Persisted {
    build: CharacterBuild
    initWeaponId: string
    /** A/B 对照：基准组的招式条件（只存 actionConfigs，其余与 build 相同） */
    baseline?: ActionConfig[]
}

/**
 * A/B 对照状态：A = 记录的基准条件，B = 当前编辑的条件，其余构筑完全相同。
 * 两轮跑同一批对手与场次，差异只来自出招条件 —— 用于把「条件怎么写」从玄学变成可测量。
 */
interface SimState {
    status: 'idle' | 'running' | 'done'
    mode: 'single' | 'ab'
    /** 当前进度所在组（A/B 两轮时的提示） */
    phase: '' | 'A' | 'B'
    results: Record<string, SeriesResult>
    resultsA: Record<string, SeriesResult>
    resultsB: Record<string, SeriesResult>
    total: number
}

const N_OPTIONS = [20, 100, 200, 500, 1000]
const STYLE_FILTER = [
    { id: 'all', label: '全部对手' },
    { id: 'clinch', label: '贴身' },
    { id: 'melee', label: '近战' },
    { id: 'mid', label: '中距' },
    { id: 'ranged', label: '远程' },
] as const

function loadPersisted(): Persisted {
    try {
        const raw = localStorage.getItem(SAVE_KEY)
        if (raw) {
            const p = JSON.parse(raw) as Persisted
            if (p?.build) {
                const build = { ...freshBuild(), ...p.build }
                // 非法组合清理：主手非单手（双手/御物）时不能带副手
                if (build.offhand && !isOneHanded(build.weapon)) build.offhand = undefined
                return { build, initWeaponId: p.initWeaponId ?? 'bare_hands', baseline: p.baseline }
            }
        }
    } catch {
        /* 损坏存档忽略 */
    }
    return { build: freshBuild(), initWeaponId: 'bare_hands' }
}

/** 真正带条件（有生效闸门）的招式数，用于展示 A/B 两组到底差在哪 */
const conditionCount = (configs: readonly ActionConfig[]): number => configs.filter((ac) => !!resolveCondition(ac)).length

/**
 * A/B 对照用的可比值：只取「我方」一个角色的数字，按场次折算。
 * 口径与引擎一致（`battle-stats.ts`），这里只做换算，不重算判定。
 */
interface Metrics {
    dealt: number
    casts: number
    hitRate: number | null
    critRate: number | null
    dodgeRate: number | null
    parryRate: number | null
    taken: number
    apSpent: number
    chanSpent: number
    avgDist: number | null
    closeRate: number | null
    statusRate: number | null
}

function metricsOf(snap: BattleStatsSnapshot | undefined, selfId: string): Metrics | null {
    if (!snap || snap.battles <= 0) return null
    const c = snap.chars.find((x) => x.id === selfId)
    if (!c) return null
    const b = snap.battles
    /** 分母为 0（没出手 / 没被判定过）时给 null，界面显示「—」而不是 0% */
    const rate = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null)
    // 命中判定的次数：连发/多段一招多判，所以命中率的分母是「判定」而不是「出手」（用出手会超过 100%）。
    // 被招架只可能发生在命中之后 → 它的分母是命中。
    const checks = c.hits + c.dodged
    return {
        dealt: c.dealt / b,
        casts: c.casts / b,
        hitRate: rate(c.hits, checks),
        critRate: rate(c.crits, c.hits),
        dodgeRate: rate(c.dodged, checks),
        parryRate: rate(c.parried, c.hits),
        taken: c.taken / b,
        apSpent: c.res.apSpent / b,
        chanSpent: c.res.chanSpent / b,
        avgDist: c.distanceSamples > 0 ? c.distanceSum / c.distanceSamples : null,
        closeRate: c.distanceSamples > 0 ? rate(c.closeSamples, c.distanceSamples) : null,
        statusRate: c.statusTried > 0 ? rate(c.statusApplied, c.statusTried) : null,
    }
}

/** A/B 指标行：`better` 决定「变大」是绿还是红（null = 中性，不判好坏） */
const METRIC_ROWS: Array<{ key: keyof Metrics; label: string; digits: number; better: 'high' | 'low' | null }> = [
    { key: 'dealt', label: '输出/场', digits: 1, better: 'high' },
    { key: 'casts', label: '出手/场', digits: 2, better: null },
    { key: 'hitRate', label: '命中率', digits: 1, better: 'high' },
    { key: 'critRate', label: '暴击率', digits: 1, better: 'high' },
    { key: 'dodgeRate', label: '被闪避率', digits: 1, better: 'low' },
    { key: 'parryRate', label: '被招架率', digits: 1, better: 'low' },
    { key: 'taken', label: '承伤/场', digits: 1, better: 'low' },
    { key: 'apSpent', label: '内息消耗/场', digits: 1, better: null },
    { key: 'chanSpent', label: '缠劲消耗/场', digits: 1, better: null },
    { key: 'avgDist', label: '平均交战距离', digits: 2, better: null },
    { key: 'closeRate', label: '1m 内占比', digits: 1, better: null },
    { key: 'statusRate', label: '挂状态成功率', digits: 1, better: 'high' },
]

export function BuildSim() {
    const initial = useMemo(() => loadPersisted(), [])
    const [build, setBuild] = useState<CharacterBuild>(initial.build)
    const [initWeaponId, setInitWeaponId] = useState<string>(initial.initWeaponId)
    const [baseline, setBaseline] = useState<ActionConfig[] | null>(initial.baseline ?? null)
    const [sim, setSim] = useState<SimState>({
        status: 'idle',
        mode: 'single',
        phase: '',
        results: {},
        resultsA: {},
        resultsB: {},
        total: 0,
    })
    const [nGames, setNGames] = useState(100)
    const [styleFilter, setStyleFilter] = useState<(typeof STYLE_FILTER)[number]['id']>('all')
    const [watchOppId, setWatchOppId] = useState<string | null>(null)
    const [statsOppId, setStatsOppId] = useState<string | null>(null)
    const [showOverallStats, setShowOverallStats] = useState(false)
    const abortRef = useRef<{ aborted: boolean }>({ aborted: false })
    const workersRef = useRef<Worker[]>([])

    // 持久化
    useEffect(() => {
        try {
            localStorage.setItem(
                SAVE_KEY,
                JSON.stringify({ build, initWeaponId, baseline: baseline ?? undefined } satisfies Persisted),
            )
        } catch {
            /* 存不下忽略 */
        }
    }, [build, initWeaponId, baseline])

    const isUpgradedWeapon = !STARTING_IDS.has(build.weapon)
    // 奖励里选出的武器槽：第 1 把覆盖初始主手；第 2 把进副手
    const mainSlot = isUpgradedWeapon ? ({ slot: 'main' as const, id: build.weapon } as const) : null
    const offSlot = build.offhand && !STARTING_IDS.has(build.offhand) ? ({ slot: 'off' as const, id: build.offhand } as const) : null
    const weaponSlots = [mainSlot, offSlot].filter((x): x is NonNullable<typeof x> => !!x)
    const usedSlots = build.rewards.length + weaponSlots.length

    // 下一把武器将作为副手（主手已是单手选件且尚无副手）→ 武器页只列单手
    const offhandPickMode = !build.offhand && !STARTING_IDS.has(build.weapon) && isOneHanded(build.weapon)
    const weaponFilter: ((w: WeaponDef) => boolean) | undefined = offhandPickMode ? (w) => isOneHanded(w.id) : undefined

    // 初始武器切换（已选出主手时禁用）
    const handleInitWeapon = (id: string) => {
        setInitWeaponId(id)
        if (!mainSlot) {
            setBuild((b) => ({ ...b, weapon: id, offhand: isOneHanded(id) ? b.offhand : undefined }))
        }
    }
    const handleRemoveWeaponSlot = (slot: 'main' | 'off') => {
        if (slot === 'main') setBuild((b) => ({ ...b, weapon: initWeaponId }))
        else setBuild((b) => ({ ...b, offhand: undefined }))
    }

    const handleAddReward = useCallback(
        (kind: Reward['type'], id: string) => {
            if (kind === 'weapon') {
                // 规则：主手为单手（one_handed 且非御物）才能配副手；副手也只能是单手
                const selCanOffhand = isOneHanded(id)
                const willAddOffhand =
                    !build.offhand && !STARTING_IDS.has(build.weapon) && selCanOffhand && isOneHanded(build.weapon)
                if (willAddOffhand && usedSlots >= REWARD_CAP) return
                setBuild((b) => {
                    const mainCanOffhand = isOneHanded(b.weapon)
                    // 已有副手：单手武器 → 替换副手；非单手 → 只能替换主手（并清掉副手）
                    if (b.offhand) {
                        if (selCanOffhand && mainCanOffhand) return { ...b, offhand: id }
                        return { ...b, weapon: id, offhand: undefined }
                    }
                    // 主手还是初始位 → 这一把覆盖主手
                    if (STARTING_IDS.has(b.weapon)) return { ...b, weapon: id }
                    // 主手已是选件：单手且主手可配副手 → 进副手；否则替换主手
                    if (selCanOffhand && mainCanOffhand) return { ...b, offhand: id }
                    return { ...b, weapon: id, offhand: undefined }
                })
                return
            }
            if (usedSlots >= REWARD_CAP) return
            setBuild((b) => {
                if (b.rewards.some((r) => r.type === kind && r.id === id)) return b
                return { ...b, rewards: [...b.rewards, { id, type: kind, name: id, description: '', tags: [] }] }
            })
        },
        [usedSlots, build.offhand, build.weapon],
    )

    const handleRemoveReward = useCallback((kind: Reward['type'], id: string) => {
        setBuild((b) => ({ ...b, rewards: b.rewards.filter((r) => !(r.type === kind && r.id === id)) }))
    }, [])

    const handleNewBuild = () => {
        setBuild(freshBuild())
        setInitWeaponId('bare_hands')
        setBaseline(null)
        setWatchOppId(null)
        setStatsOppId(null)
        setShowOverallStats(false)
        setSim({ status: 'idle', mode: 'single', phase: '', results: {}, resultsA: {}, resultsB: {}, total: 0 })
        localStorage.removeItem(SAVE_KEY)
    }

    // 已花费修炼点 → 传给面板的剩余额度
    const spentPoints = (() => {
        let cost = 0
        const cultCost = (v: number) => (v >= 20 ? 3 : v >= 14 ? 2 : 1)
        for (const a of ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom'] as const) {
            const v = build.baseAttrs?.[a] ?? 3
            for (let i = 3; i < v; i++) cost += cultCost(i)
        }
        return cost
    })()

    const opponents = useMemo(
        () => OPPONENTS.filter((o) => styleFilter === 'all' || o.battleStyle === styleFilter),
        [styleFilter],
    )

    // ── 试炼执行 ──
    const tick = () => new Promise<void>((r) => setTimeout(r, 0))

    /** 跑一轮（一个 build × 全部对手 × nGames）；worker 不可用时降级主线程 */
    const runPass = async (
        targetBuild: CharacterBuild,
        jobs: SeriesJob[],
        onBatch: (list: SeriesResult[]) => void,
    ): Promise<void> => {
        if (typeof Worker !== 'undefined') {
            const concurrency = Math.min(
                6,
                (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2,
                jobs.length,
            )
            if (concurrency > 0) {
                const chunks: SeriesJob[][] = Array.from({ length: concurrency }, () => [])
                jobs.forEach((j, i) => chunks[i % concurrency].push(j))
                try {
                    await Promise.all(
                        chunks
                            .filter((c) => c.length > 0)
                            .map((jobList) => {
                                const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
                                    type: 'module',
                                })
                                workersRef.current.push(worker)
                                worker.postMessage({ build: targetBuild, jobs: jobList })
                                return new Promise<void>((resolve, reject) => {
                                    worker.onmessage = (e: MessageEvent<SeriesResult[]>) => {
                                        onBatch(e.data)
                                        worker.terminate()
                                        workersRef.current = workersRef.current.filter((w) => w !== worker)
                                        resolve()
                                    }
                                    worker.onerror = () => {
                                        worker.terminate()
                                        workersRef.current = workersRef.current.filter((w) => w !== worker)
                                        reject(new Error('worker-error'))
                                    }
                                })
                            }),
                    )
                    return
                } catch {
                    for (const w of workersRef.current) w.terminate()
                    workersRef.current = []
                    // worker 不可用 → 降级主线程
                }
            }
        }
        for (const job of jobs) {
            if (abortRef.current.aborted) break
            onBatch([runSeries(targetBuild, job, abortRef.current)])
            await tick()
        }
    }

    /** 单轮试炼：当前构筑 */
    const startSim = async () => {
        if (sim.status === 'running') return
        abortRef.current = { aborted: false }
        setSim({
            status: 'running',
            mode: 'single',
            phase: '',
            results: {},
            resultsA: {},
            resultsB: {},
            total: opponents.length,
        })
        setWatchOppId(null)
        setStatsOppId(null)
        setShowOverallStats(false)

        const jobs: SeriesJob[] = opponents.map((o) => ({ opponentId: o.id, n: nGames, level: ENEMY_LEVEL }))
        try {
            await runPass(build, jobs, (list) => {
                setSim((s) => {
                    const results = { ...s.results }
                    for (const r of list) results[r.opponentId] = r
                    const doneCount = Object.keys(results).length
                    return { ...s, results, status: doneCount >= opponents.length ? 'done' : 'running' }
                })
            })
        } finally {
            setSim((s) => ({ ...s, status: abortRef.current.aborted ? 'idle' : s.status }))
        }
    }

    /** A/B 对照试炼：A = 记录的基准条件，B = 当前条件，其余构筑相同 */
    const startAbSim = async () => {
        if (sim.status === 'running' || !baseline) return
        abortRef.current = { aborted: false }
        setSim({
            status: 'running',
            mode: 'ab',
            phase: 'A',
            results: {},
            resultsA: {},
            resultsB: {},
            total: opponents.length,
        })
        setWatchOppId(null)
        setStatsOppId(null)
        setShowOverallStats(false)

        const jobs: SeriesJob[] = opponents.map((o) => ({ opponentId: o.id, n: nGames, level: ENEMY_LEVEL }))
        const buildA: CharacterBuild = { ...build, actionConfigs: baseline }
        const merge = (key: 'resultsA' | 'resultsB') => (list: SeriesResult[]) =>
            setSim((s) => {
                const next = { ...s[key] }
                for (const r of list) next[r.opponentId] = r
                return { ...s, [key]: next }
            })

        await runPass(buildA, jobs, merge('resultsA'))
        if (abortRef.current.aborted) {
            setSim((s) => ({ ...s, status: 'idle', phase: '' }))
            return
        }
        setSim((s) => ({ ...s, phase: 'B' }))
        await runPass(build, jobs, merge('resultsB'))
        setSim((s) => ({ ...s, status: abortRef.current.aborted ? 'idle' : 'done', phase: '' }))
    }

    const stopSim = () => {
        abortRef.current.aborted = true
        for (const w of workersRef.current) w.terminate()
        workersRef.current = []
        setSim((s) => ({ ...s, status: 'idle', phase: '' }))
    }

    /** 记录当前招式条件为对照 A */
    const recordBaseline = () => setBaseline((build.actionConfigs ?? []).map((c) => ({ ...c })))

    // 汇总
    const isAb = sim.mode === 'ab'
    const activeResults = isAb ? sim.resultsA : sim.results
    const progressed = Object.keys(activeResults).length
    const resultRows = opponents
        .map((o) => ({ def: o, r: sim.results[o.id] }))
        .filter((x) => x.r && x.r.done > 0)
    const abRows = opponents
        .map((o) => ({ def: o, a: sim.resultsA[o.id], b: sim.resultsB[o.id] }))
        .filter((x): x is { def: (typeof opponents)[number]; a: SeriesResult; b: SeriesResult } =>
            !!(x.a && x.a.done > 0 && x.b && x.b.done > 0),
        )
    const totalWins = resultRows.reduce((s, x) => s + x.r.wins, 0)
    const totalGames = resultRows.reduce((s, x) => s + x.r.done, 0)
    const overallRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '—'
    const sumRate = (rows: typeof abRows, pick: (x: (typeof abRows)[number]) => SeriesResult) => {
        const w = rows.reduce((s, x) => s + pick(x).wins, 0)
        const g = rows.reduce((s, x) => s + pick(x).done, 0)
        return { wins: w, games: g, rate: g > 0 ? (w / g) * 100 : 0 }
    }
    const rateA = sumRate(abRows, (x) => x.a)
    const rateB = sumRate(abRows, (x) => x.b)
    /** 当前条件的招式数（A 组同构筑，只差条件） */
    const condCountA = baseline ? conditionCount(baseline) : 0
    const condCountB = conditionCount(build.actionConfigs ?? [])
    const watchDef = watchOppId ? OPPONENTS.find((o) => o.id === watchOppId) : null

    // ── 统计（引擎产物，UI 只聚合与展示） ──
    /** 多对手聚合时只留我方一列 —— 三十多个对手全摆出来没人看得清；看单个对手请用每行的「统计」 */
    const selfOnly = (s: BattleStatsSnapshot): BattleStatsSnapshot => ({
        ...s,
        chars: s.chars.filter((c) => c.id === build.id),
    })
    const statsDef = statsOppId ? OPPONENTS.find((o) => o.id === statsOppId) : null
    const statsRow = statsOppId ? sim.results[statsOppId] : undefined
    /** 单轮全部对手合计：把每个对手的快照 merge 起来（口径与引擎一致） */
    const overallStats = (() => {
        if (!showOverallStats) return null
        const merged = BattleStats.mergeSnapshots(
            resultRows.map((x) => x.r.stats).filter((s): s is BattleStatsSnapshot => !!s),
        ).snapshot()
        return selfOnly(merged)
    })()
    /** A/B 两组同一批对手的合计统计（只统计两边都跑到的对手，保证可比） */
    const abStats = (() => {
        if (!isAb) return null
        const rows = abRows.filter((x) => x.a.stats && x.b.stats)
        if (rows.length === 0) return null
        const a = BattleStats.mergeSnapshots(rows.map((x) => x.a.stats!)).snapshot()
        const b = BattleStats.mergeSnapshots(rows.map((x) => x.b.stats!)).snapshot()
        return { a, b, metricsA: metricsOf(a, build.id), metricsB: metricsOf(b, build.id) }
    })()

    return (
        <div className="bsim">
            <div className="bsim-toolbar">
                <h2 className="bsim-title">构筑试炼</h2>
                <label className="bsim-initweapon">
                    初始主手(免费)
                    <SearchSelect
                        value={mainSlot ? '' : build.weapon}
                        options={[
                            ...(mainSlot ? [{ value: '', label: '已选出主手(见奖励位)' }] : []),
                            ...STARTING_WEAPONS.map((w) => ({ value: w.id, label: w.name })),
                        ]}
                        onChange={handleInitWeapon}
                        disabled={!!mainSlot}
                        searchPlaceholder="搜索武器…"
                    />
                </label>
                <span className="bsim-hint">
                    {isOneHanded(build.weapon)
                        ? '完成属性分配后点面板右上「保存」再试炼'
                        : '主手非单手近战兵器（双手/御物/长柄）：不可配副手'}
                </span>
                <button className="bsim-new" onClick={handleNewBuild}>
                    新建构筑
                </button>
            </div>

            <div className="bsim-editor">
                <CharacterPanel
                    mode="build"
                    build={build}
                    unspentCultPoints={CULT_POINTS - spentPoints}
                    onSave={(b) => setBuild(b)}
                    poolMode
                    poolCap={REWARD_CAP}
                    poolUsed={usedSlots}
                    poolWeaponSlots={weaponSlots}
                    onAddReward={handleAddReward}
                    onRemoveReward={handleRemoveReward}
                    onRemoveWeaponSlot={handleRemoveWeaponSlot}
                    poolWeaponFilter={weaponFilter}
                />
            </div>

            {/* ── 试炼台 ── */}
            <section className="bsim-bench">
                <div className="bsim-bench-head">
                    <h3>试炼台</h3>
                    <label>
                        每对手
                        <SearchSelect
                            value={nGames}
                            options={N_OPTIONS.map((n) => ({ value: n, label: `${n} 场` }))}
                            onChange={setNGames}
                            searchPlaceholder="搜索场次…"
                        />
                    </label>
                    <label>
                        范围
                        <SearchSelect
                            value={styleFilter}
                            options={STYLE_FILTER.map((s): SelectOption<typeof styleFilter> => ({ value: s.id, label: s.label }))}
                            onChange={setStyleFilter}
                            searchPlaceholder="搜索范围…"
                        />
                    </label>
                    {sim.status === 'running' ? (
                        <button className="bsim-stop" onClick={stopSim}>
                            停止
                        </button>
                    ) : (
                        <>
                            <button className="bsim-run" onClick={startSim} disabled={opponents.length === 0}>
                                {sim.status === 'done' && !isAb ? '重新试炼' : '开始试炼'}
                            </button>
                            <button
                                className="bsim-run bsim-run-ab"
                                onClick={startAbSim}
                                disabled={opponents.length === 0 || !baseline}
                                title={baseline ? 'A = 记录的条件，B = 当前条件，其余构筑相同' : '先「记录为对照 A」'}
                            >
                                A/B 对比
                            </button>
                        </>
                    )}
                </div>

                {/* A/B 对照：基准条件（只存 actionConfigs，其余与当前构筑相同） */}
                <div className="bsim-baseline">
                    <button className="bsim-baseline-btn" onClick={recordBaseline} disabled={sim.status === 'running'}>
                        {baseline ? '更新对照 A' : '记录为对照 A'}
                    </button>
                    {baseline ? (
                        <>
                            <span className="bsim-baseline-info">
                                对照 A 已记录：{condCountA} 招带条件 · 当前 B：{condCountB} 招带条件
                            </span>
                            <button
                                className="bsim-baseline-clear"
                                onClick={() => setBaseline(null)}
                                disabled={sim.status === 'running'}
                            >
                                清除
                            </button>
                        </>
                    ) : (
                        <span className="bsim-baseline-info">记录当前条件为 A，改完条件再跑 A/B，即可看出条件改动值多少胜率</span>
                    )}
                </div>

                {sim.status === 'running' && (
                    <div className="bsim-progress">
                        {isAb && <b>{sim.phase} 组 </b>}
                        已完 {progressed}/{sim.total} 对手
                    </div>
                )}

                {sim.status === 'done' && !isAb && totalGames > 0 && (
                    <div className="bsim-overall">
                        总胜率 <b>{overallRate}%</b>（{totalWins}/{totalGames}）
                        {resultRows.length > 0 && (
                            <span className="bsim-best">
                                最佳：{(Math.max(...resultRows.map((x) => x.r.wins / x.r.done)) * 100).toFixed(0)}% · 最难：
                                {(Math.min(...resultRows.map((x) => x.r.wins / x.r.done)) * 100).toFixed(0)}%
                            </span>
                        )}
                    </div>
                )}

                {sim.status === 'done' && isAb && rateA.games > 0 && (
                    <div className="bsim-overall">
                        A（记录条件）<b>{rateA.rate.toFixed(1)}%</b>（{rateA.wins}/{rateA.games}） · B（当前条件）
                        <b>{rateB.rate.toFixed(1)}%</b>（{rateB.wins}/{rateB.games}）
                        <span className={`bsim-delta ${rateB.rate >= rateA.rate ? 'up' : 'down'}`}>
                            {rateB.rate >= rateA.rate ? '+' : ''}
                            {(rateB.rate - rateA.rate).toFixed(1)} 个百分点
                        </span>
                        <span className="bsim-best">无种子随机：样本越大越可信，几场的差距不算数</span>
                    </div>
                )}

                {sim.status === 'done' && isAb && abRows.length > 0 && (
                    <table className="bsim-table bsim-table-ab">
                        <thead>
                            <tr>
                                <th>对手</th>
                                <th>流派</th>
                                <th>A 胜率（记录 {condCountA} 条）</th>
                                <th>B 胜率（当前 {condCountB} 条）</th>
                                <th>差</th>
                            </tr>
                        </thead>
                        <tbody>
                            {abRows
                                .slice()
                                .sort((a, b) => b.b.wins / b.b.done - a.b.wins / a.b.done)
                                .map(({ def, a, b }) => {
                                    const ra = (a.wins / a.done) * 100
                                    const rb = (b.wins / b.done) * 100
                                    const d = rb - ra
                                    return (
                                        <tr key={def.id}>
                                            <td>{def.name}</td>
                                            <td>{def.battleStyle}</td>
                                            <td>
                                                {ra.toFixed(1)}% <em>({a.wins}/{a.done})</em>
                                            </td>
                                            <td>
                                                {rb.toFixed(1)}% <em>({b.wins}/{b.done})</em>
                                            </td>
                                            <td className={d >= 0 ? 'bsim-delta-up' : 'bsim-delta-down'}>
                                                {d >= 0 ? '+' : ''}
                                                {d.toFixed(1)}
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                )}

                {sim.status === 'done' && !isAb && resultRows.length > 0 && (
                    <table className="bsim-table">
                        <thead>
                            <tr>
                                <th>对手</th>
                                <th>流派</th>
                                <th>胜 / {nGames}</th>
                                <th>胜率</th>
                                <th>平均残血</th>
                                <th>观战</th>
                                <th>统计</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resultRows
                                .slice()
                                .sort((a, b) => b.r.wins / b.r.done - a.r.wins / a.r.done)
                                .map(({ def, r }) => (
                                    <tr key={def.id}>
                                        <td>{def.name}</td>
                                        <td>{def.battleStyle}</td>
                                        <td>
                                            {r.wins}/{r.done}
                                        </td>
                                        <td>{((r.wins / r.done) * 100).toFixed(1)}%</td>
                                        <td>{(r.avgHpPct * 100).toFixed(0)}%</td>
                                        <td>
                                            <button
                                                className="bsim-watch"
                                                onClick={() => setWatchOppId(watchOppId === def.id ? null : def.id)}
                                            >
                                                {watchOppId === def.id ? '收起' : '观战'}
                                            </button>
                                        </td>
                                        <td>
                                            <button
                                                className="bsim-watch"
                                                disabled={!r.stats}
                                                onClick={() => setStatsOppId(statsOppId === def.id ? null : def.id)}
                                            >
                                                {statsOppId === def.id ? '收起' : '统计'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                )}

                {sim.status === 'done' && !isAb && resultRows.length > 0 && (
                    <div className="bsim-stats-bar">
                        <button className="bsim-watch" onClick={() => setShowOverallStats((v) => !v)}>
                            {showOverallStats ? '收起整体统计' : '整体统计（全部对手合计）'}
                        </button>
                        <span className="bsim-best">条件改动值多少，看这里的每场数字与上面各对手的明细</span>
                    </div>
                )}

                {overallStats && (
                    <div className="bsim-stats-panel">
                        <BattleStatsPanel
                            snapshot={overallStats}
                            names={{ [build.id]: `${build.name || '我方'}（我方）` }}
                            selfId={build.id}
                            title="整体统计"
                        />
                    </div>
                )}

                {statsDef && statsRow?.stats && (
                    <div className="bsim-stats-panel">
                        <BattleStatsPanel
                            snapshot={statsRow.stats}
                            names={{ [build.id]: build.name || '我方', [statsDef.id]: statsDef.name }}
                            selfId={build.id}
                            title={`vs ${statsDef.name}（${statsRow.done} 场）`}
                        />
                    </div>
                )}

                {sim.status === 'done' && isAb && abStats && abStats.metricsA && abStats.metricsB && (
                    <div className="bsim-stats-panel">
                        <h4 className="bsim-stats-title">
                            统计对照（A 记录条件 / B 当前条件，同一批 {abStats.a.battles} 场）
                        </h4>
                        <table className="bsim-table bsim-table-metrics">
                            <thead>
                                <tr>
                                    <th>指标（我方每场）</th>
                                    <th>A</th>
                                    <th>B</th>
                                    <th>差</th>
                                </tr>
                            </thead>
                            <tbody>
                                {METRIC_ROWS.map((row) => {
                                    const va = abStats.metricsA![row.key]
                                    const vb = abStats.metricsB![row.key]
                                    if (va === null && vb === null) return null
                                    const d = (vb ?? 0) - (va ?? 0)
                                    const cls =
                                        row.better === null || Math.abs(d) < 1e-9
                                            ? ''
                                            : (row.better === 'high') === d > 0
                                              ? 'bsim-delta-up'
                                              : 'bsim-delta-down'
                                    const show = (v: number | null) => (v === null ? '—' : v.toFixed(row.digits))
                                    return (
                                        <tr key={row.key}>
                                            <td>{row.label}</td>
                                            <td>{show(va)}</td>
                                            <td>{show(vb)}</td>
                                            <td className={cls}>
                                                {Math.abs(d) < 1e-9 ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(row.digits)}`}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        <BattleStatsPanel
                            snapshot={selfOnly(abStats.b)}
                            names={{ [build.id]: 'B 我方' }}
                            selfId={build.id}
                        />
                    </div>
                )}

                {watchDef && (
                    <div className="bsim-watch-panel">
                        <h4>
                            观战：构筑 vs {watchDef.name}
                            <button className="bsim-close" onClick={() => setWatchOppId(null)}>
                                关闭
                            </button>
                        </h4>
                        <BattlePanel
                            key={`watch-${watchDef.id}-${totalGames}`}
                            buildA={build}
                            buildB={gen(watchDef, ENEMY_LEVEL)}
                            showSidePanels={false}
                        />
                    </div>
                )}
            </section>
        </div>
    )
}
