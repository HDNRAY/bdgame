import type { AttrName } from '../../../engine/entities/attributes'
import { ATTR_CN } from '../../../engine/entities/attributes'

interface Breakdown {
    base: number
    passives?: number
    artifacts?: number
    weapons?: number
    /** 战斗中临时 buff 效果（如刚劲、柔劲） */
    buffs?: number
}

interface StatTooltipProps {
    attr: AttrName
    value: number
    breakdown?: Breakdown
}

const ATTR_DESC: Record<AttrName, string> = {
    strength: '影响攻击伤害和招架减伤',
    vitality: '影响最大气血、最大内息',
    agility: '影响闪避率、移动效率和回合间隔',
    dexterity: '影响命中率、暴击率和招架率',
    insight: '影响命中率、闪避率、暴击率和招架率',
    wisdom: '影响触发槽数量、炁效果和回合间隔',
}

function fmt(v: number): string {
    return v > 0 ? `+${v}` : `${v}`
}

/** 属性 tooltip 内容 */
export function StatTooltip({ attr, value, breakdown }: StatTooltipProps) {
    return (
        <div>
            <div className="tt-name">{ATTR_CN[attr]}</div>
            <div className="tt-desc">{ATTR_DESC[attr]}</div>
            <hr className="tt-separator" />
            <div className="tt-extra">总值: {value}</div>
            {breakdown && (
                <>
                    <div className="tt-extra tt-extra-dim">基础: {breakdown.base}</div>
                    {!!breakdown.passives && (
                        <div className="tt-extra tt-extra-dim">功法: {fmt(breakdown.passives)}</div>
                    )}
                    {!!breakdown.artifacts && (
                        <div className="tt-extra tt-extra-dim">奇物: {fmt(breakdown.artifacts)}</div>
                    )}
                    {!!breakdown.weapons && <div className="tt-extra tt-extra-dim">武器: {fmt(breakdown.weapons)}</div>}
                    {!!breakdown.buffs && <div className="tt-extra tt-extra-dim">Buff: {fmt(breakdown.buffs)}</div>}
                </>
            )}
        </div>
    )
}
