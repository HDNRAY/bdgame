import type { BattleEngine } from '../engine'
import { getBuff } from '../../../data/buffs'
import { removeBuffLayer, dropBuffLayerQuiet, forEachBuffOf } from '../utils'
import { affectsApRegen, notifyRegenChanged } from '../utils/ap-regen'
import { ATTR_CN } from '../../entities/attributes'
import { BattleLog } from '../battle-log'

/**
 * buff 到期：删层 + 重算（属性由「base 按序回放」得出，没有逆运算）。
 *
 * 曾经的 `stat_transfer` 特例（到期时把扣掉的属性加回目标）已经不需要了 ——
 * 被汲取方自己有一条同寿命的条目，一起删掉、一起重算即自动还回去。
 */
export function processBuffEnd(buffKey: string, engine: BattleEngine): void {
    const layer = engine.state.pendingBuffs.get(buffKey)
    if (!layer) return
    const parts = buffKey.split('::')
    if (parts.length < 2) return

    const buffId = parts[0]
    const charId = parts[1]
    const char = engine.getCharacter(charId)

    // 2-part keys: 直接删（追击标记这类散落层，没有到期播报）
    if (parts.length === 2) {
        removeBuffLayer(engine, buffKey)
        if (char && affectsApRegen(buffId)) notifyRegenChanged(engine.state, char)
        return
    }

    // 被汲取方的配对账（`stat_transfer_drain::`）：静默删层。
    // 它只是「汲取期间扣掉的那笔属性」的持久化账（否则目标一重算就把掉掉的属性长回来），
    // 不是独立的一段状态：与改造前同口径，还给目标时既不播报、也不额外触发属性变化副作用。
    // 正常路径下它已经被汲取方到期时一并带走，这里兜底处理被单独删除/单独到期的情形。
    if (buffId === 'stat_transfer_drain') {
        dropBuffLayerQuiet(engine.state, buffKey)
        return
    }

    const tag = getBuff(buffId)?.name ?? buffId

    // 汲取方到期：先把被汲取方的配对账还回去，再播报 —— 与改造前一致（那一行的快照里目标属性已恢复）。
    if (buffId === 'stat_transfer' && layer.targetId) {
        const appId = parts.slice(2).join('::')
        const drainKey = `stat_transfer_drain::${layer.targetId}::${appId}`
        if (engine.state.pendingBuffs.has(drainKey)) dropBuffLayerQuiet(engine.state, drainKey)
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
        // 先删层再打日志：日志自带的快照要反映「到期之后」的属性（与旧实现先回退再打日志一致）
        removeBuffLayer(engine, buffKey)
        engine.emitLog({
            type: 'buff_end',
            buffId,
            targetId: char.id,
            label: expireLabel,
            remaining: 0,
            message: remaining > 0 ? `${body} · 剩${remaining}层` : body,
        })
        if (char && affectsApRegen(buffId)) notifyRegenChanged(engine.state, char)
        return
    }

    removeBuffLayer(engine, buffKey)
    if (char && affectsApRegen(buffId)) notifyRegenChanged(engine.state, char)
}
