// npx tsx scripts/demo-battle.ts [n]
import { Character } from '../src/engine/entities/character'
import { ZHANGLIE, PLAYER, XUANJI } from '../src/engine/data/opponents/index'
import { getWeapon } from '../src/engine/data/weapons'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'

console.clear()

const N = Math.max(1, parseInt(process.argv[2] ?? '1', 10))

function show(c: Character) {
    const a = c.attrs
    const weapon = getWeapon(c.build.weapon)
    console.log(`\n${c.name}`)
    console.log(
        `  STR ${a.get('strength')}  VIT ${a.get('vitality')}  AGI ${a.get('agility')}  DEX ${a.get('dexterity')}  INS ${a.get('insight')}  WIS ${a.get('wisdom')}`,
    )
    console.log(`  HP ${c.maxHp}  AP ${c.maxAp}  武器: ${weapon.name}`)
    if (c.passiveDefs.length) console.log(`  功法: ${c.passiveDefs.map((p) => p.name).join(', ')}`)
    if (c.actions.length) console.log(`  招式: ${c.actions.map((i) => i.name).join(', ')}`)
    if (c.triggers.length)
        console.log(`  触发: ${c.triggers.map((s) => `${s.condition.type}→${s.actionId}`).join(', ')}`)
}

// ── 满配对手（n=33） ──
const pBuild = PLAYER.generate(33)
const oBuild = ZHANGLIE.generate(33)
const mBuild = XUANJI.generate(33)

const leftBase = new Character(oBuild)
const rightBase = new Character(pBuild)
const leftName = leftBase.name
const rightName = rightBase.name

if (N === 1) {
    show(rightBase)
    show(leftBase)
    console.log('')
    const { winner, engine } = runBattle(leftBase, rightBase)
    const [cloneL, cloneR] = engine.state.characters
    for (const line of formatBattleLog(engine.state.log)) console.log(line)
    console.log(
        `\n🏆 ${winner} 胜  ${cloneL.name} HP${Math.round(cloneL.hp * 10) / 10}/${cloneL.maxHp} vs ${cloneR.name} HP${Math.round(cloneR.hp * 10) / 10}/${cloneR.maxHp}`,
    )
} else {
    let leftWins = 0, rightWins = 0
    for (let i = 0; i < N; i++) {
        const { winner } = runBattle(leftBase, rightBase)
        if (winner === leftName) leftWins++
        else if (winner === rightName) rightWins++
    }
    console.log(`\n📊 ${N} 场统计`)
    console.log(`  ${leftName}: ${leftWins} 胜 (${((leftWins / N) * 100).toFixed(1)}%)`)
    console.log(`  ${rightName}: ${rightWins} 胜 (${((rightWins / N) * 100).toFixed(1)}%)`)
    console.log(`  平局: ${N - leftWins - rightWins}`)
}
