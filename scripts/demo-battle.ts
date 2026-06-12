// npx tsx scripts/demo-battle.ts [n]
import { Character } from '../src/engine/entities/character'
import { ZHANGLIE, LAIFENG, XUANJI, LAYUE, YIDAO, SANGYUAN } from '../src/engine/data/opponents/index'
import { getWeapon } from '../src/engine/data/weapons'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'
import { StatsTracker } from '../src/engine/combat/stats-tracker'

console.clear()

const N = Math.max(1, parseInt(process.argv[2] ?? '1', 10))

function show(c: Character) {
    const base = c.build.baseAttrs
    const weapon = getWeapon(c.build.weapon)
    const baseHp = 20 + (base.vitality ?? 3) * 10
    const baseAp = Math.round(3 + (base.vitality ?? 3) * 0.5)
    console.log(`\n${c.name}`)
    console.log(
        `  STR ${base.strength ?? 3}  VIT ${base.vitality ?? 3}  AGI ${base.agility ?? 3}  DEX ${base.dexterity ?? 3}  INS ${base.insight ?? 3}  WIS ${base.wisdom ?? 3}`,
    )
    console.log(`  HP ${baseHp}  AP ${baseAp}  武器: ${weapon.name}`)
    if (c.passiveDefs.length) console.log(`  功法: ${c.passiveDefs.map((p) => p.name).join(', ')}`)
    if (c.actions.length) console.log(`  招式: ${c.actions.map((i) => i.name).join(', ')}`)
    if (c.triggers.length)
        console.log(
            `  触发: ${c.triggers.map((s) => `${s.condition.type}→${s.actionId ?? s.effects?.map((e) => e.type).join(',') ?? '?'}`).join(', ')}`,
        )
}

// ── 满配对手（n=33） ──
const pBuild = LAIFENG.generate(33)
const oBuild = SANGYUAN.generate(33)

if (N === 1) {
    const leftBase = new Character(oBuild)
    const rightBase = new Character(pBuild)
    show(rightBase)
    show(leftBase)
    console.log('')
    const stats = new StatsTracker()
    const { winner, engine } = runBattle(leftBase, rightBase, (e) => stats.handle(e))
    const [cloneL, cloneR] = engine.state.characters
    for (const line of formatBattleLog(engine.state.log)) console.log(line)
    console.log(
        `\n🏆 ${winner} 胜  ${cloneL.name} HP${Math.round(cloneL.hp * 10) / 10}/${cloneL.maxHp} vs ${cloneR.name} HP${Math.round(cloneR.hp * 10) / 10}/${cloneR.maxHp}`,
    )
    const charNames = { [leftBase.id]: leftBase.name, [rightBase.id]: rightBase.name }
    console.log('\n── 伤害占比 ──')
    for (const line of stats.format(charNames)) console.log(line)
} else {
    let leftWins = 0,
        rightWins = 0
    let leftHp = 0,
        rightHp = 0
    const stats = new StatsTracker()
    const leftId = oBuild.id,
        rightId = pBuild.id
    for (let i = 0; i < N; i++) {
        const { winner, engine } = runBattle(new Character(oBuild), new Character(pBuild), (e) => stats.handle(e))
        if (winner === leftId) leftWins++
        else if (winner === rightId) rightWins++
        const [l, r] = engine.state.characters
        leftHp += l.hp / l.maxHp
        rightHp += r.hp / r.maxHp
    }
    const lr = ((leftWins / N) * 100).toFixed(1)
    const rr = ((rightWins / N) * 100).toFixed(1)
    console.log(`\n📊 ${N} 场统计`)
    console.log(`  ${oBuild.name}: ${leftWins} 胜 (${lr}%)  平均残血 ${((leftHp / N) * 100).toFixed(1)}%`)
    console.log(`  ${pBuild.name}: ${rightWins} 胜 (${rr}%)  平均残血 ${((rightHp / N) * 100).toFixed(1)}%`)
    console.log(`  平局: ${N - leftWins - rightWins}`)
    const charNames = { [leftId]: oBuild.name, [rightId]: pBuild.name }
    console.log('\n── 伤害占比 ──')
    for (const line of stats.format(charNames)) console.log(line)
}
