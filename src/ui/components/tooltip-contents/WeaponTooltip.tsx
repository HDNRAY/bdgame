import type { WeaponDef } from '../../../engine/data/weapons/weapons'
import { TagList } from '../ui/TagList/TagList'
import { TriggerEffects } from '../ui/TriggerEffects/TriggerEffects'

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
            {weapon.triggers && weapon.triggers.length > 0 && <TriggerEffects triggers={weapon.triggers} />}
        </div>
    )
}
