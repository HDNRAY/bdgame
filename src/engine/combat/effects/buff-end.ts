import type { BattleEngine } from '../engine'
import type { AttrName } from '../../entities/attributes'
import { getBuff } from '../../../data/buffs'
import { revertBuffMods, forEachBuffOf } from '../utils'
import { affectsApRegen, notifyRegenChanged } from '../utils/ap-regen'
import { ATTR_CN } from '../../entities/attributes'
import { BattleLog } from '../battle-log'

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
        if (char) {
            revertBuffMods(layer, char, engine.state)
            if (typeof layer.mods?.maxApMod === 'number') {
                char.maxApMod -= layer.mods.maxApMod
            }
        }
        engine.state.pendingBuffs.delete(buffKey)
        if (char && affectsApRegen(buffId)) notifyRegenChanged(engine.state, char)
        return
    }

    const tag = getBuff(buffId)?.name ?? buffId

    // 通用：反转属性变化
    const char = engine.getCharacter(charId)
    if (char) {
        revertBuffMods(layer, char, engine.state)
        if (typeof layer.mods?.maxApMod === 'number') {
            char.maxApMod -= layer.mods.maxApMod
        }
    }

    // stat_transfer：正向恢复目标
    if (buffId === 'stat_transfer' && layer.targetId) {
        const target = engine.getCharacter(layer.targetId)
        if (target && layer.mods) {
            for (const [attr, delta] of Object.entries(layer.mods)) {
                if (attr === 'maxApMod') continue
                target.attrs.modify(attr as AttrName, delta)
            }
        }
    }

    if (char && layer.mods) {
        const expireLabel = ['frost', 'paralyze', 'knockdown', 'sand_blind', 'stun'].includes(buffId)
            ? `${tag}消失`
            : tag
        const details = Object.entries(layer.mods)
            .filter(([a]) => a !== 'maxApMod')
            .map(([a, v]) => `${ATTR_CN[a] ?? a}${-(v as number) > 0 ? '+' : ''}${-(v as number)}`)
            .join(', ')
        // 独立叠层：计算本层到期后剩余层数（排除当前 key），供「剩N层」展示
        const buffDef = getBuff(buffId)
        let remaining = 0
        if (buffDef?.stacking?.type === 'independent') {
            forEachBuffOf(engine.state.pendingBuffs, charId, (_d, _l, id, key) => {
                if (id === buffId && key !== buffKey) remaining++
            })
        }
        // 无属性变化可展示的 buff（如竹叶青/烧刀子等纯持续效果）到期时给干净「消失」行，避免空行
        const body = details ? `${BattleLog.name(char.name)} ${details}` : `${BattleLog.name(char.name)} 消失`
        engine.emitLog({
            type: 'buff_end',
            buffId,
            targetId: char.id,
            label: expireLabel,
            remaining: 0,
            message: remaining > 0 ? `${body} · 剩${remaining}层` : body,
        })
    }

    engine.state.pendingBuffs.delete(buffKey)
    if (char && affectsApRegen(buffId)) notifyRegenChanged(engine.state, char)
}
