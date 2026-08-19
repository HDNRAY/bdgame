import type { ActionDefinition } from '../../../engine/entities/action'
import { TagList } from '../ui/TagList/TagList'
import { EffectList } from '../ui/EffectList/EffectList'

interface ActionTooltipProps {
    action: ActionDefinition
    /** 当前剩余次数 */
    remainingUses?: number
}

/** 招式 tooltip 内容 */
export function ActionTooltip({ action, remainingUses }: ActionTooltipProps) {
    const notes = action.hookNotes
    // 固定范围 getRange（无参函数）可直接求值显示数值；动态（带参）走 hookNotes.range 或兜底
    let staticRange: [number, number] | null = null
    if (action.getRange && action.getRange.length === 0) {
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
                staticRange = r
            }
        } catch {
            /* 无参调用失败 → 走兜底 */
        }
    }
    const extra: string[] = []
    if (action.target === 'self') extra.push('自身')
    if (notes?.hitChance) extra.push(`命中 ${notes.hitChance}`)
    if (notes?.critChance) extra.push(`暴击 ${notes.critChance}`)
    if (notes?.critDamage) extra.push(`爆伤 ${notes.critDamage}`)
    if (notes?.range) extra.push(`范围 ${notes.range}`)
    else if (staticRange) extra.push(`范围 ${staticRange[0]}-${staticRange[1]}`)
    if (action.maxUses !== undefined) extra.push(`上限 ${action.maxUses}次`)
    if (remainingUses !== undefined && isFinite(remainingUses)) extra.push(`剩余 ${remainingUses}次`)
    if (action.requiredTags && action.requiredTags.length > 0) extra.push(`需: ${action.requiredTags.join('/')}`)
    if (action.requireAttrsMin) {
        const req = Object.entries(action.requireAttrsMin).map(([k, v]) => `${k}≥${v}`)
        extra.push(`门槛 ${req.join(' ')}`)
    }

    return (
        <div className="tt-relative">
            <div className="tt-ap-cost">
                {action.apCost}AP
                {action.chanCost !== undefined && <span className="tt-chan-cost">/{action.chanCost}缠</span>}
            </div>
            <div className="tt-name">{action.name}</div>
            <TagList tags={action.tags} />
            {action.description && <div className="tt-desc">{action.description}</div>}
            <hr className="tt-separator" />
            {extra.length > 0 && <div className="tt-extra">{extra.join(' · ')}</div>}
            {notes?.canUse && <div className="tt-extra tt-extra-dim">条件：{notes.canUse}</div>}
            {action.effects && action.effects.length > 0 && <EffectList effects={action.effects} />}
        </div>
    )
}
