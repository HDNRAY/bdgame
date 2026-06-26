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
                <div className="tt-extra" style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>召唤: {weapon.summon.name}</div>
                    <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>
                        最多 {weapon.summon.maxCount(20)} 个
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: '#888' }}>招式:</span>
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
