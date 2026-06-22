import type { AttrName } from '../../../../engine/entities/attributes'
import { ATTR_CN } from '../../../../engine/entities/attributes'
import './AttributeLabel.scss'

interface AttributeLabelProps {
    attr: AttrName
    value: number
    /** 基础值（提供时显示差值如 12(+4)） */
    baseValue?: number
    /** compact 模式：精简标签（用于 BattlePanel）；full 模式：带进度条（用于 BuildPanel） */
    compact?: boolean
}

export function AttributeLabel({ attr, value, baseValue, compact }: AttributeLabelProps) {
    const cn = ATTR_CN[attr] ?? attr
    const diff = baseValue !== undefined ? value - baseValue : 0
    const displayVal = diff !== 0 ? `${value}(${diff > 0 ? '+' : ''}${diff})` : `${value}`
    if (compact) {
        return (
            <span className="attr-label-compact">
                {cn} {displayVal}
            </span>
        )
    }
    const pct = Math.min(100, (value / 30) * 100)
    return (
        <div className="attr-label-full">
            <span className="attr-label-full-name">{cn}</span>
            <span className="attr-label-full-val">{displayVal}</span>
            <span className="attr-label-full-bar">
                <span className="attr-label-full-fill" style={{ width: `${pct}%` }} />
            </span>
        </div>
    )
}
