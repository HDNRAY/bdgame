import type { WeaponDef } from '../../../engine/data/weapons'
import { getAction } from '../../../engine/data/actions'
import { getTriggerName } from '../../../engine/data/triggers'
import { describeEffects } from '../../../engine/data/effectDisplay'
import { TagList } from '../ui/TagList/TagList'

interface WeaponTooltipProps {
    weapon: WeaponDef
}

/** 武器 tooltip 内容 */
export function WeaponTooltip({ weapon }: WeaponTooltipProps) {
    return (
        <div>
            <div className="tt-name">{weapon.name}</div>
            <TagList tags={weapon.tags} />
            {weapon.description && <div className="tt-desc">{weapon.description}</div>}
            {weapon.triggers && weapon.triggers.length > 0 && (
                <>
                    <hr className="tt-separator" />
                    {weapon.triggers.map((t, i) => {
                        const name = getTriggerName(t.condition.type)
                        const actionName = t.actionId ? getAction(t.actionId)?.name : undefined
                        return (
                            <div key={i} className="tt-extra" style={{ fontSize: 10, lineHeight: 1.7 }}>
                                <span style={{ color: '#888' }}>触发</span> {name}
                                {actionName && <span style={{ color: '#aaa' }}> → {actionName}</span>}
                                {!actionName && t.effects && t.effects.length > 0 && (
                                    <span style={{ color: '#aaa' }}> → {describeEffects(t.effects).join('；')}</span>
                                )}
                            </div>
                        )
                    })}
                </>
            )}
        </div>
    )
}
