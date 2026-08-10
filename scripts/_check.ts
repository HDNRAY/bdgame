import { gen, AJIU, WUZUI } from '../src/data/opponents'
import { runBattle } from '../src/engine/battle-runner'
import { Character } from '../src/engine/entities/character'
const log: string[] = []
runBattle(new Character(gen(AJIU, 33)), new Character(gen(WUZUI, 33)), (l: any) => {
    const m = l.message ?? ''
    if (m.includes('失血') || m.includes('自爆') || m.includes('独臂') || m.includes('缠劲') || m.includes('周')) log.push(m)
}, 4, false)
console.log(log.slice(0, 40).join('\n'))
