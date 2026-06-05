// npx tsx scripts/demo-battle.ts [n]
import { Character } from '../src/engine/entities/character'
import type { CharacterBuild } from '../src/engine/entities/character-build'
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

// ── 角色构建 ──
const pBuild: CharacterBuild = {
    id: 'p1',
    name: '空拳·玩家',
    weapon: 'bare_hands',
    baseAttrs: { strength: 12, vitality: 10, agility: 18, dexterity: 10, insight: 8, wisdom: 12 },
    actions: ['qi_focus', 'qi_gather', 'straight_punch', 'crushing_blow', 'iron_charge', 'tremor_stomp'],
    triggers: [
        { condition: { type: 'on_parry' }, actionId: 'straight_punch' },
        { condition: { type: 'on_dodged' }, actionId: 'flick' },
        { condition: { type: 'on_move' }, actionId: 'qi_bolt' },
    ],
    passives: ['forge', 'ling_bo_wei_bu'],
    artifacts: [],
}

const oBuild: CharacterBuild = {
    id: 'o1',
    name: '铁枪·张烈',
    weapon: 'iron_spear',
    baseAttrs: { strength: 16, vitality: 14, agility: 10, dexterity: 12, insight: 10, wisdom: 8 },
    actions: ['thrust', 'break_formation', 'pursuit_thrust'],
    triggers: [{ condition: { type: 'on_debuff' }, actionId: 'pursuit_thrust' }],
    passives: ['iron_bone'],
    // artifacts: [],
    artifacts: ['titanium_arm', 'heart_pump', 'neural_net'],
}

const mBuild: CharacterBuild = {
    id: 'm1',
    name: '御物·玄机',
    weapon: 'tri_orb',
    baseAttrs: { strength: 6, vitality: 10, agility: 10, dexterity: 14, insight: 14, wisdom: 18 },
    actions: ['qi_bolt'],
    triggers: [
        { condition: { type: 'on_parry' }, actionId: 'restore_ap' },
        { condition: { type: 'on_dodge' }, actionId: 'summon_haste' },
        { condition: { type: 'on_hit' }, actionId: 'agility_steal' },
    ],
    passives: ['spirit_resonance'],
    artifacts: [],
}

const leftBase = new Character(oBuild)
const rightBase = new Character(pBuild)

const leftName = leftBase.name
const rightName = rightBase.name

// 单场模式：打印角色信息和战斗日志
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
    // 多场模式：仅统计胜率（从 base clone，效率高）
    let leftWins = 0
    let rightWins = 0
    for (let i = 0; i < N; i++) {
        const { winner } = runBattle(leftBase, rightBase)
        if (winner === leftName) leftWins++
        else if (winner === rightName) rightWins++
    }
    const leftRate = ((leftWins / N) * 100).toFixed(1)
    const rightRate = ((rightWins / N) * 100).toFixed(1)
    console.log(`\n📊 ${N} 场统计`)
    console.log(`  ${leftName}: ${leftWins} 胜 (${leftRate}%)`)
    console.log(`  ${rightName}: ${rightWins} 胜 (${rightRate}%)`)
    console.log(`  平局: ${N - leftWins - rightWins}`)
}
