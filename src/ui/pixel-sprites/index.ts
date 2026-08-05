/**
 * 像素精灵 — 角色精灵 / 头像 / 武器叠加层
 *
 * 用法:
 *   import { makeCharacterSprite, getWeaponOverlay } from '../pixel-sprites'
 */

export type { Palette, PixelMap, PixelSprite, AvatarData, WeaponOverlay } from './types'

export {
    SPRITE_WIDTH,
    SPRITE_HEIGHT,
    WEAPON_WIDTH,
    WEAPON_HEIGHT,
    AVATAR_ROW_START,
    AVATAR_ROW_END,
    AVATAR_COL_START,
    AVATAR_COL_END,
} from './constants'

export { CHARACTER_COLORS, CHARACTER_SPRITE_MAP } from './palette'
export type { CharacterColors } from './palette'

export { makeCharacterSprite, getCharacterAvatar, renderAvatarToCanvas } from './character'

export { HAND_POINTS, HAND_COVER, WEAPON_OVERLAYS, getWeaponOverlay } from './weapons'
