/**
 * 像素精灵 — 角色精灵 / 头像 / 武器叠加层
 *
 * 用法:
 *   import { makeCharacterSprite, getWeaponOverlay } from '../pixel-sprites'
 */

export type { Palette, PixelMap, PixelSprite, AvatarData, WeaponOverlay } from './types'

export { MONO_PALETTE, CHARACTER_COLORS, CHARACTER_SPRITE_MAP } from './palette'
export type { CharacterColors } from './palette'

export { makeCharacterSprite, getCharacterAvatar, renderAvatarToCanvas } from './character'

export { HAND_POINTS, WEAPON_OVERLAYS, getWeaponOverlay } from './weapons'
