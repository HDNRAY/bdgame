/**
 * 统计每个对手的奖励类型数量（武器/招式/功法/奇物），默认按招式数降序。
 * 用法: npx tsx scripts/reward-types.ts
 */
import { OPPONENTS } from '../src/data/opponents'

type Row = {
    id: string
    name: string
    weapon: number
    action: number
    passive: number
    artifact: number
    total: number
}

const TYPE_KEY: Record<string, keyof Row> = {
    weapon: 'weapon',
    action: 'action',
    passive: 'passive',
    artifact: 'artifact',
}

const rows: Row[] = OPPONENTS.map((o) => {
    const r: Row = { id: o.id, name: o.name, weapon: 0, action: 0, passive: 0, artifact: 0, total: o.rewards.length }
    for (const rw of o.rewards) {
        const k = TYPE_KEY[rw.type]
        if (k) r[k]++
    }
    return r
})

const pad = (s: string, n: number) => s.padEnd(n, '　')

console.log(pad('角色', 14) + pad('武器', 6) + pad('招式', 6) + pad('功法', 6) + pad('奇物', 6) + '合计')
console.log('─'.repeat(46))
// 默认按招式数降序
for (const r of rows.sort((a, b) => b.action - a.action || b.total - a.total)) {
    console.log(
        `${pad(r.name, 14)}${pad(String(r.weapon), 6)}${pad(String(r.action), 6)}${pad(String(r.passive), 6)}${pad(String(r.artifact), 6)}${r.total}`,
    )
}

const avg = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / arr.length
console.log('\n平均值：' + rows.map((r) => r.total).reduce((s, n) => s + n, 0) / rows.length)
console.log(
    `招式均值 ${avg(rows.map((r) => r.action)).toFixed(1)} · 功法均值 ${avg(rows.map((r) => r.passive)).toFixed(1)} · 奇物均值 ${avg(rows.map((r) => r.artifact)).toFixed(1)}`,
)
