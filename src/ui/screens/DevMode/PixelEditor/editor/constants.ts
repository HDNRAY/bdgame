import { WEAPON_OVERLAYS } from '../../../../pixel-sprites'
import type { PixelMap } from '../../../../pixel-sprites'
import {
    DEFAULT_ATTACK,
    DEFAULT_BUFF,
    DEFAULT_DODGE,
    DEFAULT_HIT,
    DEFAULT_IDLE,
    DEFAULT_PARRY,
} from '../../../../pixel-sprites/sprites'
import { CHARACTER_COLORS, CHARACTER_SPRITE_MAP } from '../../../../pixel-sprites/palette'
import type { CharacterColors } from '../../../../pixel-sprites/palette'
import { OPPONENTS } from '../../../../../data/opponents'
import { WEAPON_DB } from '../../../../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../../../../data/weapons/starting-weapons'

/** 编辑对象：身体姿势帧（48×48 槽位图）或武器图（32×32 自由配色） */
export type EditorMode = 'frame' | 'weapon' | 'mount'
export type Tool = 'pen' | 'eraser' | 'picker' | 'fill'

/**
 * 身体帧源图尺寸（sprites.ts 的 DEFAULT_*；渲染时 padSprite 补 SPRITE_PAD_LEFT 列留白 → 60×48）。
 * 栅格尺寸实际跟随载入的图（frameSize），这里只用于「空白」和渲染帧识别。
 */
export const SOURCE_W = DEFAULT_IDLE[0].length
export const SOURCE_H = DEFAULT_IDLE.length
/** 自适应测量失败时的兜底缩放 */
export const DEFAULT_ZOOM = 12
export const ZOOM_MIN = 4
export const ZOOM_MAX = 20
export const HISTORY_LIMIT = 100

/** 一步编辑的快照（画布 + 该步生效的调色板） */
export interface EditSnapshot {
    map: PixelMap
    palette: string[]
}

export const TOOLS: { id: Tool; label: string; key: string }[] = [
    { id: 'pen', label: '画笔', key: 'B' },
    { id: 'eraser', label: '橡皮', key: 'E' },
    { id: 'picker', label: '吸管', key: 'I' },
    { id: 'fill', label: '油漆桶', key: 'G' },
]

/** 身体帧槽位（palette.ts）。8 受击星光不在面板露出（旧帧里仍能正常渲染） */
export const FRAME_SLOT_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 9]
export const SLOT_LABELS: Record<number, string> = {
    0: '透明',
    1: '描边',
    2: '发色',
    3: '皮肤',
    4: '瞳色',
    5: '衣物',
    6: '装饰',
    7: '白',
    8: '受击星光',
    9: '金边',
}
export const SLOT_TIPS: Record<number, string> = {
    0: '透明 / 橡皮：涂上去就是擦掉（快捷键 0）',
    1: '描边：角色的深色轮廓（快捷键 1）',
    2: '发色：取自角色配色（快捷键 2）',
    3: '皮肤：手、脸（快捷键 3）',
    4: '瞳色：眼睛（快捷键 4）',
    5: '衣物：衣服主色（快捷键 5）',
    6: '装饰：腰带、鞋等点缀（快捷键 6）',
    7: '白：特效白（快捷键 7）',
    9: '金边：爆气光环（快捷键 9）',
}

/** 身体帧里「跟角色配色走」的槽位 → CHARACTER_COLORS 的字段（这几个槽位可以在编辑器里改色） */
export const SLOT_TO_COLOR_KEY: Record<number, keyof CharacterColors> = {
    2: 'hair',
    3: 'skin',
    4: 'eyes',
    5: 'accent',
    6: 'decoration',
}

/** 槽位兜底色：调色板缺某个槽位（旧页面热更等）时也不至于「涂上去看不见」 */
export const SLOT_FALLBACK_COLORS: Record<number, string> = {
    1: '#000000',
    2: '#555555',
    3: '#FFCC99',
    4: '#00A0FF',
    5: '#DDDDDD',
    6: '#888888',
    7: '#ffffff',
    8: '#ffd24a',
    9: '#ffd24a',
}

/**
 * 画布底板（透明区的棋盘）：换色系方便看对比度。
 * 前两个是编辑器自己的深浅棋盘；「游戏浅色底 / 深色底」对应对战画布（themes.css 的 --color-canvas-bg）。
 */
export const BACKDROP_PRESETS: { id: string; label: string; a: string; b: string }[] = [
    { id: 'dark', label: '深色棋盘', a: '#20242c', b: '#262b34' },
    { id: 'light', label: '浅色棋盘', a: '#dcdcdc', b: '#eaeaea' },
    { id: 'game-light', label: '游戏浅色底', a: '#ffffff', b: '#f2f2f2' },
    { id: 'game-dark', label: '游戏深色底', a: '#000000', b: '#0d0d0d' },
    { id: 'gray', label: '中灰', a: '#6f6f6f', b: '#7c7c7c' },
    { id: 'custom', label: '自定义', a: '#2b3a2b', b: '#334433' },
]
export const BACKDROP_STORAGE_KEY = 'dantiao:pixel-editor:backdrop'

export const EDITOR_STATE_KEY = 'dantiao:pixel-editor:state:v1'

export const CHARACTER_IDS = Object.keys(CHARACTER_COLORS).filter((id) => CHARACTER_SPRITE_MAP[id])
export const NAME_BY_ID: Record<string, string> = Object.fromEntries(OPPONENTS.map((o) => [o.id, o.name]))
export const WEAPON_NAME: Record<string, string> = Object.fromEntries(
    [...WEAPON_DB, ...STARTING_WEAPONS].map((w) => [w.id, w.name]),
)
/** 已画好美术的武器（可载入当底稿） */
export const WEAPON_IDS_WITH_ART = Object.entries(WEAPON_OVERLAYS)
    .filter(([, ov]) => ov.pixels.length > 0)
    .map(([id]) => id)

export const BUILTIN_FRAMES: { key: string; label: string; map: PixelMap }[] = [
    { key: 'idle', label: 'idle', map: DEFAULT_IDLE },
    { key: 'attack', label: 'attack', map: DEFAULT_ATTACK },
    { key: 'dodge', label: 'dodge', map: DEFAULT_DODGE },
    { key: 'parry', label: 'parry', map: DEFAULT_PARRY },
    { key: 'hit', label: 'hit', map: DEFAULT_HIT },
    { key: 'buff', label: 'buff', map: DEFAULT_BUFF },
]
