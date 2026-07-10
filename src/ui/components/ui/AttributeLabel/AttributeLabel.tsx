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
    /** 来源分解 { 功法, 奇物, 武器 } 的加成值（用于 BuildPanel 彩色条） */
    breakdown?: { passives: number; artifacts: number; weapons: number }
}

export function AttributeLabel({ attr, value, baseValue, compact, breakdown }: AttributeLabelProps) {
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
    const basePct = baseValue !== undefined ? Math.min(100, (baseValue / 30) * 100) : 0
    // 来源分解：正值叠加，负值合为红色段覆盖在右侧
    let posPassives = 0,
        posArtifacts = 0,
        posWeapons = 0
    let totalNeg = 0
    if (breakdown) {
        for (const [k, v] of Object.entries(breakdown) as [string, number][]) {
            if (v > 0) {
                if (k === 'passives') posPassives = v
                else if (k === 'artifacts') posArtifacts = v
                else if (k === 'weapons') posWeapons = v
            } else {
                totalNeg += Math.abs(v)
            }
        }
    }
    const grossPct = Math.min(100, (((baseValue ?? 0) + posPassives + posArtifacts + posWeapons) / 30) * 100)
    const negPct = Math.min(100, (totalNeg / 30) * 100)
    return (
        <div className="attr-label-full">
            <span className="attr-label-full-name">{cn}</span>
            <span className="attr-label-full-val">{displayVal}</span>
            <span className="attr-label-full-bar">
                {breakdown ? (
                    <>
                        <span className="attr-label-full-fill attr-base" style={{ width: `${basePct}%` }} />
                        {posPassives > 0 && (
                            <span
                                className="attr-label-full-fill attr-passive"
                                style={{ width: `${Math.min(100, (posPassives / 30) * 100)}%` }}
                            />
                        )}
                        {posArtifacts > 0 && (
                            <span
                                className="attr-label-full-fill attr-artifact"
                                style={{ width: `${Math.min(100, (posArtifacts / 30) * 100)}%` }}
                            />
                        )}
                        {posWeapons > 0 && (
                            <span
                                className="attr-label-full-fill attr-weapon"
                                style={{ width: `${Math.min(100, (posWeapons / 30) * 100)}%` }}
                            />
                        )}
                        {totalNeg > 0 && (
                            <span
                                className="attr-label-full-fill attr-negative"
                                style={{ width: `${negPct}%`, left: `${grossPct - negPct}%` }}
                            />
                        )}
                    </>
                ) : (
                    <span className="attr-label-full-fill" style={{ width: `${Math.min(100, (value / 30) * 100)}%` }} />
                )}
            </span>
        </div>
    )
}
