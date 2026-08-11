import { getOpponentDef, gen } from '../src/data/opponents'
import { Character } from '../src/engine/entities/character'
import { runBattle } from '../src/engine/battle-runner'
import { formatBattleLog } from '../src/engine/format-log'

let w = 0
for (const oppId of ['fanglie', 'sangyuan', 'wuzui', 'ajiu', 'duoer', 'baihu', 'qilan']) {
    const opp = new Character(gen(getOpponentDef(oppId)!, 33))
    const ly = new Character(gen(getOpponentDef('lueying')!, 33))
    const { winner, engine } = runBattle(ly, opp, undefined, 4, false)
    const { lines } = formatBattleLog(engine.state.log)
    const c = (k: string) => lines.filter((l) => l.includes(k)).length
    if (winner === 'lueying') w++
    console.log(`vs ${oppId} → ${winner} | 切割${c('切割')} 脚踢${c('脚踢')} 发辫${c('发辫')} 五芒${c('五芒镖')}`)
}
console.log(`\n胜 ${w}/7`)
