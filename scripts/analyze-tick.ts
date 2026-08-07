import { Character } from '../src/engine/entities/character'
import { gen, HAORAN, LUHONGTI } from '../src/data/opponents/index'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'

const { engine } = runBattle(new Character(gen(HAORAN, 1)), new Character(gen(LUHONGTI, 1)), () => {})
const raw = engine.state.log.getAll()
const names = new Map<string,string>()
for (const e of raw){ const s=(e.event??e).snapshot; if(s) for(const c of s.characters) names.set(c.id,c.name) }
// 主行动（attack_start non-reaction / move）的时刻，用来对比 tick 是否独立
const mainTimes: {t:number,actor:string,type:string}[] = []
const tickEvts: {t:number,scope:number[],type:string,msg:string}[] = []
for (const e of raw) {
    const ev = e.event ?? e
    const sc = ev.scope ?? []
    const t = e.timelineMs ?? 0
    if (ev.type === 'attack_start' && sc.length === 2) mainTimes.push({t, actor:names.get(ev.actor)??'', type:'attack'})
    else if (ev.type === 'move' && sc.length <= 2) mainTimes.push({t, actor:names.get(ev.actor)??'', type:'move'})
    if (ev.type === 'heal' || ev.type === 'damage_over_time' || /回春|中毒|灼烧/.test(ev.message ?? '')) {
        tickEvts.push({t, scope:sc, type:ev.type, msg:(ev.message??'').slice(0,30)})
    }
}
console.log('=== 主行动时刻 ===')
for (const m of mainTimes.slice(0,15)) console.log(`${(m.t/1000).toFixed(2)}s ${m.actor} ${m.type}`)
console.log('\n=== tick/heal 事件（回春/毒/灼烧）===')
for (const k of tickEvts.slice(0,15)) console.log(`${(k.t/1000).toFixed(2)}s scope=[${k.scope}] ${k.type} ${k.msg}`)
console.log('\n=== 格式化 log 中 回春/毒 相关行 ===')
for (const l of formatBattleLog(engine.state.log).lines) if (/回春|中毒|灼烧|获得状态/.test(l)) console.log(l.slice(0,70))
