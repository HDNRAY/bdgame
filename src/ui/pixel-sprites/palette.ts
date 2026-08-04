/** 调色板 & 角色配色方案 */

import type { Palette } from './types'

/**
 * 默认调色板 — sample.json 手绘厨师 6 色调色板
 * 像素索引 1..6 → key '1'..'6'（与 PixelMap 约定一致）
 * 稀疏 Record，按需扩展，无需预留 256 色
 */
const MONO_PALETTE: Palette = {
    0: 'transparent',
    1: '#000000', // 描边
}

/** 角色完整配色方案 */
export interface CharacterColors {
    skin: string // 皮肤色
    hair: string // 发色
    eyes: string // 瞳色
    accent: string // 衣物主色
    decoration: string // 装饰色
}

const DEFAULT_COLORS: CharacterColors = {
    skin: '#FFCC99',
    hair: '#555555',
    eyes: '#00A0FF',
    accent: '#DDDDDD',
    decoration: '#888888',
}

/** 角色 ID → 完整配色（暂空，后续慢慢补充） */
export const CHARACTER_COLORS: Record<string, CharacterColors> = {}

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
    void accentColor
    return {
        ...MONO_PALETTE,
        // 固定槽位 1=描边 不动；2=发色 3=皮肤 4=瞳色 5=衣物 6=装饰
        '2': c.hair,
        '3': c.skin,
        '4': c.eyes,
        '5': c.accent,
        '6': c.decoration,
    }
}
