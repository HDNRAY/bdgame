import { Character } from '../src/engine/entities/character'
import { gen, XUANJI, JUNSHI } from '../src/data/opponents/index'
import { runBattle } from '../src/engine/battle-runner'

const { engine } = runBattle(new Character(gen(XUANJI, 5)), new Character(gen(JUNSHI, 5)), () => {})
const raw = engine.state.log.getAll()
const names = new Map<string,string>()
for (const e of raw){ const s=(e.event??e).snapshot; if(s) for(const c of s.characters) names.set(c.id,c.name) }

// 1) scope[0] 分布：每个编号里有哪些类型
const byTurn = new Map<number, Set<string>>()
const tickLines: string[] = []
for (const e of raw) {
    const ev = e.event ?? e
    const sc = ev.scope ?? []
    if (!byTurn.has(sc[0])) byTurn.set(sc[0], new Set())
    byTurn.get(sc[0])!.add(ev.type)
    if (/(tick|回春|中毒|灼烧|伤害)/.test(ev.type ?? '') || /回春|中毒|灼烧/.test(ev.message ?? '')) {
        tickLines.push(`${(e.timelineMs??0)/1000}s scope=[${sc}] ${String(ev.type).padEnd(14)} ${names.get(ev.actorId ?? ev.actor ?? '') ?? '-'} ${(ev.message??'').slice(0,40)}`)
    }
}
console.log('=== scope[0] → 事件类型 ===')
for (const [t, types] of [...byTurn.entries()].sort((a,b)=>a[0]-b[0])) {
    console.log(`turn ${t}: ${[...types].join(', ')}`)
}
console.log('\n=== tick/heal 相关事件（前 20 条）===')
for (const l of tickLines.slice(0,20)) console.log(l)
