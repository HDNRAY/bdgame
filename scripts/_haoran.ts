// 探针：浩然改造后（烧刀子+万象剑意）胜率
import { gen, HAORAN, OPPONENTS } from '../src/data/opponents'
import { runBattle } from '../src/engine/battle-runner'
import { Character } from '../src/engine/entities/character'

const N = 12
const hb = gen(HAORAN, 33)
let wins = 0
let total = 0
const rows: { name: string; wr: string }[] = []
for (const opp of OPPONENTS) {
    if (opp.id === 'haoran') continue
    let w = 0
    for (let i = 0; i < N; i++) {
        try {
            const { winner } = runBattle(new Character(hb), new Character(gen(opp, 33)), undefined, 4, true)
            if (winner === 'haoran') {
                w++
                wins++
            }
        } catch (e: any) {
            console.log(`💥 崩溃于 浩然 vs ${opp.name}:`, e?.message ?? e)
            process.exit(1)
        }
        total++
    }
    rows.push({ name: opp.name, wr: ((w / N) * 100).toFixed(0) + '%' })
}
rows.sort((a, b) => parseFloat(b.wr) - parseFloat(a.wr))
console.log(`浩然 总胜率: ${((wins / total) * 100).toFixed(1)}% (${wins}/${total})`)
for (const r of rows) console.log(`${r.name.padEnd(6)}  ${r.wr}`)
