import { OPPONENTS, gen } from '../src/data/opponents'
import { runBattle } from '../src/engine/battle-runner'
import { Character } from '../src/engine/entities/character'
const ids = ['baihu', 'junshi', 'wukong', 'fanglie', 'doctor', 'orange', 'qilan', 'daixuan', 'haoran', 'otsu']
let battles = 0
for (let r = 0; r < 3; r++) for (const id of ids) {
    const a = new Character(gen(OPPONENTS.find((o) => o.id === id)!, 33))
    const b = new Character(gen(OPPONENTS[0], 33))
    runBattle(a, b, undefined, 4, true)
    battles++
}
console.log(`battles=${battles}`)
