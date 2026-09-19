// npx tsx scripts/tournament.ts [id] [N=10]
// 主进程切块后以 `node <tsx loader> tournament.ts --worker` 派生子进程并行跑对局，
// 子进程从 stdin 读任务、把 JSON 结果写回 stdout；安静模式(quiet)跳过日志构建提速。
// 并行度默认 6 个 worker（`TOUR_WORKERS=<n>` 可覆盖），配对按轮转分配以摊平成本差异。
/// <reference types="node" />
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawn } from 'child_process'
import { cpus } from 'os'
import { Character } from '../src/engine/entities/character'
import { OPPONENTS, getOpponentDef, gen } from '../src/data/opponents/index'
import { runBattle } from '../src/engine/battle-runner'
import { CHAMPION_BOSS_ID, CHAMPION_BOSS_NAME, championBossBuild } from '../src/game/champion-boss'
import type { CharacterBuild } from '../src/game/entities/character-build'

/** 子进程 worker 模式：process.argv[2] === '--worker' */
const IS_WORKER = process.argv[2] === '--worker'

interface BattlePairResult {
    aId: string
    bId: string
    aWins: number
    bWins: number
    aHp: number
    bHp: number
}

interface Job {
    aId: string
    bId: string
}

/**
 * 隐藏boss（第 33 名参赛者）。用法：
 *   npm run tour -- champion_boss --champion                  # 用内置基准（见下）当「上一轮通关 build」
 *   npm run tour -- champion_boss --champion=scripts/xxx.json  # 用真实存档 / build 文件
 * 文件可以是裸 CharacterBuild，也可以是元进度存档（含 lastWinBuild）。
 * 传入的 build 会过一遍 championBossBuild（换义体、逐件抵扣、+5 根骨）。
 */
function resolveChampion(args: string[]): CharacterBuild | undefined {
    const withValue = args.find((a) => a.startsWith('--champion='))
    const bare = args.includes('--champion') || !!withValue
    if (!bare) return undefined

    let base: CharacterBuild | undefined
    if (withValue) {
        const file = withValue.slice('--champion='.length)
        const raw = JSON.parse(readFileSync(file, 'utf-8')) as CharacterBuild | { lastWinBuild?: CharacterBuild }
        base = (raw as { lastWinBuild?: CharacterBuild }).lastWinBuild ?? (raw as CharacterBuild)
        if (!base || !base.baseAttrs) {
            console.error(`[--champion: 文件里没有可用的 build]: ${file}`)
            process.exit(1)
        }
        console.log(`隐藏boss 基准：${file}`)
    } else {
        // 内置基准：拿一位中游对手的满级 build 当作「上一轮通关的玩家」
        // （玩家的 baseAttrs 与对手同量级；真实 build 请用 --champion=<文件>）
        const def = getOpponentDef('daixuan') ?? OPPONENTS[0]
        base = gen(def, 33)
        console.log(`隐藏boss 基准：内置（${def.name} 的满级 build，偏保守；真实 build 用 --champion=<文件>）`)
    }
    return championBossBuild(base)
}

/** 参赛者取自哪个 build：隐藏boss 用存档构造的 build，其余 32 人用 gen(def, 33) */
function buildOf(id: string, champion?: CharacterBuild): CharacterBuild {
    if (champion && id === CHAMPION_BOSS_ID) return champion
    return gen(getOpponentDef(id)!, 33)
}

/** 跑一组对局（worker 与主进程共用；安静模式不构建日志；onProgress 每完成一对回调一次） */
async function runPairBattles(
    jobs: Job[],
    n: number,
    champion?: CharacterBuild,
    onProgress?: (pairsDone: number) => void,
): Promise<BattlePairResult[]> {
    const out: BattlePairResult[] = []
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i]
        const templateA = new Character(buildOf(job.aId, champion))
        const templateB = new Character(buildOf(job.bId, champion))
        let aWins = 0
        let bWins = 0
        let aHp = 0
        let bHp = 0
        for (let k = 0; k < n; k++) {
            const { winner, engine } = runBattle(templateA, templateB, undefined, 4, true)
            if (winner === job.aId) aWins++
            else if (winner === job.bId) bWins++
            const [l, r] = engine.state.characters
            aHp += l.hp / l.maxHp
            bHp += r.hp / r.maxHp
        }
        out.push({ aId: job.aId, bId: job.bId, aWins, bWins, aHp, bHp })
        onProgress?.(i + 1)
    }
    return out
}

