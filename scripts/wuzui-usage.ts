// 无志实战：八卦掌 触发次数/AP消耗 vs 混元掌
import { gen, WUZUI } from '../src/data/opponents'
import { Character } from '../src/engine/entities/character'
import { runBattle } from '../src/engine/battle-runner'

const N = 30
const usage = new Map<string, number>()
let apOnBaguazhang = 0
let apOnHunyuan = 0
let totalApSpent = 0
let triggerCount = 0
let dodgeCount = 0

for (let i = 0; i < N; i++) {
    runBattle(
        new Character(gen(WUZUI, 33)),
        new Character(
            gen(
                {
                    id: 'opp',
                    name: '敌',
                    weapon: 'peach_sword',
                    targetAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },
                    rewards: [],
                } as never,
                33,
            ),
        ),
        (e) => {
            const ev = e as unknown as {
                type?: string
                sourceId?: string
                actionId?: string
                actionName?: string
                apCost?: number
                triggered?: boolean
            }
            if (ev.type === 'attack_start' && ev.sourceId === 'wuzui') {
                const k = ev.actionName ?? ev.actionId ?? '?'
                usage.set(k, (usage.get(k) ?? 0) + 1)
                totalApSpent += ev.apCost ?? 0
                if (k === '八卦游身掌') apOnBaguazhang += ev.apCost ?? 0
                if (k === '混元掌') apOnHunyuan += ev.apCost ?? 0
                if (ev.triggered) triggerCount++
            }
            if (ev.type === 'dodged' && ev.sourceId === 'wuzui') dodgeCount++
        },
    )
}

console.log('── 无志 30 场招式使用 ──')
for (const [k, v] of [...usage.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(10)} ${v}`)
console.log(
    `\n八卦掌 总耗AP ${apOnBaguazhang}（触发${triggerCount}次） | 混元掌 总耗AP ${apOnHunyuan} | 总AP ${totalApSpent}`,
)
console.log(`闪避 ${dodgeCount} 次`)
