// 快速演示：跑一场战斗并输出日志
// 使用: npx tsx scripts/demo-battle.ts

import { Character } from '../src/engine/entities/character'
import { simulateFight } from '../src/engine/combat/simulate'
import { parseBattleLog } from '../src/engine/combat/log-parser'

const player = new Character('p1', '玩家', {
    strength: 14,
    vitality: 12,
    dexterity: 10,
    technique: 10,
    insight: 8,
    wisdom: 6,
})

const opponent = new Character('o1', '铁拳·张烈', {
    strength: 16,
    vitality: 14,
    dexterity: 8,
    technique: 8,
    insight: 5,
    wisdom: 4,
})

console.log(`\n⚔️  ${player.name} VS ${opponent.name}\n`)
console.log(`   玩家: STR ${player.attrs.get('strength')} VIT ${player.attrs.get('vitality')} HP ${player.hp}`)
console.log(`   对手: STR ${opponent.attrs.get('strength')} VIT ${opponent.attrs.get('vitality')} HP ${opponent.hp}\n`)
console.log('─── 战斗开始 ───\n')

const { winner, engine } = simulateFight(player, opponent, 'iron_charge')
const result = { winner, log: engine.state.log }

// 用解析器转成可读文本
const parsed = parseBattleLog(engine.state.log)
// 原战日志（对话区格式）
console.log(parsed.flatMap(e => [`${e.icon} ${e.summary}`, ...e.details]).join('\n'))
console.log(`\n─── ${winner} 胜利 ───`)
console.log(`   玩家剩余 HP: ${player.hp}/${player.maxHp}`)
console.log(`   对手剩余 HP: ${opponent.hp}/${opponent.maxHp}`)

// 右栏摘要格式
console.log('\n─── 日志摘要（右栏） ───\n')
for (const e of parsed) {
    console.log(`${e.icon} ${e.summary}`)
}
