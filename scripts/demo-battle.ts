// npx tsx scripts/demo-battle.ts
import { Character } from '../src/engine/entities/character'
import { simulateFight } from '../src/engine/simulate'
import { formatBattleLog } from '../src/engine/format-log'
import { getAction } from '../src/engine/data/actions'
import { getForgingBuffs } from '../src/engine/data/forging'
import type { AttrName } from '../src/engine/entities/attributes'

function show(c: Character, label: string) {
    const a = c.attrs
    console.log(`\n${label}`)
    console.log(
        `  STR ${a.get('strength')}  VIT ${a.get('vitality')}  DEX ${a.get('dexterity')}  TEC ${a.get('technique')}  INS ${a.get('insight')}  WIS ${a.get('wisdom')}`,
    )
    console.log(`  HP ${c.maxHp}  AP ${c.maxAp}`)
    if (c.skills.length) console.log(`  功法: ${c.skills.join(', ')}`)
    if (c.actionInstances.length) console.log(`  招式: ${c.actionInstances.map((i) => i.name).join(', ')}`)
    if (c.triggerSlots.length)
        console.log(`  触发: ${c.triggerSlots.map((s) => `${s.event}→${s.actionId}`).join(', ')}`)
}

const p = new Character('p1', '玩家·拳', {
    strength: 14,
    vitality: 10,
    dexterity: 14,
    technique: 10,
    insight: 8,
    wisdom: 6,
})
// 锻体在战斗准备阶段直接加属性，不经过 engine
const forgingBuffs = getForgingBuffs(4)
for (const b of forgingBuffs) p.attrs.modify(b.stat as AttrName, b.value)
;['iron_charge', 'straight_punch', 'crushing_blow', 'qi_focus', 'qi_gather'].forEach((id) => {
    const a = getAction(id)
    if (a) p.equipAction(a)
})
p.skills = ['铁布衫']
p.triggerSlots = [
    { event: 'on_parry', actionId: 'trigger_counter' },
    { event: 'on_dodged', actionId: 'trigger_insight' },
]

const o = new Character('o1', '铁枪·张烈', {
    strength: 16,
    vitality: 14,
    dexterity: 8,
    technique: 8,
    insight: 5,
    wisdom: 4,
})
;['thrust', 'sweep', 'fissure'].forEach((id) => {
    const a = getAction(id)
    if (a) o.equipAction(a)
})
o.skills = ['钢筋铁骨']

show(p, '⚔️ 玩家·拳')
show(o, '👊 铁枪·张烈')
console.log('')

const { winner, engine } = simulateFight(p, o, 'iron_charge', 'thrust')
for (const line of formatBattleLog(engine.state.log)) console.log(line)
console.log(`\n🏆 ${winner} 胜  玩家 HP${p.hp}/${p.maxHp} 对手 HP${o.hp}/${o.maxHp}`)
