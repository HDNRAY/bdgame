// npx tsx scripts/demo-battle.ts
import { Character } from '../src/engine/entities/character'
import { simulateFight } from '../src/engine/combat/simulate'
import { formatBattleLog } from '../src/engine/combat/log-parser'
import { getAction } from '../src/engine/data/actions'

function show(c: Character, label: string) {
    const a = c.attrs
    console.log(`\n${label}`)
    console.log(`  STR ${a.get('strength')}  VIT ${a.get('vitality')}  DEX ${a.get('dexterity')}  TEC ${a.get('technique')}  INS ${a.get('insight')}  WIS ${a.get('wisdom')}`)
    console.log(`  HP ${c.maxHp}  AP ${c.maxAp}`)
    if (c.skills.length) console.log(`  功法: ${c.skills.join(', ')}`)
    if (c.actions.length) console.log(`  招式: ${c.actions.map(i => getAction(i)?.name ?? i).join(', ')}`)
    if (c.triggers.length) console.log(`  触发: ${c.triggers.join(', ')}`)
    if (c.implants.length) console.log(`  义体: ${c.implants.join(', ')}`)
    if (c.lifebound) console.log(`  本命: ${c.lifebound}`)
}

const p = new Character('p1', '玩家', { strength: 14, vitality: 12, dexterity: 10, technique: 10, insight: 8, wisdom: 6 })
p.actions = ['iron_charge', 'straight_punch', 'crushing_blow']
p.skills = ['铁布衫']

const o = new Character('o1', '铁拳·张烈', { strength: 16, vitality: 14, dexterity: 8, technique: 8, insight: 5, wisdom: 4 })
o.actions = ['iron_charge']
o.skills = ['铁布衫']

show(p, '⚔️ 玩家')
show(o, '👊 铁拳·张烈')
console.log('')

const { winner, engine } = simulateFight(p, o, 'iron_charge')
for (const line of formatBattleLog(engine.state.log)) console.log(line)
console.log(`\n🏆 ${winner} 胜  玩家 HP${p.hp}/${p.maxHp} 对手 HP${o.hp}/${o.maxHp}`)
