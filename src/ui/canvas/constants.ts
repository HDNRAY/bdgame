/** 每个像素放大倍数 */
export const PIXEL = 3
/** 精灵原始尺寸 */
export const SPRITE_SIZE = 16
/** 角色显示尺寸 */
export const CHAR_SIZE = SPRITE_SIZE * PIXEL
/** 角色脚底到画布底的偏移 */
export const VERT_OFFSET = 24
/** 角色脚底的 Y 坐标 */
export const GROUND_Y = (ch: number) => ch - VERT_OFFSET

// ── 移动平滑参数 ──
export const MAX_MOVE_SPEED = 6
export const GHOST_ALPHA = 0.2
export const GHOST_DECAY = 0.8
export const GHOST_MIN_ALPHA = 0.05
export const MAX_GHOSTS = 20
export const GHOST_SPAWN_RATIO = 0.5

// ── 浮动文字 ──
export const FLOAT_LIFE = 2000
export const FLOAT_DT = 16
export const FLOAT_RISE_SPEED = 0.5
export const FLOAT_FADE_START = 0.7
export const TEXT_STACK_V = 14
export const TEXT_STACK_H = 12
export const TEXT_EFFECT_OFFSET = 150
export const FONT_SIZE_FLOAT = 12
export const FONT_SIZE_TICK = 9

// ── 视口 ──
export const MIN_VIEW_UNITS = 8
