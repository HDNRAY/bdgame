import { gen, HAORAN, OPPONENTS } from '../src/data/opponents'
import { runBattle } from '../src/engine/battle-runner'
import { Character } from '../src/engine/entities/character'
const hb = gen(HAORAN, 33)
let done = 0
for (const opp of OPPONENTS) {
    if (opp.id === 'haoran') continue
    for (let i = 0; i < 30; i++) {
        try {
            runBattle(new Character(hb), new Character(gen(opp, 33)), undefined, 4, true)
        } catch (e: any) {
            console.log(`💥 浩然 vs ${opp.name} 第${i}场:`, e?.message ?? e)
            process.exit(1)
        }
        done++
    }
}
console.log('压测完成，无崩溃，共', done, '场')
