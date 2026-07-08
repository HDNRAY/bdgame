// npx tsx scripts/demo-battle.ts [n]
/// <reference types="node" />
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Character } from '../src/engine/entities/character'
import { calcMaxHp, calcMaxAp } from '../src/engine/calc/stats'
import {
    gen,
    ZHANGLIE,
    LAIFENG,
    XUANJI,
    LAYUE,
    YIDAO,
    SANGYUAN,
    BAIHU,
    LUEYING,
    LIUXIGUA,
    LUHONGTI,
    QILAN,
    LONGNV,
    YANGGUO,
    AJIU,
    WUKONG,
    XUNXIANG,
    JUNSHI,
    DUOER,
    FENGSHUI,
    WUZUI,
    HEIYUN,
    HAORAN,
} from '../src/engine/data/opponents/index'
import { getWeapon } from '../src/engine/data/weapons/weapons'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'
import { StatsTracker } from '../src/engine/combat/stats-tracker'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logPath = join(__dirname, 'battle-log.txt')
const logLines: string[] = []
const origLog = console.log
console.log = (...args) => {
    const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')
    logLines.push(line)
    origLog(...args)
}
process.on('exit', () => writeFileSync(logPath, logLines.join('\n') + '\n', 'utf-8'))

console.clear()

const N = Math.max(1, parseInt(process.argv[2] ?? '1', 10))

function show(c: Character) {
    const weapon = getWeapon(c.build.weapon)
    const a = c.attrs
    const baseHp = calcMaxHp(a.get('vitality'))
    const baseAp = calcMaxAp(a.get('vitality'))
    console.log(`\n${c.name}`)
    console.log(
        `  STR ${a.get('strength')}  VIT ${a.get('vitality')}  AGI ${a.get('agility')}  DEX ${a.get('dexterity')}  INS ${a.get('insight')}  WIS ${a.get('wisdom')}`,
    )
    console.log(`  HP ${baseHp}  AP ${baseAp}  武器: ${weapon.name}`)
    if (c.passiveDefs.length) console.log(`  功法: ${c.passiveDefs.map((p) => p.name).join(', ')}`)
    if (c.artifactDefs.length) console.log(`  奇物: ${c.artifactDefs.map((a) => a.name).join(', ')}`)
    if (c.actions.length) console.log(`  招式: ${c.actions.map((i) => i.name).join(', ')}`)
    if (c.triggers.length)
        console.log(
            `  触发: ${c.triggers.map((s) => `${s.condition.type}→${s.actionId ?? s.effects?.map((e) => e.type).join(',') ?? '?'}`).join(', ')}`,
        )
}

// ── 满配对手（n=33） ──
const pBuild = gen(YIDAO, 33)
const oBuild = gen(HEIYUN, 33)

if (N === 1) {
    const leftBase = new Character(oBuild)
    const rightBase = new Character(pBuild)
    show(rightBase)
    show(leftBase)
    console.log('')
    const stats = new StatsTracker()
    const { engine } = runBattle(leftBase, rightBase, (e) => stats.handle(e))
    for (const line of formatBattleLog(engine.state.log).lines) console.log(line)
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
