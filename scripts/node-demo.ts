// npx tsx scripts/node-demo.ts [n] [bgIdx] [weaponIdx]
// 节点探索模拟：引擎数据+方法 → 100场对战
import { Character } from '../src/engine/entities/character'
import { BACKGROUNDS } from '../src/engine/data/backgrounds'
import { STARTING_WEAPONS } from '../src/engine/data/rewards'
import { getWeapon } from '../src/engine/data/weapons'
import { runNodeExploration } from '../src/engine/systems/node-gen'
import { generateOpponent } from '../src/engine/systems/opponent-gen'
import { runBattle } from '../src/engine/battle-runner'
import { ALL_ATTRS } from '../src/engine/entities/attributes'

const N = Math.max(0, parseInt(process.argv[2] ?? '5', 10))
const BG_IDX = parseInt(process.argv[3] ?? '0', 10)
const WEAPON_IDX = parseInt(process.argv[4] ?? '0', 10)

console.clear()
console.log(`📋 节点探索模拟 (n=${N})`)
console.log('')

// 1. 列出可选项
console.log('── 可选背景 ──')
BACKGROUNDS.forEach((b, i) => console.log(`  ${i}. ${b.name} — ${b.desc}`))
console.log(`  使用: node-demo ${N} <背景序号> <武器序号>`)

console.log('\n── 可选武器 ──')
STARTING_WEAPONS.forEach((wId, i) => {
    const w = getWeapon(wId)
    console.log(`  ${i}. ${w.name} [${w.range}] — ${w.description}`)
})

// 2. 运行节点探索
console.log('\n── 节点探索 ──')
const { build: pBuild, logs } = runNodeExploration(BG_IDX, WEAPON_IDX, N)
for (const l of logs) console.log(`  ${l}`)

// 3. 生成对手
const oBuild = generateOpponent(N)

// 4. 展示最终阵容
console.log('\n── 最终阵容 ──')
const pChar = new Character(pBuild)
const oChar = new Character(oBuild)
const show = (c: Character) => {
    const base = c.build.baseAttrs
    const w = getWeapon(c.build.weapon)
    const baseHp = 20 + (base.vitality ?? 3) * 10
    const baseAp = Math.round(3 + (base.vitality ?? 3) * 0.5)
    console.log(`\n${c.name}`)
    console.log(
        `  STR ${base.strength ?? 3}  VIT ${base.vitality ?? 3}  AGI ${base.agility ?? 3}  DEX ${base.dexterity ?? 3}  INS ${base.insight ?? 3}  WIS ${base.wisdom ?? 3}`,
    )
    console.log(`  HP ${baseHp}  AP ${baseAp}  武器: ${w.name}`)
    if (c.passiveDefs.length) console.log(`  功法: ${c.passiveDefs.map((p) => p.name).join(', ')}`)
    if (c.actions.length) console.log(`  招式: ${c.actions.map((i) => i.name).join(', ')}`)
    if (c.artifactDefs.length) console.log(`  奇物: ${c.artifactDefs.map((a) => a.name).join(', ')}`)
}
show(pChar)
show(oChar)

// 5. 百场对战
console.log('\n── 对战 100 场 ──')
let pWin = 0,
    oWin = 0
let pHp = 0,
    oHp = 0
const pObj = new Character(pBuild)
const oObj = new Character(oBuild)
for (let i = 0; i < 100; i++) {
    const { winner, engine } = runBattle(pObj, oObj)
    if (winner === pBuild.name) pWin++
    else if (winner === oBuild.name) oWin++
    const [a, b] = engine.state.characters
    pHp += a.hp / a.maxHp
    oHp += b.hp / b.maxHp
}
console.log(`\n📊 ${100} 场统计 (n=${N})`)
console.log(`  ${pBuild.name}: ${pWin} 胜 (${pWin.toFixed(1)}%)  平均残血 ${((pHp / 100) * 100).toFixed(1)}%`)
console.log(`  ${oBuild.name}: ${oWin} 胜 (${oWin.toFixed(1)}%)  平均残血 ${((oHp / 100) * 100).toFixed(1)}%`)
console.log(`  平局: ${100 - pWin - oWin}`)
const totalAttrs = ALL_ATTRS.reduce((s, a) => s + oChar.attrs.get(a), 0)
console.log(`对手: ${oBuild.name} | 总属性 ${totalAttrs} | HP ${oChar.maxHp} | 奖励 ${oBuild.rewards.length} 个`)
console.log(`参考：满配 ≈ 33 节点 × 2 培养点/节点`)
