// 验证铸火诀：阿九受灼烧减半 + 施加灼烧+1层
import { gen, AJIU, JIRAN } from '../src/data/opponents'
import { runBattle } from '../src/engine/battle-runner'
import { Character } from '../src/engine/entities/character'
const log: string[] = []
const res = runBattle(
    new Character(gen(AJIU, 33)),
    new Character(gen(JIRAN, 33)),
    (l: any) => {
        if (l.type === 'damage_over_time' && l.status === '灼烧') {
            log.push(`阿九受灼烧 tick: ${l.amount} (源 ${l.sourceId})`)
        }
    },
    4,
    false,
)
// 直接查结束时的 pendingBuffs 有没有铸火
const zhu = res.engine.state.pendingBuffs.get('zhu_huo_jue_buff::ajiu')
console.log('胜利者:', res.winner, '| 阿九结束时是否持有铸火buff:', !!zhu)
console.log('--- 阿九受灼烧 tick 伤害 ---')
console.log(log.slice(0, 15).join('\n') || '（本场阿九没被灼烧 tick，或战斗太快）')
