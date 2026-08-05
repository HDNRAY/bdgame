/** 角色精灵画布尺寸（像素）。若需加宽画布（如攻击武器超出），统一改这里。 */
export const SPRITE_WIDTH = 60
export const SPRITE_HEIGHT = 48

/**
 * 角色内容在精灵画布中的水平偏移（左侧留白像素数）。
 * 攻击时武器向左上延伸会超出左边界，故左侧需预留空间（角色内容靠右）。
 */
export const SPRITE_PAD_LEFT = 11

/**
 * 角色内容在精灵画布底部的留白（像素行数）。
 * 画布高 SPRITE_HEIGHT，但实际内容并未填满底部（DEFAULT_IDLE 底部 8 行全 0）。
 * 战斗渲染时以此把内容脚底对齐地面（oy = groundY - spriteH + SPRITE_PAD_BOTTOM*PIXEL）。
 */
export const SPRITE_PAD_BOTTOM = 8

/** 武器叠加层坐标系尺寸（像素）。武器像素坐标基于此网格。 */
export const WEAPON_WIDTH = 32
export const WEAPON_HEIGHT = 32

/** 头像裁切区域（基于 SPRITE_WIDTH×SPRITE_HEIGHT 精灵）— 行范围（头顶→下巴） */
export const AVATAR_ROW_START = 12
export const AVATAR_ROW_END = 24
/** 头像裁切区域 — 列范围（脸居中；内容右移 SPRITE_PAD_LEFT 后需同步 +PAD） */
export const AVATAR_COL_START = 30 + SPRITE_PAD_LEFT
export const AVATAR_COL_END = 42 + SPRITE_PAD_LEFT
