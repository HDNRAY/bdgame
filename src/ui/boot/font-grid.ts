/**
 * 字号网格（像素字体的原生网格吸附）
 * ============================================================================
 *
 * 规则（用户定稿，见 AGENTS.md / docs 口径）：字号可以随视口与设置页的 `--ui-scale` 变化，
 * 但**最终写进 DOM 的计算值必须落在允许集**上：
 *
 *     允许字号 = { n × 10 } ∪ { n × 12 }   （n 为正整数）
 *             = 10, 12, 20, 24, 30, 36, 40, 48, 50, 60, …
 *
 * 理由：像素字体 `Fusion Pixel 10px` / `Fusion Pixel 12px` 分别按 10px / 12px 网格设计，
 * 只有**整数倍**渲染才锐利（1× 原生、2× 时每个源像素变 2×2 方块）。非整数倍会把像素切在
 * 非整数位置上，笔画不匀、发虚。
 *
 * 为什么不能靠纯 CSS 跳档（B 方案）：
 * 1. CSS 里没有「吸附到 {10n}∪{12n} 中最近的一个」这种运算（`round()` 只能取单个基数的倍数，
 *    两族取最近还要 `sign()` 拼条件，既不可读也不可单测）；
 * 2. **更致命的是根字号吸附解决不了问题**：字号令牌是根字号的 rem 分数（`0.625rem` / `0.75rem`…），
 *    根字号一旦不是 16px 的整数倍，`0.625rem` 就不再是 10 的整数倍（例：根字号 20px → 12.5px，
 *    既不是 10 的倍数也不是 12 的倍数，10px 字号照样发虚）。所以必须**先把字号算成 px，再吸附**。
 * 因此取 A 方案：JS 先算再吸附，把结果写进 `--font-unit-10` / `--font-unit-12`。
 *
 * 关键恒等式（本模块的数学内核）：
 * 设计基准 1rem = 16px 时，10 族 = 10px、12 族 = 12px，两族的比值 10:12 与令牌系数
 * 0.625:0.75 同源 —— 于是「两族各自就近吸附」等价于**同一个整数倍 k**：
 *
 *     10 族 = 10 × k      12 族 = 12 × k      k = 正整数
 *
 * 所以 `--font-lg`(2×12k) / `--font-title`(3×12k) / `--font-hero`(5×12k) 等全是整数倍，
 * 天然落在允许集里，且**正文字号永不小于徽章字号**（10k ≤ 12k）。
 *
 * 首帧：`applyFontUnits` 在 `main.tsx` 里**同步**调用（React 挂载与首帧之前，且首屏本来就有
 * 字体门遮罩），所以不存在闪一下再吸附的过程。
 * 抖动：吸附函数是 (视口宽, --ui-scale) 的纯函数，只在 `resize` 事件里重算，**不用定时器、不轮询**。
 */

/** 10px 字体族的原生网格 */
export const SMALL_FAMILY_UNIT = 10;
/** 12px 字体族的原生网格 */
export const BASE_FAMILY_UNIT = 12;
/** 允许集的两族网格 */
export const FONT_UNITS = [SMALL_FAMILY_UNIT, BASE_FAMILY_UNIT] as const;
export type FontUnit = (typeof FONT_UNITS)[number];

/** 写进 `<html>` 的两族「当前档」CSS 变量名（见 src/ui/styles/tokens.css） */
export const SMALL_UNIT_VAR = '--font-unit-10';
export const BASE_UNIT_VAR = '--font-unit-12';

/** 设计基准根字号：令牌集就是按 1rem = 16px 设计的 */
export const DESIGN_ROOT_PX = 16;
/** 视野补偿：与 src/index.css 的 `+ 0.15vw` 同源（1vw = 1% 视口宽） */
export const VIEWPORT_RATIO = 0.0015;
/** 根字号上下限：与 src/index.css 的 `clamp(12px, …, 48px)` 同源 */
export const ROOT_MIN_PX = 12;
export const ROOT_MAX_PX = 48;

/** 浮点容差：浏览器算出来的计算值可能是 11.999999 一类 */
const EPSILON = 1e-6;

/**
 * 「桌面口径」的媒体查询：宽屏 **或** 精细指针。
 * 与 src/ui/styles/tokens.css 的桌面规则**必须逐字一致** —— 那边用它换小字族的族与字号，
 * 这边用它判定"字号下限 12px + 族与字号匹配"。改一处就要改两处。
 */
export const DESKTOP_MEDIA_QUERY = '(min-width: 769px), (hover: hover) and (pointer: fine)';
/** 桌面端字号下限（移动端允许 10px） */
export const DESKTOP_MIN_FONT_PX = 12;

/** 元素用的哪个字族（只认像素字族；系统/回退字体算 other，不受"族与字号匹配"约束） */
export type FontFamilyClass = 'small' | 'base' | 'other';

