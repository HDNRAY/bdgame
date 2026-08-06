import { BUFF_DB } from '../buffs'
import { DEBUFF_DB } from './debuffs'
import { BuffDef } from './types'

export type { BuffHookCtx, BuffExpiry, BuffStacking, BuffDef } from './types'
export { BUFF_DB } from './buffs'
export { DEBUFF_DB } from './debuffs'
export { buffEnhanceActionRange } from './util'

// 预构建 id → 定义 索引：getBuff 是战斗热路径（每回合/每击遍历多次），线性 find 上百条 buff 开销大
// 懒构建：存在循环引用，模块顶层执行时 BUFF_DB 可能尚未就绪，首次调用时再建
let _buffById: Map<string, BuffDef> | null = null
function buffById(): Map<string, BuffDef> {
    if (!_buffById) {
        const m = new Map<string, BuffDef>()
        for (const b of BUFF_DB) m.set(b.id, b)
        // 保持旧语义：BUFF_DB 优先，同 id 不被 DEBUFF_DB 覆盖
        for (const b of DEBUFF_DB) {
            if (!m.has(b.id)) m.set(b.id, b)
        }
        _buffById = m
    }
    return _buffById
}

export function getBuff(id: string): BuffDef | undefined {
    return buffById().get(id)
}
