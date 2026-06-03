// npx tsx scripts/demo-battle.ts
import { Character } from '../src/engine/entities/character'
import type { CharacterBuild } from '../src/engine/entities/character-build'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'

function show(c: Character, label: string) {
    const a = c.attrs
    console.log(`\n${label}`)
    console.log(
        `  STR ${a.get('strength')}  VIT ${a.get('vitality')}  DEX ${a.get('dexterity')}  TEC ${a.get('technique')}  INS ${a.get('insight')}  WIS ${a.get('wisdom')}`,
    )
    console.log(`  HP ${c.maxHp}  AP ${c.maxAp}`)
    if (c.passives.length) console.log(`  功法: ${c.passives.map((p) => p.name).join(', ')}`)
    if (c.moves.length) console.log(`  招式: ${c.moves.map((i) => i.name).join(', ')}`)
    if (c.triggers.length)
        console.log(`  触发: ${c.triggers.map((s) => `${s.condition.type}→${s.actionId}`).join(', ')}`)
}

const pBuild: CharacterBuild = {
    id: 'p1',
    name: '玩家·拳',
    baseAttrs: { strength: 14, vitality: 10, dexterity: 14, technique: 10, insight: 8, wisdom: 6 },
    moves: ['iron_charge', 'straight_punch', 'crushing_blow', 'qi_focus', 'qi_gather'],
    triggers: [
        { condition: { type: 'on_parry' }, actionId: 'straight_punch' },
        { condition: { type: 'on_dodged' }, actionId: 'flick' },
    ],
    passives: [
        { id: 'forge_4', name: '锻体·四级', statMods: { strength: 1, vitality: 1, dexterity: 1, technique: 1 } },
    ],
    artifacts: [],
}
const p = new Character(pBuild)

const oBuild: CharacterBuild = {
    id: 'o1',
    name: '铁枪·张烈',
    baseAttrs: { strength: 16, vitality: 14, dexterity: 8, technique: 8, insight: 5, wisdom: 4 },
    moves: ['thrust', 'sweep', 'fissure'],
    triggers: [],
    passives: [{ id: 'iron_bone', name: '钢筋铁骨' }],
    artifacts: [],
}
const o = new Character(oBuild)

show(p, '⚔️ 玩家·拳')
show(o, '👊 铁枪·张烈')
console.log('')

const { winner, engine } = runBattle(p, o, 'iron_charge', 'thrust')
for (const line of formatBattleLog(engine.state.log)) console.log(line)
console.log(`\n🏆 ${winner} 胜  玩家 HP${p.hp}/${p.maxHp} 对手 HP${o.hp}/${o.maxHp}`)