/** 从 computed font-family 串判断字族（只看第一项，与 CSS 的 font-family 链语义一致） */
export function classifyFontFamily(familyCss: string): FontFamilyClass {
    const first = familyCss.split(',')[0]?.replace(/["']/g, '').trim() ?? '';
    if (first.includes('Fusion Pixel 10px')) return 'small';
    if (first.includes('Fusion Pixel 12px')) return 'base';
    return 'other';
}

/**
 * 一条文字元素是否合规：返回 null = 合规，否则返回违规原因。
 * 三类问题：不在允许集 / 桌面小于 12px / 族与字号不匹配（10 族只认 10n、12 族只认 12n）。
 * 浏览器断言（scripts/ui-geometry.mjs）用同一套口径（那边是 .mjs，无法 import TS，逐字镜像）。
 */
export function fontGridViolation(px: number, familyCss: string, desktop: boolean): string | null {
    if (!isAllowedFontSize(px)) return '不在允许集';
    if (desktop && px < DESKTOP_MIN_FONT_PX) return '桌面小于 12';
    const family = classifyFontFamily(familyCss);
    if (family === 'small' && !isOnGrid(px, SMALL_FAMILY_UNIT)) return '10 族字号不在 10n';
    if (family === 'base' && !isOnGrid(px, BASE_FAMILY_UNIT)) return '12 族字号不在 12n';
    return null;
}

/** 字号是否落在允许集 {10n} ∪ {12n}（n ≥ 1）里 */
export function isAllowedFontSize(px: number): boolean {
    return FONT_UNITS.some((unit) => isOnGrid(px, unit));
}

/** 字号是否落在这个字族的原生网格上（10 族只认 10 的倍数，12 族只认 12 的倍数） */
export function isOnGrid(px: number, unit: FontUnit): boolean {
    if (!Number.isFinite(px) || px <= 0) return false;
    return Math.abs(px / unit - Math.round(px / unit)) < EPSILON;
}

/**
 * 就近吸附到 `unit` 的整数倍。
 * - **正中间时取小**（Math.round 会取大）：宁可小半档，也不把版面撑破、不越出视口；
 * - **下限 1 倍**：允许集从 10 / 12 起，再小就出了网格且不可读（低于 1× 的像素字体会被
 *   次像素缩放，正是要避免的「发虚」）。
 */
export function snapToGrid(ideal: number, unit: FontUnit): number {
    if (!Number.isFinite(ideal)) return unit;
    const steps = Math.max(1, Math.ceil(ideal / unit - 0.5));
    return steps * unit;
}

/**
 * 理想根字号：`16px × --ui-scale + 0.15vw`，再按 index.css 的老口径 clamp 到 [12, 48]。
 * 它只用来**推**字号档，不直接写进 DOM（根字号仍是布局缩放载体，见 src/index.css 的说明）。
 */
export function idealRootPx(viewportWidth: number, uiScale: number): number {
    const width = Number.isFinite(viewportWidth) ? viewportWidth : 0;
    const scale = Number.isFinite(uiScale) ? uiScale : 1;
    const raw = DESIGN_ROOT_PX * scale + VIEWPORT_RATIO * width;
    return Math.min(ROOT_MAX_PX, Math.max(ROOT_MIN_PX, raw));
}

/**
 * 当前整数倍 k：10 族与 12 族的系数比值（0.625 : 0.75 = 10 : 12）与两个网格的比值相同，
 * 所以两族共用同一个 k —— 这才是「一次吸附、两族都在网格上」的充分条件。
 */
export function fontSteps(viewportWidth: number, uiScale: number): number {
    return Math.max(1, Math.ceil(idealRootPx(viewportWidth, uiScale) / DESIGN_ROOT_PX - 0.5));
}

export interface FontUnits {
    /** 视口与缩放推出来的理想根字号（仅供展示 / 调试，不写进 DOM） */
    readonly rootPx: number;
    /** 整数倍 k */
    readonly steps: number;
    /** 10px 字体族当前档（∈ 10n） */
    readonly small: number;
    /** 12px 字体族当前档（∈ 12n） */
    readonly base: number;
}

/** 由视口宽与 --ui-scale 解出两族当前档 */
export function resolveFontUnits(viewportWidth: number, uiScale: number): FontUnits {
    const rootPx = idealRootPx(viewportWidth, uiScale);
    const steps = Math.max(1, Math.ceil(rootPx / DESIGN_ROOT_PX - 0.5));
    return { rootPx, steps, small: SMALL_FAMILY_UNIT * steps, base: BASE_FAMILY_UNIT * steps };
}

/** 某族网格在 [min, max] 内的整数倍（升序）。给「用户手动缩放日志」一类控件枚举档位用。 */
export function gridSteps(unit: FontUnit, min: number, max: number): number[] {
    const out: number[] = [];
    for (let n = Math.max(1, Math.ceil(min / unit - EPSILON)); n * unit <= max + EPSILON; n++) {
        out.push(n * unit);
    }
    return out;
}

/** 把两族当前档写进 `<html>` 的内联样式（custom property，覆盖 tokens.css 的缺省值） */
export function applyFontUnits(doc: Document, uiScale: number): FontUnits {
    const width = doc.defaultView?.innerWidth ?? 0;
    const units = resolveFontUnits(width, uiScale);
    const style = doc.documentElement.style;
    style.setProperty(SMALL_UNIT_VAR, `${units.small}px`);
    style.setProperty(BASE_UNIT_VAR, `${units.base}px`);
    return units;
}

/**
 * 应用一次，并在 `resize` 时跟着重算（**不用定时器**）。
 * 返回解绑函数：App.tsx 的 effect 在 uiScale 变化时重装，拿到的是最新档。
 */
export function watchFontUnits(doc: Document, uiScale: number): () => void {
    const apply = () => {
        applyFontUnits(doc, uiScale);
    };
    apply();
    const win = doc.defaultView;
    win?.addEventListener('resize', apply);
    return () => win?.removeEventListener('resize', apply);
}
