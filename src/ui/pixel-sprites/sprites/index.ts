/**
 * 身体帧集合：把每个姿势一个文件的帧拼成 SPRITES（角色 id → 各姿势已补齐留白的渲染帧）。
 */
import type { PixelMap } from '../types'
import { SPRITE_WIDTH, SPRITE_HEIGHT, SPRITE_PAD_LEFT } from '../constants'
import { DEFAULT_IDLE } from './idle'
import { DEFAULT_ATTACK } from './attack'
import { DEFAULT_HIT } from './hit'
import { DEFAULT_DODGE } from './dodge'
import { DEFAULT_PARRY } from './parry'
import { DEFAULT_BUFF } from './buff'

type SpriteSet = { idle: PixelMap; attack: PixelMap; hit: PixelMap; dodge: PixelMap; parry: PixelMap; buff: PixelMap }

export const SPRITES: Record<string, SpriteSet> = {
    default: {
        idle: padSprite(DEFAULT_IDLE),
        attack: padSprite(DEFAULT_ATTACK),
        hit: padSprite(DEFAULT_HIT),
        dodge: padSprite(DEFAULT_DODGE),
        parry: padSprite(DEFAULT_PARRY),
        buff: padSprite(DEFAULT_BUFF),
    },
}

/** 将精灵数据补齐到 SPRITE_WIDTH×SPRITE_HEIGHT（左侧留白 SPRITE_PAD_LEFT，内容靠右），使画布宽度可随时调整 */
function padSprite(src: PixelMap): PixelMap {
    const h = SPRITE_HEIGHT
    const w = SPRITE_WIDTH
    const leftPad = Math.max(0, SPRITE_PAD_LEFT)
    const result: PixelMap = []
    for (let y = 0; y < h; y++) {
        const row = src[y] ?? []
        const rowW = row.length
        const newRow = new Array<number>(w).fill(0)
        for (let x = 0; x < w; x++) {
            const srcX = x - leftPad
            if (srcX >= 0 && srcX < rowW) newRow[x] = row[srcX]
        }
        result.push(newRow)
    }
    return result
}

