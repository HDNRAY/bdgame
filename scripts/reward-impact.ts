/**
 * 奖励影响分析：对任意角色，逐一摘掉每个奖励，测胜率下降多少 → 找出"哪件奖励影响最大"。
 *
 * 用法:
 *   npx tsx scripts/reward-impact.ts <targetId> [--n 15] [--level 33] [--pool id1,id2,...] [--reward id] [--no-talents] [--seed 1000] [--blocks 1]
 *
 *   --n           每个对手对战局数（默认 15，越大越准越慢）
 *   --seed        种子基数（默认 1000）：第 f 个对手的第 i 场固定用 `seed + f*1000 + i`
 *   --blocks      种子块数（默认 1）：每块换一段种子（+1000000/块），多块时报块间 min~max，
 *                 用来看「这 3.4% 到底是信号还是噪声」。运行时长 ×块数。
 *   --level       生成等级（默认 33，对齐 tournament）
 *   --pool        参考池（逗号分隔的对手 id，默认 = 除目标外的全部对手）
 *   --reward      只看某个奖励（id），默认测全部奖励
 *   --no-talents  不列天赋行（只看真奖励）。默认会把**自动解锁的天赋也当成一行**参与排名 ——
 *                 摘掉它的方式和摘奖励一样：临时把它从 TALENTS 里拿掉再构造角色，
 *                 baseAttrs 一点不动，所以属性/装备/功法数值完全不变，只是少解锁这一条天赋。
 */
import { OPPONENTS, getOpponentDef, gen } from '../src/data/opponents'
import { TALENTS } from '../src/data/passives'
import { checkTalents } from '../src/game/talent-check'
import { runBattle } from '../src/engine/battle-runner'
import { Character } from '../src/engine/entities/character'
import { rng } from '../src/engine/util/rng'
import type { OpponentDef } from '../src/data/opponents'

