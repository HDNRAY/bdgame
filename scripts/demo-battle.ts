// npx tsx scripts/demo-battle.ts [n]
/// <reference types="node" />
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Character } from '../src/engine/entities/character'
import { calcMaxHp, calcMaxAp } from '../src/engine/calc/stats'
import {
    gen,
    FANGLIE,
    LAIFENG,
    XUANJI,
    LAYUE,
    YIDAO,
    SANGYUAN,
    BAIHU,
    LUEYING,
    LIUXIGUA,
    HONGTI,
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
    BAMBOO,
    TANGROU,
    OTSU,
    DAIXUAN,
    QIANXING,
    ORANGE,
    JIRAN,
    CHANZI,
    DOCTOR,
    XIAOHUA,
} from '../src/data/opponents/index'
import { getWeapon } from '../src/data/weapons/weapons'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'
import { StatsTracker } from '../src/engine/combat/stats-tracker'

// ── 满配对手（n=33） ──
const pBuild = gen(QIANXING, 33)
const oBuild = gen(LONGNV, 33)

const __dirname = dirname(fileURLToPath(import.meta.url))
const logPath = join(__dirname, 'battle-log.txt')
const logLines: string[] = []
// console 只显示胜负与伤害占比；log 文件保留全部内容（含单局完整战斗日志）
let consoleOnly = false
const origLog = console.log
// 仅控制台输出（不进 log 文件）：用于胜负等摘要行，保证文件内容不变
const consoleOnlyLog = (...args: unknown[]): void => origLog(...args)
console.log = (...args) => {
    const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')
    logLines.push(line)
    if (consoleOnly) origLog(...args)
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
    const offhand = c.build.offhand ? getWeapon(c.build.offhand) : null
    console.log(`  HP ${baseHp}  AP ${baseAp}`)
    console.log(`  主手: ${weapon.name}${offhand ? ` 副手: ${offhand.name}` : ''}`)
    if (c.passiveDefs.length) console.log(`  功法: ${c.passiveDefs.map((p) => p.name).join(', ')}`)
    if (c.artifactDefs.length) console.log(`  奇物: ${c.artifactDefs.map((a) => a.name).join(', ')}`)
    if (c.actions.length) console.log(`  招式: ${c.actions.map((i) => i.name).join(', ')}`)
    if (c.triggers.length)
        console.log(
            `  触发: ${c.triggers.map((s) => `${s.condition.type}→${s.actionId ?? s.effects?.map((e) => e.type).join(',') ?? '?'}`).join(', ')}`,
        )
}

if (N === 1) {
    const leftBase = new Character(oBuild)
    const rightBase = new Character(pBuild)
    show(rightBase)
    show(leftBase)
    console.log('')
    const stats = new StatsTracker()
    const { winner, engine } = runBattle(leftBase, rightBase, (e) => stats.handle(e))
    for (const line of formatBattleLog(engine.state.log).lines) console.log(line)
    const charNames = { [leftBase.id]: leftBase.name, [rightBase.id]: rightBase.name }
    const winName = winner === leftBase.id ? leftBase.name : winner === rightBase.id ? rightBase.name : '平局'
    consoleOnlyLog(`\n── 胜负 ──`)
    consoleOnlyLog(`  ${winName}`)
    consoleOnly = true
    console.log('\n── 伤害占比 ──')
    for (const line of stats.format(charNames)) console.log(line)
    consoleOnly = false
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
    // N>1 时 console.log 默认被劫持只进文件；这里临时开 consoleOnly 让统计结果同时打到终端
    consoleOnly = true
    console.log(`\n📊 ${N} 场统计`)
    console.log(`  ${oBuild.name}: ${leftWins} 胜 (${lr}%)  平均残血 ${((leftHp / N) * 100).toFixed(1)}%`)
    console.log(`  ${pBuild.name}: ${rightWins} 胜 (${rr}%)  平均残血 ${((rightHp / N) * 100).toFixed(1)}%`)
    console.log(`  平局: ${N - leftWins - rightWins}`)
    const charNames = { [leftId]: oBuild.name, [rightId]: pBuild.name }
    console.log('\n── 伤害占比 ──')
    for (const line of stats.format(charNames)) console.log(line)
    consoleOnly = false
}
