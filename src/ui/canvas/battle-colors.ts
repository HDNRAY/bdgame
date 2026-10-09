/**
 * 画布层颜色（Canvas 2D / PixiJS 只能拿真实色值，**读不到 CSS 变量**）。
 *
 * 分两类，别混：
 *
 * 1. **镜像 UI token**（`UI_COLOR_MIRROR`）：值与 themes.css 一一对应，
 *    有漂移测试盯着（`__tests__/battle-colors.test.ts` 断言它 == themes.css 的值）。
 *    能镜像就镜像 —— token 改了颜色，画布自动跟着走，不会再出现
 *    "CSS 改了、画布还是老色"这种漂移（第 1 步就踩过：改了 --color-p2，TS 里还是 #ff6b6b）。
 *
 * 2. **画布专用**（`CANVAS_COLORS`）：为了在战斗画布上可读而单独调过的色，
 *    没有对应的 UI 语义角色（飘字描边、暴击金、伤害红…），保持字面量并在此登记。
 *    以后要改就在这里改一处，不要再往各个渲染文件里散写字面量。
 *
 * 用法：DOM 内联样式直接写 `var(--color-p1)`（浏览器自己解析）；
 * 需要真实色值时（canvas / PixiJS）调 `resolveUiColor('var(--color-p1)', theme)`。
 */

/** 与 themes.css 逐值对应的 token 镜像（改 token 必须同步这里，测试会拦） */
export const UI_COLOR_MIRROR = {
    '--color-p1': { light: '#006b65', dark: '#18d2c7' },
    '--color-p2': { light: '#a72e73', dark: '#f072b3' },
    '--color-ap': { light: '#656204', dark: '#f3f056' },
} as const

export type MirroredToken = keyof typeof UI_COLOR_MIRROR

/**
 * 画布专用色。
 * - `neutral` / `action` / `evade` / `parry` / `defeat`：飘字的文字色，
 *   画布本身有描边与底色，这些值是按"画布上可读"调的，不跟 UI token 走。
 * - `crit` / `damage` / `dot` / `heal`：战斗飘字的语义色（暴击金 / 受伤红 / 持续伤害橙 / 回复青）。
 */
export const CANVAS_COLORS = {
    neutral: '#ffffff',
    action: '#ffffff',
    evade: '#ffffff',
    parry: '#ffffff',
    defeat: '#ff4444',
    crit: '#ffd700',
    damage: '#ff4444',
    dot: '#ff8844',
    heal: '#4ecdc4',
} as const

/** 像素美术的默认皮肤色（美术层兜底色，不是 UI 配色） */
export const PIXEL_SKIN_FALLBACK = '#f5d6c6'

/**
 * 把 `var(--color-x)` 解析成当前主题的真实色值；不是 var() 就原样返回。
 * canvas / PixiJS 路径必须在绘制前调一次（CSS 变量不能直接喂给 canvas）。
 */
export function resolveUiColor(value: string, theme: 'light' | 'dark'): string {
    const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim())
    if (!m) return value
    const entry = UI_COLOR_MIRROR[m[1] as MirroredToken]
    return entry ? entry[theme] : value
}