// ── worker 分支：读 stdin 任务 → 跑 → 写 JSON 到 stdout ──
async function workerMain(): Promise<void> {
    const raw = await new Promise<string>((resolve, reject) => {
        let data = ''
        process.stdin.setEncoding('utf-8')
        process.stdin.on('data', (c: string) => (data += c))
        process.stdin.on('end', () => resolve(data))
        process.stdin.on('error', reject)
    })
    const { jobs, n, champion } = JSON.parse(raw) as { jobs: Job[]; n: number; champion?: CharacterBuild }
    const out = await runPairBattles(jobs, n, champion, (done) => process.stdout.write(`P:${done}\n`))
    // 结果行以 R: 前缀结尾，便于主进程与进度行区分
    process.stdout.write(`R:${JSON.stringify(out)}\n`)
    process.exit(0)
}

// ── 主分支：切块 → 派生子进程并行 → 聚合输出 ──
async function main(): Promise<void> {
    const startWall = Date.now()
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const logPath = join(__dirname, 'tournament-log.txt')
    const logLines: string[] = []
    const origLog = console.log
    console.log = (...args) => {
        const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')
        logLines.push(line)
        origLog(...args)
    }
    process.on('exit', () => writeFileSync(logPath, logLines.join('\n') + '\n', 'utf-8'))

    const N = Math.max(1, parseInt(process.argv[3] ?? '100', 10))
    const targetId = process.argv[2]
    const champion = resolveChampion(process.argv.slice(2))

    /** 参赛者：32 名对手 +（可选）第 33 名隐藏boss */
    const participants = OPPONENTS.map((d) => ({ id: d.id, name: d.name }))
    if (champion) participants.push({ id: CHAMPION_BOSS_ID, name: CHAMPION_BOSS_NAME })
    const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? id

    if (targetId && !participants.some((p) => p.id === targetId)) {
        console.error(`[未找到角色]: ${targetId}${targetId === CHAMPION_BOSS_ID ? '（隐藏boss 需要 --champion）' : ''}`)
        process.exit(1)
    }

    type Result = { name: string; wins: number; total: number; hpPct: number }
    const results: Record<string, Result> = {}
    for (const p of participants) {
        results[p.id] = { name: p.name, wins: 0, total: 0, hpPct: 0 }
    }

    // 1. 对局列表
    const pairs: Job[] = []
    for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
            // 过滤：只打包含目标角色的对战
            if (targetId && participants[i].id !== targetId && participants[j].id !== targetId) continue
            pairs.push({ aId: participants[i].id, bId: participants[j].id })
        }
    }

    // 2. 切块并行（每块独立跑 N 场，安静模式省日志）
    //
    // worker 数：不是越多越快 —— 每个 node 进程自带 GC/编译线程，进程数贴近核数时它们互相抢核，
    // 吞吐反而停滞（实测 M1 Pro 8P：4→18.2s、6→15.8s、8→16.3s、10→16.4s，且 user CPU 从 78s 涨到 109s）。
    // 默认取 6（并留 `TOUR_WORKERS` 环境变量给别的机器覆盖）。
    const cpuCount = cpus().length
    const envWorkers = parseInt(process.env.TOUR_WORKERS ?? '', 10)
    const numWorkers = Math.max(
        1,
        Math.min(Number.isFinite(envWorkers) && envWorkers > 0 ? envWorkers : 6, cpuCount, pairs.length),
    )
    // 轮转分配：每对成本差很大（实测 p99/中位 ≈ 3.4×、max 7×），连续切块会把慢对连成一片，
    // 实测 makespan 1.24× 理想、轮转 1.07×（496 对 / 8 worker 模拟）。
    const chunks: Job[][] = Array.from({ length: numWorkers }, () => [])
    pairs.forEach((p, i) => chunks[i % numWorkers].push(p))

    const selfEntry = fileURLToPath(import.meta.url)

    // 进度统计（主进程汇总各 worker 的 P: 行，写到 stderr，不污染结果日志）
    const totalPairs = pairs.length
    let completed = 0
    const progressStart = Date.now()
    function renderProgress(): void {
        const pct = (completed / totalPairs) * 100
        const secs = ((Date.now() - progressStart) / 1000).toFixed(1)
        process.stderr.write(`\r🏁 已跑 ${completed}/${totalPairs} 对 (${pct.toFixed(1)}%) · ${secs}s`)
    }

    const pending = chunks
        .filter((c) => c.length > 0)
        .map(
            (jobs) =>
                new Promise<BattlePairResult[]>((resolve, reject) => {
                    // 以 tsx 派生子进程跑 worker（继承主进程 tsx loader，保证 TS 导入可解析）
                    const child = spawn(process.execPath, [...process.execArgv, selfEntry, '--worker'], {
                        stdio: ['pipe', 'pipe', 'inherit'],
                    })
                    let buffer = ''
                    let resultJson = ''
                    let workerDone = 0
                    child.stdout.setEncoding('utf-8')
                    child.stdout.on('data', (d: string) => {
                        buffer += d
                        let idx
                        while ((idx = buffer.indexOf('\n')) >= 0) {
                            const line = buffer.slice(0, idx)
                            buffer = buffer.slice(idx + 1)
                            if (line.startsWith('P:')) {
                                const n = parseInt(line.slice(2), 10)
                                completed += n - workerDone
                                workerDone = n
                                renderProgress()
                            } else if (line.startsWith('R:')) {
                                resultJson = line.slice(2)
                            }
                        }
                    })
                    child.on('error', reject)
                    child.on('close', (code) => {
                        if (code !== 0) {
                            reject(new Error(`worker exit code ${code}`))
                            return
                        }
                        try {
                            resolve(JSON.parse(resultJson) as BattlePairResult[])
                        } catch (e) {
                            reject(e)
                        }
                    })
                    child.stdin.end(JSON.stringify({ jobs, n: N, champion }))
                }),
        )
    const chunkResults = await Promise.all(pending)
    // 清掉进度行
    process.stderr.write('\n')

    const byKey = new Map<string, BattlePairResult>()
    for (const list of chunkResults) {
        for (const r of list) byKey.set(`${r.aId}::${r.bId}`, r)
    }

    // 3. 按原始顺序输出 + 聚合
    let totalBattles = 0
    for (const pair of pairs) {
        const r = byKey.get(`${pair.aId}::${pair.bId}`)!
        results[pair.aId].wins += r.aWins
        results[pair.aId].total += N
        results[pair.aId].hpPct += r.aHp
        results[pair.bId].wins += r.bWins
        results[pair.bId].total += N
        results[pair.bId].hpPct += r.bHp
        totalBattles += N
        console.log(
            `${nameOf(pair.aId)} vs ${nameOf(pair.bId)}: ${r.aWins}/${N} (${((r.aWins / N) * 100).toFixed(1)}%) - ${r.bWins}/${N} (${((r.bWins / N) * 100).toFixed(1)}%)`,
        )
    }

    const elapsed = ((Date.now() - startWall) / 1000).toFixed(1)
    console.log(`\n⏱ 耗时 ${elapsed}s`)
    console.log(`📊 ${participants.length} 名角色 · ${totalBattles} 场`)
    for (const r of Object.values(results).sort((a, b) => b.wins - a.wins)) {
        const rate = ((r.wins / r.total) * 100).toFixed(1)
        const hp = ((r.hpPct / r.total) * 100).toFixed(1)
        if (r.total > 0) {
            console.log(`  ${r.name.padEnd(12)} ${r.wins.toString().padStart(6)}/${r.total} (${rate}%)  残均HP ${hp}%`)
        }
    }
}

if (IS_WORKER) {
    workerMain().catch((e) => {
        console.error('[worker 失败]:', e)
        process.exit(1)
    })
} else {
    main().catch((e) => {
        console.error('[运行失败]:', e)
        process.exit(1)
    })
}
