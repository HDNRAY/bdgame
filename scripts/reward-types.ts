/**
 * 统计每个对手的奖励类型数量（武器/招式/功法/奇物），默认按招式数降序。
 * 用法: npx tsx scripts/reward-types.ts
 * 结果同时打印到终端并写入 scripts/reward-types.txt。
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPPONENTS } from '../src/data/opponents'
import { getPassive } from '../src/data/passives'
import { getArtifact } from '../src/data/artifacts'
import { getAction } from '../src/data/actions'

type Row = {
    id: string
    name: string
    weapon: number
    action: number
    passive: number
    artifact: number
    chan: number
    total: number
}

const TYPE_KEY: Record<string, keyof Row> = {
    weapon: 'weapon',
    action: 'action',
    passive: 'passive',
    artifact: 'artifact',
}

// 判断奖励是否耗缠/带缠标签：招式看 chanCost>0，功法/奇物看 tags 含 chan
function rewardConsumesChan(rw: { type: string; id: string }): boolean {
    if (rw.type === 'action') return (getAction(rw.id)?.chanCost ?? 0) > 0
    if (rw.type === 'passive') return getPassive(rw.id)?.tags?.includes('chan') ?? false
    if (rw.type === 'artifact') return getArtifact(rw.id)?.tags?.includes('chan') ?? false
    return false
}

const rows: Row[] = OPPONENTS.map((o) => {
    const r: Row = { id: o.id, name: o.name, weapon: 0, action: 0, passive: 0, artifact: 0, chan: 0, total: o.rewards.length }
    for (const rw of o.rewards) {
        const k = TYPE_KEY[rw.type]
        if (k) r[k]++
        if (rewardConsumesChan(rw)) r.chan++
    }
    return r
})

const pad = (s: string, n: number) => s.padEnd(n, '　')

const lines: string[] = []
const out = (s = '') => lines.push(s)

// 终端：console.table 展示
rows.sort((a, b) => b.total - a.total || b.action - a.action)
// 角色名作为表格行索引（对象 key = 角色名）
const tableObj: Record<string, { 武器: number; 招式: number; 功法: number; 奇物: number; 耗缠: number; 合计: number }> = {}
for (const r of rows) {
    tableObj[r.name] = { 武器: r.weapon, 招式: r.action, 功法: r.passive, 奇物: r.artifact, 耗缠: r.chan, 合计: r.total }
}
console.table(tableObj)

// 文件：保留文本表格
out(pad('角色', 14) + pad('武器', 6) + pad('招式', 6) + pad('功法', 6) + pad('奇物', 6) + pad('耗缠', 6) + '合计')
out('─'.repeat(52))
for (const r of rows) {
    out(
        `${pad(r.name, 14)}${pad(String(r.weapon), 6)}${pad(String(r.action), 6)}${pad(String(r.passive), 6)}${pad(String(r.artifact), 6)}${pad(String(r.chan), 6)}${r.total}`,
    )
}

const avg = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / arr.length
out('\n平均值：' + rows.map((r) => r.total).reduce((s, n) => s + n, 0) / rows.length)
out(
    `招式均值 ${avg(rows.map((r) => r.action)).toFixed(1)} · 功法均值 ${avg(rows.map((r) => r.passive)).toFixed(1)} · 奇物均值 ${avg(rows.map((r) => r.artifact)).toFixed(1)}`,
)

const __dirname = dirname(fileURLToPath(import.meta.url))
writeFileSync(resolve(__dirname, 'reward-types.txt'), lines.join('\n') + '\n')
console.log('\n✓ 已写入 scripts/reward-types.txt')
