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

/** 角色描边色（主题化）：浅色=黑，深色=浅灰（不用纯白，避免与白色背景/角色冲突） */
export const SPRITE_OUTLINE_LIGHT = '#000000'
export const SPRITE_OUTLINE_DARK = '#c8c8d8'

/** 按主题取角色描边色 */
export function getSpriteOutlineColor(theme: 'light' | 'dark'): string {
    return theme === 'dark' ? SPRITE_OUTLINE_DARK : SPRITE_OUTLINE_LIGHT
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

/** 角色 ID → 完整配色（32 人） */
export const CHARACTER_COLORS: Record<string, CharacterColors> = {
    // ── default 体型 ──
    yidao: { skin: '#f5d6c6', hair: '#2a2a3a', eyes: '#b71902', accent: '#8c1d18', decoration: '#d4a848' },
    hongti: { skin: '#f0c8a0', hair: '#6b1a1a', eyes: '#4a6741', accent: '#c0392b', decoration: '#f0f0f8' }, // 白山月：白月银饰
    // ── heavy 体型 ──
    fanglie: { skin: '#d8a878', hair: '#2c2c2c', eyes: '#8B4513', accent: '#5d5d5d', decoration: '#a4a4a4' },
    sangyuan: { skin: '#f5d6c6', hair: '#3a3a3a', eyes: '#c0392b', accent: '#ca7932', decoration: '#e8d8a0' }, // 红眼·桑原：红眼
    baihu: { skin: '#f8f0f0', hair: '#e8e8f0', eyes: '#ff6347', accent: '#f8f8ff', decoration: '#ffb0c0' },
    // ── slender 体型 ──
    laifeng: { skin: '#fce4d6', hair: '#3a2a1a', eyes: '#5d4037', accent: '#4a90a4', decoration: '#c0d8e0' },
    layue: { skin: '#f8f4ec', hair: '#d8d8e8', eyes: '#6a7fd8', accent: '#e0e8f8', decoration: '#9fb6e8' },
    lueying: { skin: '#f5d6c6', hair: '#1a1a1a', eyes: '#2c3e50', accent: '#3f5d43', decoration: '#7a8a7a' },
    qilan: { skin: '#f0c8a0', hair: '#4a1a6b', eyes: '#7a5cc8', accent: '#6a4a9b', decoration: '#b0a0e8' },
    // ── robed 体型 ──
    xuanji: { skin: '#f5e6d0', hair: '#1a1a2e', eyes: '#2c3e50', accent: '#3a3a6a', decoration: '#8a8ac0' },
    liuxigua: { skin: '#f5d6c6', hair: '#3a5d1a', eyes: '#e84a3a', accent: '#4a8a3a', decoration: '#a0d080' }, // 霸刀·西瓜：绿皮红瓤
    // ── 扩展角色（21 人）──
    chanzi: { skin: '#f0c8a0', hair: '#6a6a6a', eyes: '#5d4037', accent: '#9b7a3a', decoration: '#d4b060' },
    yangguo: { skin: '#fce4d6', hair: '#2a2a2a', eyes: '#4a4a4a', accent: '#b08040', decoration: '#e0c070' },
    longnv: { skin: '#f8f0e8', hair: '#d8d8e8', eyes: '#4a90c8', accent: '#7aa0d8', decoration: '#c0d8f0' },
    wukong: { skin: '#e8a878', hair: '#a06030', eyes: '#d4500a', accent: '#e8a030', decoration: '#f0d060' },
    xunxiang: { skin: '#fce4d6', hair: '#5a1a2a', eyes: '#8a4a5a', accent: '#d86a8a', decoration: '#f0a0c0' },
    wuzui: { skin: '#e8c0a0', hair: '#5a4a3a', eyes: '#6a5a4a', accent: '#8a5a3a', decoration: '#c0a080' },
    heiyun: { skin: '#d8a880', hair: '#1a1a1a', eyes: '#3a3a3a', accent: '#2a2a2a', decoration: '#4a7a4a' }, // 小树：黑云 + 树绿点缀
    bamboo: { skin: '#f0c8a0', hair: '#2a5a2a', eyes: '#3a6a3a', accent: '#4a7a4a', decoration: '#80b060' },
    tangrou: { skin: '#fce4d6', hair: '#4a2a1a', eyes: '#6a4a3a', accent: '#e0a0a8', decoration: '#f0c8d0' },
    doctor: { skin: '#f8f0e8', hair: '#c8c8c8', eyes: '#5a7a9a', accent: '#e8e8e8', decoration: '#a0c8e8' },
    otsu: { skin: '#f0c8a0', hair: '#5a3a1a', eyes: '#6a4a2a', accent: '#e88a2a', decoration: '#f0b060' },
    xiaohua: { skin: '#fce4d6', hair: '#6a3a5a', eyes: '#8a4a7a', accent: '#e87aa0', decoration: '#f0b8d0' },
    orange: { skin: '#f0c8a0', hair: '#7a3a1a', eyes: '#8a4a2a', accent: '#e88a2a', decoration: '#f0c070' },
    daixuan: { skin: '#f8f0e8', hair: '#2a3a5a', eyes: '#4a6a9a', accent: '#3a5a8a', decoration: '#80a8d8' },
    qianxing: { skin: '#f0d0b0', hair: '#6a4a2a', eyes: '#7a5a3a', accent: '#9a9a9a', decoration: '#d4a848' }, // 天工·千星：铁灰 + 星金
    fengshui: { skin: '#f0c8a0', hair: '#3a3a5a', eyes: '#4a5a7a', accent: '#3a8a7a', decoration: '#80c8b0' },
    haoran: { skin: '#f5e6d0', hair: '#2a2a4a', eyes: '#3a5a8a', accent: '#4a7ab8', decoration: '#a0c8f0' },
    duoer: { skin: '#f0e8e0', hair: '#d8c0a0', eyes: '#7a6a5a', accent: '#f0f0f5', decoration: '#d4a848' }, // 陶朵：圣洁白 + 金
    junshi: { skin: '#f5e6d0', hair: '#2a2a2a', eyes: '#3a3a5a', accent: '#2a2a5a', decoration: '#6a6aa0' },
    ajiu: { skin: '#f0c8a0', hair: '#4a3a2a', eyes: '#5a4a3a', accent: '#6a6a7a', decoration: '#a0a0b0' },
    jiran: { skin: '#f5d6c6', hair: '#3a3a3a', eyes: '#5d4037', accent: '#7a5a3a', decoration: '#c0a080' },
}

/** 角色 ID → 体型映射 */
export const CHARACTER_SPRITE_MAP: Record<string, string> = {
    yidao: 'default',
    hongti: 'default',
    fanglie: 'heavy',
    sangyuan: 'heavy',
    baihu: 'heavy',
    laifeng: 'slender',
    layue: 'slender',
    lueying: 'slender',
    qilan: 'slender',
    xuanji: 'robed',
    liuxigua: 'robed',
    // ── 扩展角色（21 人）──
    chanzi: 'robed',
    yangguo: 'slender',
    longnv: 'slender',
    wukong: 'slender',
    xunxiang: 'slender',
    wuzui: 'heavy',
    heiyun: 'heavy',
    bamboo: 'slender',
    tangrou: 'slender',
    doctor: 'robed',
    otsu: 'default',
    xiaohua: 'slender',
    orange: 'heavy',
    daixuan: 'slender',
    qianxing: 'heavy',
    fengshui: 'slender',
    haoran: 'slender',
    duoer: 'slender',
    junshi: 'robed',
    ajiu: 'default',
    jiran: 'default',
}

/** 查找体型 ID */
export function getSpriteBodyType(charId: string): string {
    return CHARACTER_SPRITE_MAP[charId] ?? 'default'
}

/** 合并角色配色到调色板 */
export function buildPalette(charId: string, accentColor?: string, outlineColor?: string): Palette {
    const c = CHARACTER_COLORS[charId] ?? DEFAULT_COLORS
    void accentColor
    return {
        // 槽位 1=描边（light 默认黑 / dark 浅灰，主题化）
        '1': outlineColor ?? MONO_PALETTE['1'],
        // 固定槽位 2=发色 3=皮肤 4=瞳色 5=衣物 6=装饰 7=受击白眼/特效白
        '2': c.hair,
        '3': c.skin,
        '4': c.eyes,
        '5': c.accent,
        '6': c.decoration,
        '7': '#ffffff',
    }
}
