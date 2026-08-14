// 找修复后残留的平局，看机制
import { Character } from '../src/engine/entities/character'
import { OPPONENTS, getOpponentDef, gen } from '../src/data/opponents/index'
import { runBattle } from '../src/engine/battle-runner'

const ids = OPPONENTS.map((o) => o.id)
for (const aId of ids) {
    for (const bId of ids) {
        if (aId === bId) continue
        const a = new Character(gen(getOpponentDef(aId)!, 33))
        const b = new Character(gen(getOpponentDef(bId)!, 33))
        for (let k = 0; k < 20; k++) {
            const { winner, engine } = runBattle(a, b, undefined, 6, false)
            if (winner !== '平局') continue
            const s = engine.state
            const [l, r] = s.characters
            console.log(`残留平局: ${aId} vs ${bId} (seed ${k})`)
            console.log(`lastWinner=${s.lastWinner ?? 'none'}  hp: ${l.name}=${l.hp}/${l.maxHp}  ${r.name}=${r.hp}/${r.maxHp}`)
            const all = s.log.getAll() as { event: { type: string; actionName?: string; actor?: string; target?: string } }[]
            for (const e of all.slice(-20)) {
                let line = `  ${e.event.type}`
                if (e.event.type === 'damage') line += ` ${e.event.actor}→${e.event.target} ${e.event.actionName}`
                if (e.event.type === 'system') line += ' (system)'
                if (e.event.type === 'heal') line += ' (heal)'
                if (e.event.type === 'defeat') line += ' (defeat)'
                console.log(line)
            }
            process.exit(0)
        }
    }
}
console.log('未找到残留平局')
