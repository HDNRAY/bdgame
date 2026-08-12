// 橘子会实战：招式/触发使用统计（对阵真实对手）
import { gen, ORANGE, OPPONENTS } from '../src/data/opponents'
import { Character } from '../src/engine/entities/character'
import { runBattle } from '../src/engine/battle-runner'

const N = 12
const usage = new Map<string, number>()
let wins = 0

const pool = OPPONENTS.filter((o) => o.id !== 'orange')
for (let i = 0; i < N; i++) {
    const oppDef = pool[i % pool.length]
    const { winner } = runBattle(
        new Character(gen(ORANGE, 33)),
        new Character(gen(oppDef, 33)),
        (e) => {
            const ev = e as unknown as { type?: string; sourceId?: string; actionName?: string; actionId?: string }
            if (ev.type === 'attack_start' && ev.sourceId === 'orange') {
                const k = ev.actionName ?? ev.actionId ?? '?'
                usage.set(k, (usage.get(k) ?? 0) + 1)
            }
        },
    )
    if (winner === 'orange') wins++
}

console.log(`── 橘子会 vs ${pool.length} 对手 x${N} 场（胜率 ${(wins / (N * 1) * 100).toFixed(1)}%）──`)
for (const [k, v] of [...usage.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v} 次`)
}
