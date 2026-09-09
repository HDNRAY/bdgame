import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CharacterBuild } from '../../../../game/entities/character-build'
import { STARTING_WEAPONS } from '../../../../data/weapons/starting-weapons'
import { OPPONENTS, gen } from '../../../../data/opponents'
import type { Reward } from '../../../../game/entities/reward'
import { CharacterPanel } from '../../../components/CharacterPanel/CharacterPanel'
import { runSeries, type SeriesJob, type SeriesResult } from './sim-core'
import { BattlePanel } from '../../../components/BattlePanel/BattlePanel'
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
}

interface SimState {
    status: 'idle' | 'running' | 'done'
    results: Record<string, SeriesResult>
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
            if (p?.build) return { build: { ...freshBuild(), ...p.build }, initWeaponId: p.initWeaponId ?? 'bare_hands' }
        }
    } catch {
        /* 损坏存档忽略 */
    }
    return { build: freshBuild(), initWeaponId: 'bare_hands' }
}

export function BuildSim() {
    const initial = useMemo(() => loadPersisted(), [])
    const [build, setBuild] = useState<CharacterBuild>(initial.build)
    const [initWeaponId, setInitWeaponId] = useState<string>(initial.initWeaponId)
    const [sim, setSim] = useState<SimState>({ status: 'idle', results: {}, total: 0 })
    const [nGames, setNGames] = useState(100)
    const [styleFilter, setStyleFilter] = useState<(typeof STYLE_FILTER)[number]['id']>('all')
    const [watchOppId, setWatchOppId] = useState<string | null>(null)
    const abortRef = useRef<{ aborted: boolean }>({ aborted: false })
    const workersRef = useRef<Worker[]>([])

    // 持久化
    useEffect(() => {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({ build, initWeaponId } satisfies Persisted))
        } catch {
            /* 存不下忽略 */
        }
    }, [build, initWeaponId])

    const isUpgradedWeapon = !STARTING_IDS.has(build.weapon)
    // 奖励里选出的武器槽：第 1 把覆盖初始主手；第 2 把进副手
    const mainSlot = isUpgradedWeapon ? ({ slot: 'main' as const, id: build.weapon } as const) : null
    const offSlot = build.offhand && !STARTING_IDS.has(build.offhand) ? ({ slot: 'off' as const, id: build.offhand } as const) : null
    const weaponSlots = [mainSlot, offSlot].filter((x): x is NonNullable<typeof x> => !!x)
    const usedSlots = build.rewards.length + weaponSlots.length

    // 初始武器切换（已选出主手时禁用）
    const handleInitWeapon = (id: string) => {
        setInitWeaponId(id)
        if (!mainSlot) {
            setBuild((b) => ({ ...b, weapon: id }))
        }
    }
    const handleRemoveWeaponSlot = (slot: 'main' | 'off') => {
        if (slot === 'main') setBuild((b) => ({ ...b, weapon: initWeaponId }))
        else setBuild((b) => ({ ...b, offhand: undefined }))
    }

    const handleAddReward = useCallback(
        (kind: Reward['type'], id: string) => {
            if (kind === 'weapon') {
                // 有副手 → 替换副手（槽数不变）；无副手 → 第 1 把覆盖初始主手 / 第 2 把进副手
                if (!build.offhand && usedSlots >= REWARD_CAP) return
                setBuild((b) => {
                    if (b.offhand) return { ...b, offhand: id }
                    if (STARTING_IDS.has(b.weapon)) return { ...b, weapon: id }
                    return { ...b, offhand: id }
                })
                return
            }
            if (usedSlots >= REWARD_CAP) return
            setBuild((b) => {
                if (b.rewards.some((r) => r.type === kind && r.id === id)) return b
                return { ...b, rewards: [...b.rewards, { id, type: kind, name: id, description: '', tags: [] }] }
            })
        },
        [usedSlots, build.offhand],
    )

    const handleRemoveReward = useCallback((kind: Reward['type'], id: string) => {
        setBuild((b) => ({ ...b, rewards: b.rewards.filter((r) => !(r.type === kind && r.id === id)) }))
    }, [])

    const handleNewBuild = () => {
        setBuild(freshBuild())
        setInitWeaponId('bare_hands')
        setWatchOppId(null)
        setSim({ status: 'idle', results: {}, total: 0 })
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

    const startSim = async () => {
        if (sim.status === 'running') return
        abortRef.current = { aborted: false }
        setSim({ status: 'running', results: {}, total: opponents.length })
        setWatchOppId(null)

        const jobs: SeriesJob[] = opponents.map((o) => ({ opponentId: o.id, n: nGames, level: ENEMY_LEVEL }))
        const update = (list: SeriesResult[]) => {
            setSim((s) => {
                const results = { ...s.results }
                for (const r of list) results[r.opponentId] = r
                const doneCount = Object.keys(results).length
                return { ...s, results, status: doneCount >= opponents.length ? 'done' : 'running' }
            })
        }
        const mainLoop = async (useWorker: boolean): Promise<void> => {
            if (useWorker && typeof Worker !== 'undefined') {
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
                                    worker.postMessage({ build, jobs: jobList })
                                    return new Promise<void>((resolve, reject) => {
                                        worker.onmessage = (e: MessageEvent<SeriesResult[]>) => {
                                            update(e.data)
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
                update([runSeries(build, job, abortRef.current)])
                await tick()
            }
        }

        try {
            await mainLoop(true)
        } finally {
            setSim((s) => ({ ...s, status: abortRef.current.aborted ? 'idle' : 'done' }))
        }
    }

    const stopSim = () => {
        abortRef.current.aborted = true
        for (const w of workersRef.current) w.terminate()
        workersRef.current = []
        setSim((s) => ({ ...s, status: 'idle' }))
    }

    // 汇总
    const resultRows = opponents
        .map((o) => ({ def: o, r: sim.results[o.id] }))
        .filter((x) => x.r && x.r.done > 0)
    const totalWins = resultRows.reduce((s, x) => s + x.r.wins, 0)
    const totalGames = resultRows.reduce((s, x) => s + x.r.done, 0)
    const overallRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : '—'
    const watchDef = watchOppId ? OPPONENTS.find((o) => o.id === watchOppId) : null

    return (
        <div className="bsim">
            <div className="bsim-toolbar">
                <h2 className="bsim-title">构筑试炼</h2>
                <label className="bsim-initweapon">
                    初始主手(免费)
                    <select
                        value={mainSlot ? '' : build.weapon}
                        disabled={!!mainSlot}
                        onChange={(e) => handleInitWeapon(e.target.value)}
                    >
                        {mainSlot && <option value="">已选出主手(见奖励位)</option>}
                        {STARTING_WEAPONS.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}
                            </option>
                        ))}
                    </select>
                </label>
                <span className="bsim-hint">完成属性分配后点面板右上「保存」再试炼</span>
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
                />
            </div>

            {/* ── 试炼台 ── */}
            <section className="bsim-bench">
                <div className="bsim-bench-head">
                    <h3>试炼台</h3>
                    <label>
                        每对手
                        <select value={nGames} onChange={(e) => setNGames(Number(e.target.value))}>
                            {N_OPTIONS.map((n) => (
                                <option key={n} value={n}>
                                    {n} 场
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        范围
                        <select value={styleFilter} onChange={(e) => setStyleFilter(e.target.value as typeof styleFilter)}>
                            {STYLE_FILTER.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {sim.status === 'running' ? (
                        <button className="bsim-stop" onClick={stopSim}>
                            停止
                        </button>
                    ) : (
                        <button className="bsim-run" onClick={startSim} disabled={opponents.length === 0}>
                            {sim.status === 'done' ? '重新试炼' : '开始试炼'}
                        </button>
                    )}
                </div>

                {sim.status === 'running' && (
                    <div className="bsim-progress">
                        已完 {Object.keys(sim.results).length}/{sim.total} 对手
                    </div>
                )}

                {sim.status === 'done' && totalGames > 0 && (
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

                {sim.status === 'done' && resultRows.length > 0 && (
                    <table className="bsim-table">
                        <thead>
                            <tr>
                                <th>对手</th>
                                <th>流派</th>
                                <th>胜 / {nGames}</th>
                                <th>胜率</th>
                                <th>平均残血</th>
                                <th>观战</th>
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
                                    </tr>
                                ))}
                        </tbody>
                    </table>
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
