import type { WeaponDef } from '../../../engine/data/weapons/weapons'
import { getAction } from '../../../engine/data/actions'
import { TagList } from '../ui/TagList/TagList'
import { EffectList } from '../ui/EffectList/EffectList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'
import { EntityItem } from '../ui/EntityItem/EntityItem'

interface WeaponTooltipProps {
    weapon: WeaponDef
}

/** 武器 tooltip 内容 */
export function WeaponTooltip({ weapon }: WeaponTooltipProps) {
    return (
        <div>
            <div className="tt-name">{weapon.name}</div>
            <TagList tags={weapon.tags} />
            <div className="tt-extra">
                攻击距离 {weapon.range[0]}-{weapon.range[1]}
                {weapon.bound && ' · 绑定'}
            </div>
            {weapon.description && <div className="tt-desc">{weapon.description}</div>}
            {weapon.requireAttrsMin && (
                <div className="tt-extra">
                    需:{' '}
                    {Object.entries(weapon.requireAttrsMin)
                        .map(([k, v]) => `${k}≥${v}`)
                        .join(', ')}
                </div>
            )}
            {weapon.effects && weapon.effects.length > 0 && <EffectList effects={weapon.effects} />}
            {weapon.summon && (
                <div className="tt-extra" style={{ marginTop: 'var(--sp-xxs)' }}>
                    <div className="tt-label">召唤: {weapon.summon.name}</div>
                    <div className="tt-extra-dim" style={{ marginBottom: 'var(--sp-xxs)' }}>
                        最多 {weapon.summon.maxCount(20)} 个
                    </div>
                    <div className="tt-flex-wrap" style={{ alignItems: 'center', marginTop: 'var(--sp-xxs)' }}>
                        <span className="tt-label">招式:</span>
                        {(() => {
                            const def = weapon.summon.action ?? getAction(weapon.summon.actionId)
                            return def ? <EntityItem entity={def} type="action" /> : null
                        })()}
                    </div>
                </div>
            )}
            {weapon.triggers && weapon.triggers.length > 0 && <TriggerEffects triggers={weapon.triggers} />}
        </div>
    )
}
