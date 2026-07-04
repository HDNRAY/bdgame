import { classifyAttackStyle } from '../../../engine/ai/move-planner'
import type { BattleStyle } from '../../../engine/entities/character-build'
import type { WeaponDef } from '../../../engine/data/weapons/weapons'

interface BattleStyleSelectorProps {
    value: BattleStyle | undefined
    onChange: (v: BattleStyle | undefined) => void
    weapon?: WeaponDef
    isBuild: boolean
}

const STYLE_OPTIONS: { label: string; value: BattleStyle | undefined }[] = [
    { label: '近战', value: 'melee' },
    { label: '中距离', value: 'mid' },
    { label: '远程', value: 'ranged' },
]

function getAutoLabel(weapon?: WeaponDef): string {
    if (!weapon) return '随武器'
    switch (classifyAttackStyle(weapon.range)) {
        case 'melee':
            return '随武器（近战）'
        case 'mid':
            return '随武器（中距离）'
        case 'ranged':
            return '随武器（远程）'
    }
}

/** 获取战斗风格的显示标签 */
function getStyleLabel(bs: BattleStyle | undefined, weapon?: WeaponDef): string {
    if (bs === 'melee') return '近战'
    if (bs === 'mid') return '中距离'
    if (bs === 'ranged') return '远程'
    return getAutoLabel(weapon)
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
