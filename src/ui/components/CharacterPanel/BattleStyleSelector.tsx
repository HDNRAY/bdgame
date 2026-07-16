import type { BattleStyle } from '../../../engine/entities/character-build'
import type { WeaponDef } from '../../../engine/data/weapons/weapons'
import { STYLE_OPTIONS, getAutoLabel, getStyleLabel } from '../../../bridge/styleDisplay'

interface BattleStyleSelectorProps {
    value: BattleStyle | undefined
    onChange: (v: BattleStyle | undefined) => void
    weapon?: WeaponDef
    isBuild: boolean
}

export function BattleStyleSelector({ value, onChange, weapon, isBuild }: BattleStyleSelectorProps) {
    if (!isBuild) {
        return <span className="cp-style-tag">{getStyleLabel(value, weapon)}</span>
    }

    return (
        <select
            className="cp-style-select"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : (e.target.value as BattleStyle))}
        >
            <option value="">{getAutoLabel(weapon)}</option>
            {STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value ?? ''}>
                    {opt.label}
                </option>
            ))}
        </select>
    )
}