const args = process.argv.slice(2)
const targetId = args[0]
const argVal = (flag: string, def: string): string => {
    const i = args.indexOf(flag)
    return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const N = parseInt(argVal('--n', '15'), 10)
const LEVEL = parseInt(argVal('--level', '33'), 10)
const poolArg = argVal('--pool', '')
const rewardArg = argVal('--reward', '')
const noTalents = args.includes('--no-talents')
const SEED_BASE = parseInt(argVal('--seed', '1000'), 10)
const BLOCKS = Math.max(1, parseInt(argVal('--blocks', '1'), 10))

/**
 * 临时摘掉某一条天赋再跑：构造期解锁天赋的唯一数据源就是 TALENTS 这个数组，
 * 把它摘出来即可 —— baseAttrs 一点不动，属性/装备/功法数值完全一致，只是这一条天赋不再解锁。
 */
function withTalentRemoved<T>(talentId: string, fn: () => T): T {
    const idx = TALENTS.findIndex((t) => t.id === talentId)
    if (idx < 0) return fn()
    const [saved] = TALENTS.splice(idx, 1)
    try {
        return fn()
    } finally {
        TALENTS.splice(idx, 0, saved)
    }
}

if (!targetId) {
    console.error(
        '用法: npx tsx scripts/reward-impact.ts <targetId> [--n 15] [--level 33] [--pool id1,id2] [--reward id] [--no-talents]',
    )
    process.exit(1)
}
// simpleGenerate 的奖励数量 = round(len * min(1, n/33))：n<33 时摘奖励会改变总数量，
// 且 slice 顺位变化会让后面的奖励顶进来，A/B 失真。仅在 n>=33（全额发放）下才准确。
if (LEVEL < 33) {
    console.warn(`[提示] level=${LEVEL}<33：simpleGenerate 按比例发放奖励，摘一件会改变总数与顺位，结果仅供参考`)
}

const def = getOpponentDef(targetId)
if (!def) {
    console.error(`找不到对手 ${targetId}，可用: ${OPPONENTS.map((o) => o.id).join(', ')}`)
    process.exit(1)
}

// 参考池
let pool = OPPONENTS.filter((o) => o.id !== targetId)
if (poolArg) {
    const wanted = new Set(poolArg.split(',').map((s) => s.trim()))
    pool = pool.filter((o) => wanted.has(o.id))
}
if (pool.length === 0) {
    console.error('参考池为空')
    process.exit(1)
}

const TYPE_LABEL: Record<string, string> = { weapon: '武器', action: '招式', passive: '功法', artifact: '奇物', talent: '天赋' }

function buildChar(d: OpponentDef, n: number): Character {
    return new Character(gen(d, n))
}

/** 一场对局：返回目标是否获胜 */
function runOne(target: Character, opp: Character): boolean {
    const { winner } = runBattle(target, opp, undefined, 4, true)
    return winner === target.id
}

/**
 * 目标 vs 整个池的胜率。
 *
 * **配对播种**：第 f 个对手的第 i 场固定用 `SEED_BASE + offset + f*1000 + i`，且播种紧贴 runBattle ——
 * 于是「全 kit」与每个 ablation 在每一场都看到同一串骰子，差值只归因于摘掉的那件东西（配对比较，
 * 比各跑各的随机流方差小一个量级）；同一命令重复跑也逐位一致。
 */
function winRate(target: Character, offset = 0): number {
    let wins = 0
    pool.forEach((opp, f) => {
        const b = buildChar(opp, LEVEL)
        for (let i = 0; i < N; i++) {
            rng.seedMain(SEED_BASE + offset + f * 1000 + i)
            if (runOne(target, b)) wins++
        }
    })
    return wins / (pool.length * N)
}

/** 多块种子：返回均值与块间范围（块数=1 时 min=max=mean） */
function winRateBlocks(target: Character): { mean: number; min: number; max: number } {
    const rates: number[] = []
    for (let b = 0; b < BLOCKS; b++) rates.push(winRate(target, b * 1_000_000))
    return {
        mean: rates.reduce((a, b) => a + b, 0) / rates.length,
        min: Math.min(...rates),
        max: Math.max(...rates),
    }
}

/** 把「均值 + 块间范围」打成一段文本（块数=1 时不显示范围） */
const spread = (r: { mean: number; min: number; max: number }): string =>
    BLOCKS > 1 ? `（块间 ${(r.min * 100).toFixed(1)}~${(r.max * 100).toFixed(1)}）` : ''

console.log(`\n=== ${def.name}（${targetId}）奖励影响分析 ===`)
console.log(
    `参数：n=${N} 场/对手 · level=${LEVEL} · 参考池 ${pool.length} 人（${pool.map((o) => o.name).join('、')}）` +
        ` · 天赋：${noTalents ? '不列入排名' : '作为独立一行参与排名（摘法与奖励相同）'}` +
        ` · 种子 ${SEED_BASE}${BLOCKS > 1 ? `×${BLOCKS} 块` : ''}\n`,
)

// 全 kit 基线
const full = buildChar(def, LEVEL)
const fullStats = winRateBlocks(full)
const fullRate = fullStats.mean
console.log(`【全 kit 胜率】${(fullRate * 100).toFixed(1)}%${spread(fullStats)}\n`)

// 逐一摘掉一件东西：真奖励来自 def.rewards；天赋来自「原始属性自动解锁」，也当成一行
type Ablation = { id: string; type: string; rate: number }
const rewardTargets = def.rewards.filter((r) => !rewardArg || r.id === rewardArg)
// 自动解锁的天赋（按原始属性判定，和构造角色时同一套逻辑）。奖励表里已有的那条不重复列。
const rewardIds = new Set(def.rewards.map((r) => r.id))
const talentTargets = noTalents
    ? []
    : checkTalents(buildChar(def, LEVEL).build.baseAttrs)
          .map((t) => t.id)
          .filter((id) => !rewardIds.has(id) && (!rewardArg || id === rewardArg))
const total = rewardTargets.length + talentTargets.length
if (total === 0) {
    console.error(
        `找不到 ${rewardArg || '任何奖励或天赋'}（${def.name} 的奖励: ${def.rewards.map((x) => x.id).join(', ')}）`,
    )
    process.exit(1)
}

const results: { id: string; name: string; type: string; rate: number; drop: number; lo: number; hi: number }[] = []
const ablations: Ablation[] = [
    ...rewardTargets.map((r) => ({ id: r.id, type: r.type, rate: 0 })),
    ...talentTargets.map((id) => ({ id, type: 'talent', rate: 0 })),
]
for (const a of ablations) {
    const stats =
        a.type === 'talent'
            ? withTalentRemoved(a.id, () => winRateBlocks(buildChar(def, LEVEL)))
            : winRateBlocks(buildChar({ ...def, rewards: def.rewards.filter((x) => x.id !== a.id) }, LEVEL))
    a.rate = stats.mean
    results.push({
        id: a.id,
        name: TYPE_LABEL[a.type] ?? a.type,
        type: a.type,
        rate: stats.mean,
        // 配对差值：块间同符号才算稳（块数>1 时低于块间噪声的差值应视为无信号）
        drop: fullRate - stats.mean,
        lo: fullStats.min - stats.max,
        hi: fullStats.max - stats.min,
    })
    console.log(
        `去掉 ${TYPE_LABEL[a.type] ?? a.type}「${a.id}」→ 胜率 ${(stats.mean * 100).toFixed(1)}%${spread(stats)}（${fullRate - stats.mean >= 0 ? '-' : '+'}${(Math.abs(fullRate - stats.mean) * 100).toFixed(1)}）`,
    )
}

console.log(`\n=== 影响排序（胜率掉越多 = 该奖励越关键${BLOCKS > 1 ? '；括号里是配对差值在块间的波动范围，差值落在范围内=可能只是噪声' : ''}）===`)
results
    .sort((a, b) => b.drop - a.drop)
    .forEach((r, i) => {
        const bar = '#'.repeat(Math.max(0, Math.round((r.drop * 100) / 2)))
        const noise = BLOCKS > 1 ? `（${(Math.min(r.lo, r.hi) * 100).toFixed(1)}~${(Math.max(r.lo, r.hi) * 100).toFixed(1)}）` : ''
        console.log(
            `${String(i + 1).padStart(2)}. ${TYPE_LABEL[r.type]}「${r.id}」 掉 ${(r.drop * 100).toFixed(1)}%${noise}  ${bar}`,
        )
    })

// 无影响的
console.log(`\n（摘掉后胜率不掉甚至上升 = 该奖励对当前强度无正贡献）`)
