/**
 * 奖励影响分析：对任意角色，逐一摘掉每个奖励，测胜率下降多少 → 找出"哪件奖励影响最大"。
 *
 * 用法:
 *   npx tsx scripts/reward-impact.ts <targetId> [--n 15] [--level 33] [--pool id1,id2,...]
 *
 *   --n     每个对手对战局数（默认 15，越大越准越慢）
 *   --level 生成等级（默认 33，对齐 tournament）
 *   --pool  参考池（逗号分隔的对手 id，默认 = 除目标外的全部对手）
 */
import { OPPONENTS, getOpponentDef, gen } from '../src/data/opponents'
import { runBattle } from '../src/engine/battle-runner'
import { Character } from '../src/engine/entities/character'
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

if (!targetId) {
    console.error('用法: npx tsx scripts/reward-impact.ts <targetId> [--n 15] [--level 33] [--pool id1,id2]')
    process.exit(1)
}
// simpleGenerate 的奖励数量 = round(len * min(1, n/33))：n<33 时摘奖励会改变总数量，
// 且 slice 顺位变化会让后面的奖励顶进来，A/B 失真。仅在 n>=33（全额发放）下才准确。
if (LEVEL < 33) {
    console.warn(`⚠️  level=${LEVEL}<33：simpleGenerate 按比例发放奖励，摘一件会改变总数与顺位，结果仅供参考`)
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

const TYPE_LABEL: Record<string, string> = { weapon: '武器', action: '招式', passive: '功法', artifact: '奇物' }

function buildChar(d: OpponentDef, n: number): Character {
    return new Character(gen(d, n))
}

/** 一场对局：返回目标是否获胜 */
function runOne(target: Character, opp: Character): boolean {
    const { winner } = runBattle(target, opp, undefined, 4, true)
    return winner === target.id
}

/** 目标 vs 整个池的胜率 */
function winRate(target: Character): number {
    let wins = 0
    for (const opp of pool) {
        const b = buildChar(opp, LEVEL)
        for (let i = 0; i < N; i++) {
            if (runOne(target, b)) wins++
        }
    }
    return wins / (pool.length * N)
}

console.log(`\n=== ${def.name}（${targetId}）奖励影响分析 ===`)
console.log(
    `参数：n=${N} 场/对手 · level=${LEVEL} · 参考池 ${pool.length} 人（${pool.map((o) => o.name).join('、')}）\n`,
)

// 全 kit 基线
const full = buildChar(def, LEVEL)
const fullRate = winRate(full)
console.log(`【全 kit 胜率】${(fullRate * 100).toFixed(1)}%\n`)

// 逐一摘奖励
const results: { id: string; name: string; type: string; rate: number; drop: number }[] = []
for (const r of def.rewards) {
    const variant: OpponentDef = { ...def, rewards: def.rewards.filter((x) => x.id !== r.id) }
    const vChar = buildChar(variant, LEVEL)
    const rate = winRate(vChar)
    results.push({
        id: r.id,
        name: TYPE_LABEL[r.type] ?? r.type,
        type: r.type,
        rate,
        drop: fullRate - rate,
    })
    console.log(
        `去掉 ${TYPE_LABEL[r.type] ?? r.type}「${r.id}」→ 胜率 ${(rate * 100).toFixed(1)}%（${fullRate - rate >= 0 ? '-' : '+'}${(Math.abs(fullRate - rate) * 100).toFixed(1)}）`,
    )
}

console.log(`\n=== 影响排序（胜率掉越多 = 该奖励越关键）===`)
results
    .sort((a, b) => b.drop - a.drop)
    .forEach((r, i) => {
        const bar = '#'.repeat(Math.max(0, Math.round((r.drop * 100) / 2)))
        console.log(
            `${String(i + 1).padStart(2)}. ${TYPE_LABEL[r.type]}「${r.id}」 掉 ${(r.drop * 100).toFixed(1)}%  ${bar}`,
        )
    })

// 无影响的
console.log(`\n（摘掉后胜率不掉甚至上升 = 该奖励对当前强度无正贡献）`)
