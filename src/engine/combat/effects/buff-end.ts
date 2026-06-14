import type { BattleEngine } from '../engine'
import type { AttrName } from '../../entities/attributes'
import { getBuff } from '../../data/buffs'
import { BattleLog } from '../battle-log'
import { revertBuffMods } from '../utils'
import { processActionEffect } from './action'

/** buff 到期恢复 */
export function processBuffEnd(buffKey: string, engine: BattleEngine): void {
    const layer = engine.state.pendingBuffs.get(buffKey)
    if (!layer) return
    const parts = buffKey.split('::')
    if (parts.length < 2) return

    const buffId = parts[0]
    const charId = parts[1]

    // 2-part keys: 直接删
    if (parts.length === 2) {
        const char = engine.getCharacter(charId)
        if (char) revertBuffMods(layer, char, engine)
        engine.state.pendingBuffs.delete(buffKey)
        // 过期自动归还武器
        if (buffId === 'disarmed' && char?.isAlive()) {
            const originalWeapon = layer.extra?.originalWeapon as string | undefined
            if (originalWeapon) {
                engine.emitLog({
                    type: 'system',
                    message: `[缴械] ${BattleLog.name(char.name)} 重握兵器！`,
                    actorId: char.id,
                })
                processActionEffect(
                    { type: 'switch_weapon', weaponId: originalWeapon },
                    char,
                    char,
                    engine,
                    engine.state.turn.currentTime,
                )
            }
        }
        return
    }

    const tag = getBuff(buffId)?.name ?? buffId

    // 通用：反转属性变化
    const char = engine.getCharacter(charId)
    if (char) revertBuffMods(layer, char, engine)

    // stat_transfer：正向恢复目标
    if (buffId === 'stat_transfer' && layer.targetId) {
        const target = engine.getCharacter(layer.targetId)
        if (target && layer.mods) {
            for (const [attr, delta] of Object.entries(layer.mods)) {
                target.attrs.modify(attr as AttrName, delta)
                if (attr === 'agility') engine.state.turn.recalcInterval(target.id, target.attrs.get('agility'))
            }
        }
    }

    if (char && layer.mods) {
        for (const [attr, delta] of Object.entries(layer.mods)) {
            const expireLabel = ['frost', 'paralyze', 'knockdown', 'sand_blind', 'stun'].includes(buffId)
                ? `${tag}消失`
                : tag
            engine.emitLog({
                type: 'stat_change',
                targetId: char.id,
                attr,
                delta: -(delta as number),
                label: expireLabel,
            })
        }
    }

    engine.state.pendingBuffs.delete(buffKey)
}
