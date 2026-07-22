/** 调色板 & 角色配色方案 */

import type { Palette } from './types'

/** 默认调色板 — 白底 + 少量彩色点缀 */
export const MONO_PALETTE: Palette = {
    0: 'transparent',
    1: '#ffffff', // 白 - 肤色/底色
    2: '#e0e0e0', // 亮灰 - 头发
    3: '#a0a0a0', // 中灰 - 衣物阴影
    4: '#c0c0c0', // 浅灰 - 裤子
    5: '#989898', // 中浅灰 - 瞳孔/鞋子
    7: '#555555', // 深灰 - 描边轮廓
}

/** 角色完整配色方案 */
export interface CharacterColors {
    skin: string // palette 1
    hair: string // palette 2
    eyes: string // palette 5
    accent: string // palette 6（衣物主色）
}

const DEFAULT_COLORS: CharacterColors = {
    skin: '#ffffff',
    hair: '#e0e0e0',
    eyes: '#989898',
    accent: '#888888',
}

/** 角色 ID → 完整配色 */
export const CHARACTER_COLORS: Record<string, CharacterColors> = {
    // ── default 体型 ──
    yidao: { skin: '#f5d6c6', hair: '#1a1a2e', eyes: '#c0392b', accent: '#4ecdc4' },
    luhongti: { skin: '#f0c8a0', hair: '#6b1a1a', eyes: '#4a6741', accent: '#ff6b6b' },
    // ── heavy 体型 ──
    zhanglie: { skin: '#e8c4a0', hair: '#2c2c2c', eyes: '#8B4513', accent: '#d4a848' },
    sangyuan: { skin: '#f5d6c6', hair: '#708090', eyes: '#4682B4', accent: '#9b59b6' },
    baihu: { skin: '#f0e6d3', hair: '#c0c0c0', eyes: '#ff6347', accent: '#ffffff' },
    // ── slender 体型 ──
    laifeng: { skin: '#fce4d6', hair: '#d4a050', eyes: '#8B4513', accent: '#2ecc71' },
    layue: { skin: '#f5f0e8', hair: '#e8e8ff', eyes: '#87CEEB', accent: '#85c1e9' },
    lueying: { skin: '#f5d6c6', hair: '#2c1810', eyes: '#5D4037', accent: '#e74c3c' },
    qilan: { skin: '#f0c8a0', hair: '#4a1a6b', eyes: '#9b59b6', accent: '#9b59b6' },
    // ── robed 体型 ──
    xuanji: { skin: '#f5e6d0', hair: '#1a1a2e', eyes: '#2c3e50', accent: '#3498db' },
    liuxigua: { skin: '#f5d6c6', hair: '#5d3a1a', eyes: '#556b2f', accent: '#27ae60' },
}

/** 角色 ID → 体型映射 */
export const CHARACTER_SPRITE_MAP: Record<string, string> = {
    yidao: 'default',
    luhongti: 'default',
    zhanglie: 'heavy',
    sangyuan: 'heavy',
    baihu: 'heavy',
    laifeng: 'slender',
    layue: 'slender',
    lueying: 'slender',
    qilan: 'slender',
    xuanji: 'robed',
    liuxigua: 'robed',
}

/** 查找体型 ID */
export function getSpriteBodyType(charId: string): string {
    return CHARACTER_SPRITE_MAP[charId] ?? 'default'
}

/** 合并角色配色到调色板 */
export function buildPalette(charId: string, accentColor: string): Palette {
    const c = CHARACTER_COLORS[charId] ?? DEFAULT_COLORS
    return {
        ...MONO_PALETTE,
        '1': c.skin,
        '2': c.hair,
        '5': c.eyes,
        '6': c.accent ?? accentColor,
    }
}
