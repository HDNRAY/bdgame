/** 角色精灵 & 头像 */

import type { Palette, PixelMap, PixelSprite, AvatarData } from './types'
import { getSpriteBodyType, buildPalette } from './palette'
import { SPRITES } from './sprites'

/** 获取角色精灵（含完整配色） */
export function makeCharacterSprite(charId: string, accentColor: string): PixelSprite {
    const bodyType = getSpriteBodyType(charId)
    const set = SPRITES[bodyType] ?? SPRITES.default
    const palette = buildPalette(charId, accentColor)
    return { palette, frames: { ...set } }
}

/** 获取角色头像 */
export function getCharacterAvatar(charId: string, accentColor: string): AvatarData {
    const bodyType = getSpriteBodyType(charId)
    const set = SPRITES[bodyType] ?? SPRITES.default
    const palette = buildPalette(charId, accentColor)
    // 裁取脸部区域：行 5~14（额头→脖子），列 10~19（双眼居中）
    const faceMap = set.idle.slice(5, 15).map((row) => row.slice(10, 20))
    return { palette, pixels: faceMap, scale: 4 }
}

/** 将像素数据渲染到 Canvas 2D 上下文 */
export function renderAvatarToCanvas(
    ctx: CanvasRenderingContext2D,
    avatar: AvatarData,
    cx: number,
    cy: number,
    scaleOverride?: number,
): void {
    const s = scaleOverride ?? avatar.scale
    for (let y = 0; y < avatar.pixels.length; y++) {
        for (let x = 0; x < avatar.pixels[y].length; x++) {
            const idx = avatar.pixels[y][x].toString(16).toUpperCase()
            const color = avatar.palette[idx] ?? avatar.palette['0']
            if (!color || color === 'transparent') continue
            ctx.fillStyle = color
            ctx.fillRect(cx + x * s, cy + y * s, s, s)
        }
    }
}
