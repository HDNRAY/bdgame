// 无志 强度与招式使用率快查
import { getOpponentDef, gen, WUZUI } from '../src/data/opponents'
import { Character } from '../src/engine/entities/character'
import { runBattle } from '../src/engine/battle-runner'
import { getWeapon } from '../src/data/weapons/weapons'

const POOL = [
    'fanglie',
    'sangyuan',
    'ajiu',
    'duoer',
    'baihu',
    'qilan',
    'lueying',
    'hongti',
    'jiran',
    'longnv',
    'qianxing',
]
const N = 60

const w = new Character(gen(WUZUI, 33))
const wp = getWeapon(w.build.weapon)
console.log(`无志 武器: ${wp.name} tags=[${wp.tags}]`)
console.log(
    `STR ${w.attrs.get('strength')} VIT ${w.attrs.get('vitality')} AGI ${w.attrs.get('agility')} DEX ${w.attrs.get('dexterity')} INS ${w.attrs.get('insight')} WIS ${w.attrs.get('wisdom')} AP${w.maxAp} HP${w.maxHp}`,
)
console.log(`招式: ${w.actions.map((a) => a.name).join(', ')}`)
console.log(`奇物: ${w.artifactDefs.map((a) => a.name).join(', ')}`)

let total = 0
for (const oppId of POOL) {
    const opp = new Character(gen(getOpponentDef(oppId)!, 33))
    let win = 0
    for (let i = 0; i < N; i++) {
        const { winner } = runBattle(new Character(w.build), new Character(opp.build), undefined, 4, false)
        if (winner === w.id) win++
    }
    const r = (win / N) * 100
    total += r
    console.log(`vs ${oppId.padEnd(8)} ${r.toFixed(0)}%`)
}
console.log(`\n平均 ${(total / POOL.length).toFixed(0)}%`)
