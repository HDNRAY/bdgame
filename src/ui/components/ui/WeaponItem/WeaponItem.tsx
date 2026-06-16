import type { WeaponDef } from '../../../../engine/data/weapons'
import { Tooltip } from '../Tooltip/Tooltip'
import { WeaponTooltip } from '../../tooltip-contents/WeaponTooltip'
import '../EntityItem/EntityItem.scss'

interface WeaponItemProps {
    weapon: WeaponDef
}

/** 武器名 — 自带 WeaponTooltip */
export function WeaponItem({ weapon }: WeaponItemProps) {
    return (
        <Tooltip content={<WeaponTooltip weapon={weapon} />}>
            <span>{weapon.name}</span>
        </Tooltip>
    )
}
