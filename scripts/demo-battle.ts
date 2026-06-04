// npx tsx scripts/demo-battle.ts
import { Character } from '../src/engine/entities/character'
import type { CharacterBuild } from '../src/engine/entities/character-build'
import { getWeapon } from '../src/engine/data/weapons'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'

function show(c: Character, label: string) {
    const a = c.attrs
    const weapon = getWeapon(c.build.weapon)
    console.log(`\n${label}`)
    console.log(
        `  STR ${a.get('strength')}  VIT ${a.get('vitality')}  AGI ${a.get('agility')}  DEX ${a.get('dexterity')}  INS ${a.get('insight')}  WIS ${a.get('wisdom')}`,
    )
    console.log(`  HP ${c.maxHp}  AP ${c.maxAp}  武器: ${weapon.name}`)
    if (c.passives.length) console.log(`  功法: ${c.passives.map((p) => p.name).join(', ')}`)
    if (c.moves.length) console.log(`  招式: ${c.moves.map((i) => i.name).join(', ')}`)
    if (c.triggers.length)
        console.log(`  触发: ${c.triggers.map((s) => `${s.condition.type}→${s.actionId}`).join(', ')}`)
}

const pBuild: CharacterBuild = {
    id: 'p1',
    name: '玩家·拳',
    weapon: 'bare_hands',
    baseAttrs: { strength: 12, vitality: 10, agility: 14, dexterity: 10, insight: 8, wisdom: 12 },
    moves: ['iron_charge', 'straight_punch', 'crushing_blow', 'tremor_stomp', 'qi_focus', 'qi_gather'],
    triggers: [
        { condition: { type: 'on_parry' }, actionId: 'straight_punch' },
        { condition: { type: 'on_dodged' }, actionId: 'flick' },
        { condition: { type: 'on_move' }, actionId: 'qi_bolt' },
    ],
    passives: [
        {
            id: 'forge_4',
            name: '锻体·四级',
            description: '基础锻体，全属性+1。',
            statMods: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1 },
        },
    ],
    artifacts: [],
}
const p = new Character(pBuild)

const oBuild: CharacterBuild = {
    id: 'o1',
    name: '铁枪·张烈',
    weapon: 'iron_spear',
    baseAttrs: { strength: 16, vitality: 14, agility: 10, dexterity: 12, insight: 10, wisdom: 8 },
    moves: ['thrust', 'break_formation', 'pursuit_thrust'],
    triggers: [{ condition: { type: 'on_debuff' }, actionId: 'pursuit_thrust' }],
    passives: [{ id: 'iron_bone', name: '钢筋铁骨', description: '铜皮铁骨。' }],
    artifacts: [],
}
const o = new Character(oBuild)

show(p, '⚔️ 玩家·拳')
show(o, '👊 铁枪·张烈')
console.log('')

const { winner, engine } = runBattle(p, o, 'iron_charge', 'thrust')
for (const line of formatBattleLog(engine.state.log)) console.log(line)
console.log(
    `\n🏆 ${winner} 胜  玩家 HP${Math.round(p.hp * 10) / 10}/${p.maxHp} 对手 HP${Math.round(o.hp * 10) / 10}/${o.maxHp}`,
)
