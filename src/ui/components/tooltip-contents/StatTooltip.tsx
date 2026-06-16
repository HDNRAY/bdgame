import type { AttrName } from '../../../engine/entities/attributes'
import { ATTR_CN } from '../../../engine/entities/attributes'

interface StatTooltipProps {
    attr: AttrName
    value: number
}

const ATTR_DESC: Record<AttrName, string> = {
    strength: '影响攻击伤害和招架减伤',
    vitality: '影响最大生命值、最大AP',
    agility: '影响闪避率、移动效率和回合间隔',
    dexterity: '影响命中率、暴击率和招架率',
    insight: '影响命中率、闪避率、暴击率和招架率',
    wisdom: '影响触发槽数量和炁效果',
}

/** 属性 tooltip 内容 */
export function StatTooltip({ attr, value }: StatTooltipProps) {
    return (
        <div>
            <div className="tt-name">{ATTR_CN[attr]}</div>
            <div className="tt-desc">{ATTR_DESC[attr]}</div>
            <hr className="tt-separator" />
            <div className="tt-extra">当前值: {value}</div>
        </div>
    )
}
