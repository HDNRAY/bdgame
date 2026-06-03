// npx tsx scripts/demo-battle.ts
import { Character } from '../src/engine/entities/character'
import { simulateFight } from '../src/engine/combat/simulate'
import { parseBattleLog } from '../src/engine/combat/log-parser'

const player = new Character('p1', '玩家', { strength: 14, vitality: 12, dexterity: 10, technique: 10, insight: 8, wisdom: 6 })
const opponent = new Character('o1', '铁拳·张烈', { strength: 16, vitality: 14, dexterity: 8, technique: 8, insight: 5, wisdom: 4 })

console.log(`\n⚔️ ${player.name} VS ${opponent.name}`)
console.log(`   玩家 STR${player.attrs.get('strength')} VIT${player.attrs.get('vitality')} HP${player.hp}`)
console.log(`   对手 STR${opponent.attrs.get('strength')} VIT${opponent.attrs.get('vitality')} HP${opponent.hp}\n`)

const { winner, engine } = simulateFight(player, opponent, 'iron_charge')

for (const e of parseBattleLog(engine.state.log)) {
    if (e.details.length === 0) {
        console.log(`${e.icon} ${e.summary}`)
    } else {
        console.log(`  ${e.summary}`)
        for (const d of e.details) console.log(`  ${d}`)
    }
}

console.log(`\n🏆 ${winner} 胜  玩家 HP${player.hp}/${player.maxHp} 对手 HP${opponent.hp}/${opponent.maxHp}`)
