/** 角色精灵 & 头像 */

import type { PixelSprite, AvatarData } from './types'
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
    // 裁取头部区域：行 12~23（头顶→下巴），列 30~41（脸居中；idle 右移11→左移4→右移1）
    const faceMap = set.idle.slice(12, 24).map((row) => row.slice(30, 42))
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
            const idx = avatar.pixels[y][x]
            const key = String(idx)
            const color = avatar.palette[key] ?? avatar.palette['0']
            if (!color || color === 'transparent') continue
            ctx.fillStyle = color
            ctx.fillRect(cx + x * s, cy + y * s, s, s)
        }
    }
}
