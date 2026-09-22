/**
 * 像素精灵 — 角色精灵 / 头像 / 武器叠加层
 *
 * 用法:
 *   import { makeCharacterSprite, getWeaponOverlay } from '../pixel-sprites'
 */

export type {
    Palette,
    PixelMap,
    PixelSprite,
    AvatarData,
    WeaponOverlay,
    WeaponPixelColor,
    WeaponPoseConfig,
} from './types'

export {
    SPRITE_WIDTH,
    SPRITE_HEIGHT,
    SPRITE_PAD_LEFT,
    SPRITE_PAD_BOTTOM,
    WEAPON_WIDTH,
    WEAPON_HEIGHT,
    AVATAR_ROW_START,
    AVATAR_ROW_END,
    AVATAR_COL_START,
    AVATAR_COL_END,
} from './constants'

export { CHARACTER_COLORS, CHARACTER_SPRITE_MAP, DEFAULT_COLORS, buildPalette, getSpriteOutlineColor } from './palette'
export { SPRITE_OUTLINE_LIGHT, SPRITE_OUTLINE_DARK } from './palette'
export type { CharacterColors } from './palette'

export { makeCharacterSprite, getCharacterAvatar, renderAvatarToCanvas } from './character'

export {
    SPRITE_AURA_SLOT,
    SPRITE_MAX_SLOT,
    SPRITE_OUTLINE_SLOT,
    addAuraRing,
    autoOutline,
    coverBlock,
    fillAll,
    fillRegion,
    frameSize,
    frameStats,
    removePaletteColor,
    getCell,
    hitAnchor,
    isBodySlot,
    lineCells,
    moveAnchor,
    paintCell,
    paintLine,
    shiftFrame,
    snapAnchorToSkin,
} from './frame-edit'
export type { Cell, FrameStats, HandAnchorData, PaintOptions } from './frame-edit'

export {
    blankPixelMap,
    formatAnchorSnippet,
    formatCharacterColorsSnippet,
    formatWeaponOverlaySnippet,
    formatWeaponPoseSnippet,
    formatPixelMapJson,
    formatPixelMapLiteral,
    formatPixelMapSource,
    parsePixelMap,
    parseWeaponOverlay,
    stringifyPixelMap,
    unpadRenderedFrame,
} from './frame-io'
export type { ParsePixelMapResult, ParseWeaponResult, UnpadResult, WeaponGridData } from './frame-io'

export { parseEditorState, serializeEditorState } from './editor-storage'
export type { EditorMode, EditorTool, PixelEditorSavedState } from './editor-storage'

export {
    HAND_POINTS,
    HAND_COVER,
    LEFT_HAND_COVER,
    OTHER_HAND_POINT,
    POSE_NAMES,
    WEAPON_OVERLAYS,
    WEAPON_POSES,
    shouldDrawHandCover,
    getWeaponOverlay,
    getWeaponPoseConfig,
    getWeaponPixelColor,
    resolveWeaponPixels,
    getWeaponAngle,
    getWeaponHand,
    baseAnchorHand,
    poseConfigIn,
    handCoverTables,
    resolveWeaponMount,
    makePoses,
    mergePoseConfig,
    sharedOf,
    SHARED_KEYS,
} from './weapons'
export type { PoseKey, WeaponMount, WeaponPoseTable, WeaponSlot } from './weapons'
