/**
 * 招式 tooltip 的数值/条件说明 — 纯展示适配，不涉及 React 与游戏状态
 *
 * 把「命中/暴击/爆伤/范围/上限/剩余/门槛」等前缀格式化集中在这里，
 * UI 组件（ActionTooltip）只负责渲染，不拼文案。
 */

import type { ActionDefinition } from '../engine/entities/action'
import { ATTR_CN } from '../engine/entities/attributes'

/** 招式附加说明 */
export interface ActionNoteDisplay {
    /** 主说明列表（目标/命中/暴击/爆伤/范围/上限/剩余/门槛等） */
    extra: string[]
    /** 自定义释放条件（canUse 的短句说明），无则不显示 */
    canUse?: string
}

/**
 * 固定范围 getRange（无参函数）可直接求值显示数值；动态（带参）走 hookNotes.range。
 * 返回 null 表示无法静态求值。
 */
function evalStaticRange(action: ActionDefinition): [number, number] | null {
    if (!action.getRange || action.getRange.length !== 0) return null
    try {
        const r = action.getRange([0, 0] as [number, number], undefined)
        if (
            Array.isArray(r) &&
            r.length === 2 &&
            typeof r[0] === 'number' &&
            typeof r[1] === 'number' &&
            isFinite(r[0]) &&
            isFinite(r[1]) &&
            r[0] <= r[1]
        ) {
            return r
        }
    } catch {
        /* 无参调用失败 → 走兜底 */
    }
    return null
}

/** 生成招式附加说明（tooltip 显示用） */
export function describeActionNotes(action: ActionDefinition, remainingUses?: number): ActionNoteDisplay {
    const notes = action.hookNotes
    const extra: string[] = []
    if (action.target === 'self') extra.push('自身')
    if (notes?.hitChance) extra.push(`命中 ${notes.hitChance}`)
    if (notes?.critChance) extra.push(`暴击 ${notes.critChance}`)
    if (notes?.critDamage) extra.push(`爆伤 ${notes.critDamage}`)
    if (notes?.range) {
        extra.push(`范围 ${notes.range}`)
    } else {
        const staticRange = evalStaticRange(action)
        if (staticRange) extra.push(`范围 ${staticRange[0]}-${staticRange[1]}`)
    }
    if (action.maxUses !== undefined) extra.push(`可用 ${action.maxUses} 次`)
    if (remainingUses !== undefined && isFinite(remainingUses)) extra.push(`剩余 ${remainingUses}次`)
    if (action.requiredTags && action.requiredTags.length > 0) extra.push(`需: ${action.requiredTags.join('/')}`)
    if (action.requireAttrsMin) {
        const req = Object.entries(action.requireAttrsMin).map(([k, v]) => `${ATTR_CN[k] ?? k}≥${v}`)
        extra.push(`门槛 ${req.join(' ')}`)
    }
    return { extra, canUse: notes?.canUse }
}
