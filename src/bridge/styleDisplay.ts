import { classifyAttackStyle } from '../engine/ai/move-planner'
import type { BattleStyle } from '../engine/entities/character-build'
import type { WeaponDef } from '../data/weapons/weapons'

/** 战斗风格选项定义 */
export const STYLE_OPTIONS: { label: string; value: BattleStyle | undefined }[] = [
    { label: '近战', value: 'melee' },
    { label: '中距', value: 'mid' },
    { label: '远程', value: 'ranged' },
]

const STYLE_MAP = new Map(STYLE_OPTIONS.map((o) => [o.value, o.label]))

/** 根据武器自动判定风格的显示标签 */
export function getAutoLabel(weapon?: WeaponDef): string {
    if (!weapon) return '自动'
    const style = classifyAttackStyle(weapon.range)
    const label = STYLE_MAP.get(style)
    return label ? `自动[${label}]` : '自动'
}

/** 获取战斗风格的显示标签（含自动判定退路） */
export function getStyleLabel(bs: BattleStyle | undefined, weapon?: WeaponDef): string {
    if (!bs) return getAutoLabel(weapon)
    return STYLE_MAP.get(bs) ?? ''
}
