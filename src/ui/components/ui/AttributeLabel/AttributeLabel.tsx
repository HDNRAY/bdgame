import type { AttrName } from '../../../../engine/entities/attributes'
import { ATTR_CN } from '../../../../engine/entities/attributes'
import { Tooltip } from '../Tooltip/Tooltip'
import { StatTooltip } from '../../tooltip-contents/StatTooltip'
import './AttributeLabel.scss'

interface AttributeLabelProps {
    attr: AttrName
    value: number
    /** 基础值（提供时显示差值如 12(+4)） */
    baseValue?: number
    /** compact 模式：精简标签（用于 BattlePanel）；full 模式：带进度条（用于 BuildPanel） */
    compact?: boolean
    /** 来源分解 { base, 功法, 奇物, 武器, Buff } */
    breakdown?: { base?: number; passives?: number; artifacts?: number; weapons?: number; buffs?: number }
}

export function AttributeLabel({ attr, value, baseValue, compact, breakdown }: AttributeLabelProps) {
    const cn = ATTR_CN[attr] ?? attr
    const displayVal = `${value}`

    const basePct = baseValue !== undefined ? Math.min(100, (baseValue / 30) * 100) : 0
    let posPassives = 0,
        posArtifacts = 0,
        posWeapons = 0
    let totalNeg = 0
    if (breakdown) {
        for (const [k, v] of Object.entries(breakdown) as [string, number][]) {
            if (k === 'base' || k === 'buffs') continue
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
    const baseW = basePct
    const passW = Math.min(100, (posPassives / 30) * 100)
    const artW = Math.min(100, (posArtifacts / 30) * 100)
    const wpnW = Math.min(100, (posWeapons / 30) * 100)

    const label = compact ? (
        <span className="attr-label-compact">
            {cn} {displayVal}
        </span>
    ) : (
        <div className="attr-label-full">
            <span className="attr-label-full-name">{cn}</span>
            <span className="attr-label-full-val">{displayVal}</span>
            <span className="attr-label-full-bar">
                {breakdown ? (
                    <>
                        <span className="attr-label-full-fill attr-base" style={{ width: `${baseW}%` }} />
                        {posPassives > 0 && (
                            <span
                                className="attr-label-full-fill attr-passive"
                                style={{ left: `${baseW}%`, width: `${passW}%` }}
                            />
                        )}
                        {posArtifacts > 0 && (
                            <span
                                className="attr-label-full-fill attr-artifact"
                                style={{ left: `${baseW + passW}%`, width: `${artW}%` }}
                            />
                        )}
                        {posWeapons > 0 && (
                            <span
                                className="attr-label-full-fill attr-weapon"
                                style={{ left: `${baseW + passW + artW}%`, width: `${wpnW}%` }}
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

    return (
        <Tooltip
            content={
                <StatTooltip
                    attr={attr}
                    value={value}
                    breakdown={breakdown ? { base: baseValue ?? value, ...breakdown } : undefined}
                />
            }
        >
            {label}
        </Tooltip>
    )
}
