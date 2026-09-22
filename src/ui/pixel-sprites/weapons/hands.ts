/**
 * 手部锚点与遮罩表（全局，按姿势）——所有武器共用。
 *
 * 口径：锚点 = 手部遮罩块**正中**（遮罩左上角格号 + 块尺寸/2 − 0.5），
 * 这样 1 格宽的握柄正好落在手上。改锚点等于整体移动所有武器该姿势的落点，改完记得同步遮罩表。
 */

import { SPRITE_PAD_LEFT } from '../constants'

/** 各姿势右手握柄位置（角色精灵坐标，网格尺寸见 constants.ts SPRITE_WIDTH×SPRITE_HEIGHT） */
export const HAND_POINTS: Record<string, { x: number; y: number }> = {
    idle: { x: 30.5 + SPRITE_PAD_LEFT, y: 31.5 },
    attack: { x: 17.5 + SPRITE_PAD_LEFT, y: 26.5 }, // attack 帧主手（武器整体下移 1 格）
    dodge: { x: 32.5 + SPRITE_PAD_LEFT, y: 31.5 }, // 左移 1 格
    hit: { x: 23.5 + SPRITE_PAD_LEFT, y: 34.5 }, // 受击：武器被打飞（左 10 后再右移 2、下 3）
    // 招架：主手（右手）在面前抬起握拳（DEFAULT_PARRY 皮肤像素 28-29,24-25 中心）
    parry: { x: 28.5 + SPRITE_PAD_LEFT, y: 24.5 },
    // 加状态（爆气）：主手是胸前握紧的拳（DEFAULT_BUFF 皮肤像素 28-29,29-30，取左下角）
    buff: { x: 28.5 + SPRITE_PAD_LEFT, y: 29.5 } }

/**
 * 各姿势副手（左手，图中右侧）握点位置（角色精灵坐标，取 LEFT_HAND_COVER 中心）。
 * 双手武器的主握点（gripX/gripY）锚定于此；棍身轴线须穿过主手。
 * 一律以「内容坐标 + SPRITE_PAD_LEFT」书写，便于整体平移角色。
 */
export const OTHER_HAND_POINT: Record<string, { x: number; y: number }> = {
    idle: { x: 40.5 + SPRITE_PAD_LEFT, y: 31.5 }, // 副手武器左移 1 格、下移半格（与主手同高）
    attack: { x: 29.5 + SPRITE_PAD_LEFT, y: 25.5 }, // attack 帧副手（武器整体下移 1 格）
    dodge: { x: 42.5 + SPRITE_PAD_LEFT, y: 31.5 }, // 左移 1 格（武器）、与主手同高
    hit: { x: 43.5 + SPRITE_PAD_LEFT, y: 34.5 }, // 受击：副手武器右移 2、下移 3 格
    // 招架：副手（左手）在腰间握持（下移 1 格）
    parry: { x: 40 + SPRITE_PAD_LEFT, y: 27.5 },
    // 加状态（爆气）：副手是另一侧的拳（DEFAULT_BUFF 皮肤像素 43-44,29-30 中心）
    buff: { x: 43.5 + SPRITE_PAD_LEFT, y: 29.5 } }

/** 各姿势手部覆盖像素（人物精灵坐标）— 用角色皮肤色绘制在握柄上方，制造"握着"效果 */
export const HAND_COVER: Record<string, [number, number][]> = {
    idle: [
        [30 + SPRITE_PAD_LEFT, 31],
        [31 + SPRITE_PAD_LEFT, 31],
        [30 + SPRITE_PAD_LEFT, 32],
        [31 + SPRITE_PAD_LEFT, 32],
    ],
    attack: [
        [17 + SPRITE_PAD_LEFT, 26],
        [18 + SPRITE_PAD_LEFT, 26],
        [17 + SPRITE_PAD_LEFT, 27],
        [18 + SPRITE_PAD_LEFT, 27],
    ],
    dodge: [
        [32 + SPRITE_PAD_LEFT, 31],
        [33 + SPRITE_PAD_LEFT, 31],
        [32 + SPRITE_PAD_LEFT, 32],
        [33 + SPRITE_PAD_LEFT, 32],
    ],
    parry: [
        // 主手：面前抬起握拳（DEFAULT_PARRY 皮肤像素 28-29,24-25）
        [28 + SPRITE_PAD_LEFT, 24],
        [29 + SPRITE_PAD_LEFT, 24],
        [28 + SPRITE_PAD_LEFT, 25],
        [29 + SPRITE_PAD_LEFT, 25],
    ],
    // 加状态（爆气）：胸前握紧的主手（DEFAULT_BUFF 皮肤像素 28-29,29-30）
    buff: [
        [28 + SPRITE_PAD_LEFT, 29],
        [29 + SPRITE_PAD_LEFT, 29],
        [28 + SPRITE_PAD_LEFT, 30],
        [29 + SPRITE_PAD_LEFT, 30],
    ] }

/**
 * 各姿势第二只手（左手）覆盖像素（人物精灵坐标）— 双手武器（有 grip2）用皮肤色盖住第二握点。
 * idle 左手在角色右侧 4 格：40,31 41,31 40,32 41,32（+SPRITE_PAD_LEFT）；attack：29-31,25-26。
 * 一律以「内容坐标 + SPRITE_PAD_LEFT」书写，便于整体平移角色。
 */
export const LEFT_HAND_COVER: Record<string, [number, number][]> = {
    idle: [
        [40 + SPRITE_PAD_LEFT, 31],
        [41 + SPRITE_PAD_LEFT, 31],
        [40 + SPRITE_PAD_LEFT, 32],
        [41 + SPRITE_PAD_LEFT, 32],
    ],
    attack: [
        [29 + SPRITE_PAD_LEFT, 26],
        [29 + SPRITE_PAD_LEFT, 25],
        [30 + SPRITE_PAD_LEFT, 25],
        [30 + SPRITE_PAD_LEFT, 26],
    ],
    dodge: [
        [42 + SPRITE_PAD_LEFT, 31],
        [43 + SPRITE_PAD_LEFT, 31],
        [42 + SPRITE_PAD_LEFT, 32],
        [43 + SPRITE_PAD_LEFT, 32],
    ],
    parry: [
        // 副手：腰间握持（DEFAULT_PARRY 皮肤像素 39-41,27 / 40-41,28）
        [39 + SPRITE_PAD_LEFT, 27],
        [40 + SPRITE_PAD_LEFT, 27],
        [41 + SPRITE_PAD_LEFT, 27],
        [40 + SPRITE_PAD_LEFT, 28],
        [41 + SPRITE_PAD_LEFT, 28],
    ],
    // 加状态（爆气）：胸前握紧的副手（DEFAULT_BUFF 皮肤像素 43-44,29-30）
    buff: [
        [43 + SPRITE_PAD_LEFT, 29],
        [44 + SPRITE_PAD_LEFT, 29],
        [43 + SPRITE_PAD_LEFT, 30],
        [44 + SPRITE_PAD_LEFT, 30],
    ] }
