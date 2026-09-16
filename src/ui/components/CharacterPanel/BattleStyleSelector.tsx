import type { BattleStyle } from '../../../game/entities/character-build'
import type { WeaponDef } from '../../../data/weapons/weapons'
import { STYLE_OPTIONS, getAutoLabel, getStyleLabel } from '../../../bridge/styleDisplay'
import { SearchSelect, type SelectOption } from '../ui/SearchSelect/SearchSelect'

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

    // 空串 = 自动（按武器射程判定）
    const options: SelectOption<BattleStyle | ''>[] = [
        { value: '', label: getAutoLabel(weapon) },
        ...STYLE_OPTIONS.map((o): SelectOption<BattleStyle | ''> => ({ value: o.value ?? '', label: o.label })),
    ]

    return (
        <SearchSelect
            className="cp-style-select"
            value={value ?? ''}
            options={options}
            onChange={(v) => onChange(v === '' ? undefined : v)}
            searchPlaceholder="搜索战斗风格…"
        />
    )
}
