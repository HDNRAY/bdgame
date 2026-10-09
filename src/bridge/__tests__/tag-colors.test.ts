/**
 * 标签徽章配色不变量（对应 docs/ui-color-system.md 第 7 节）。
 *
 * 徽章结构（Tag.scss）：文字与 1px 描边同色，底是 `--color-entity-bg`
 * （= 亮 #f2f2f5 / 暗 #010102，见 themes.css）。所以唯一要守的是
 * 「标签色 × 两套主题的徽章底 ≥ 4.5:1」。
 *
 * 颜色定义在 themes.css 的 `--tag-color-<tag>`（两套主题各一套），
 * `TAG_COLOR` 是同一份值的 TS 镜像；两边必须逐条一致（本文件会校验）。
 *
 * ── 归类判据（docs 7.2，新增标签按此归属）────────────────────────────────────
 *   1. 技法 / 流派身份（"怎么打"）          → 武器流派族（低彩度 0.055 冷色）
 *   2. 对目标造成的效果（"造成什么"）        → 伤害进攻族（红→橙）/ 持续伤害族（深绿）
 *   3. 影响规则本身（时机 / 射程 / 特性…）    → 机制规则族（低彩度青灰）
 *   4. 资源（内息 / 缠劲）                  → 内息资源族（青）
 *   5. 增益 / 恢复                          → 增益恢复族（绿）
 *   6. 被控 / 感官压制                      → 控制族（**灰**，C ≤ 0.02，靠明度分档）
 *   7. 防御动作                            → 防御格挡族
 *   8. 单标签特例                          → 雷（蓝）/ 酒（棕）各自成族
 *
 * OKLab / WCAG 数学内联（约 30 行，零依赖）——与文档第 4 节口径一致，不引入 chroma-js。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { TAG_COLOR } from '../tagDisplay'
import type { Tag } from '../../engine/entities/tag'

// ── OKLCH / WCAG（内联） ─────────────────────────────────────────────────────

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function parseHex(hex: string): [number, number, number] {
    const h = hex.trim().replace(/^#/, '')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

function relativeLuminance(hex: string): number {
    const [r, g, b] = parseHex(hex).map(srgbToLinear)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 对比度（1 ~ 21） */
export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

/** sRGB → OKLCH（L / C / H） */
export function oklch(hex: string): { L: number; C: number; H: number } {
    const [r, g, b] = parseHex(hex).map(srgbToLinear)
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

// ── 门槛 ─────────────────────────────────────────────────────────────────────

const BADGE_BG = { light: '#f2f2f5', dark: '#010102' } as const
const TEXT_THRESHOLD = 4.5
const HUE_MIN_GAP = 25
const L_MIN_GAP = 0.15
/** hex 量化会让实测 L 有 ±0.004 的抖动，判定 ΔL 时留这点余量 */
const L_EPS = 0.005
/** 色相环上的最短夹角 */
const hueGap = (a: number, b: number) => {
    const d = Math.abs(a - b)
    return Math.min(d, 360 - d)
}

// ── 族 / 色位（与 tagDisplay.ts、docs 7.2 一致） ─────────────────────────────

interface Slot {
    id: string
    fam: string
    H: number
}
const SLOTS: Record<string, Slot> = {
    bleed: { id: 'bleed', fam: 'sustain', H: 25 },
    burn: { id: 'burn', fam: 'sustain', H: 65 },
    poison: { id: 'poison', fam: 'sustain', H: 135 },
    dmgBonus: { id: 'dmgBonus', fam: 'dmg', H: 12 },
    dmgLow: { id: 'dmgLow', fam: 'dmg', H: 48 },
    paralyze: { id: 'paralyze', fam: 'paralyze', H: 88 },
    ctrlMid: { id: 'ctrlMid', fam: 'control', H: 155 },
    ctrlDeep: { id: 'ctrlDeep', fam: 'control', H: 155 },
    mech: { id: 'mech', fam: 'mech', H: 110 },
    jiu: { id: 'jiu', fam: 'jiu', H: 75 },
    recover: { id: 'recover', fam: 'recover', H: 180 },
    weapA: { id: 'weapA', fam: 'weapon', H: 205 },
    weapB: { id: 'weapB', fam: 'weapon', H: 230 },
    frost: { id: 'frost', fam: 'frost', H: 245 },
    electric: { id: 'electric', fam: 'electric', H: 260 },
    qiDeep: { id: 'qiDeep', fam: 'qi', H: 285 },
    qiMid: { id: 'qiMid', fam: 'qi', H: 285 },
    eva: { id: 'eva', fam: 'eva', H: 310 },
    defA: { id: 'defA', fam: 'def', H: 335 },
    defB: { id: 'defB', fam: 'def', H: 0 },
}

const SLOT_OF: Record<Tag, string> = {
    bleed: 'bleed',
    burn: 'burn',
    bonus_damage: 'dmgBonus',
    self_damage: 'dmgBonus',
    low_hp: 'dmgLow',
    jiu: 'jiu',
    slash: 'weapA',
    unarmed: 'weapA',
    one_handed: 'weapA',
    weapon: 'weapA',
    thrown: 'weapA',
    blunt: 'weapB',
    melee: 'weapB',
    two_handed: 'weapB',
    pierce: 'weapB',
    polearm: 'weapB',
    heavy: 'weapB',
    range: 'weapB',
    imperial: 'weapB',
    heal: 'recover',
    buff: 'recover',
    cleanse: 'recover',
    stun: 'ctrlMid',
    debuff: 'ctrlMid',
    sand_blind: 'ctrlMid',
    knockback: 'ctrlDeep',
    knockdown: 'ctrlDeep',
    poison: 'poison',
    paralyze: 'paralyze',
    frost: 'frost',
    qi: 'qiDeep',
    qi_action: 'qiMid',
    chan: 'qiMid',
    inherent: 'mech',
    internal: 'mech',
    implant: 'mech',
    talent: 'mech',
    trigger: 'mech',
    summon: 'mech',
    stance: 'mech',
    craft: 'mech',
    retrieve_weapon: 'mech',
    post_action: 'mech',
    range_up: 'mech',
    pre_action: 'mech',
    electric: 'electric',
    move: 'eva',
    parry: 'defA',
    heavy_reduce: 'defA',
    ignore_parry: 'defA',
    defense: 'defB',
    super_armor: 'defB',
    counter: 'defB',
}

const tagNames = Object.keys(TAG_COLOR) as Tag[]

function hexesOf(theme: 'light' | 'dark'): Record<string, string> {
    return Object.fromEntries(Object.entries(TAG_COLOR).map(([tag, pair]) => [tag, pair[theme]]))
}

// ── themes.css 解析（token 唯一事实来源） ────────────────────────────────────

function themesCss(): string {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    return fs.readFileSync(path.join(dir, '..', '..', 'ui', 'styles', 'themes.css'), 'utf8')
}

function cssTagColors(theme: 'light' | 'dark'): Record<string, string> {
    const css = themesCss().replace(/\/\*[\s\S]*?\*\//g, '')
    const out: Record<string, string> = {}
    for (const b of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = b[1]
        const isDark = /\[data-theme=['"]dark['"]\]/.test(sel)
        const isLight = /\[data-theme=['"]light['"]\]/.test(sel) || /:root/.test(sel)
        if (theme === 'dark' ? !isDark : !isLight) continue
        for (const m of b[2].matchAll(/(--tag-color-[a-z_]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
    }
    return out
}

// ── 断言 ─────────────────────────────────────────────────────────────────────

describe('标签徽章配色（docs/ui-color-system.md 第 7 节）', () => {
    it('两套主题的每一条标签色都对徽章底 ≥ 4.5', () => {
        const failures: string[] = []
        for (const theme of ['light', 'dark'] as const) {
            const hexes = hexesOf(theme)
            for (const tag of tagNames) {
                const ratio = contrastRatio(hexes[tag], BADGE_BG[theme])
                if (ratio < TEXT_THRESHOLD) {
                    failures.push(`${theme} ${tag}: ${hexes[tag]} on ${BADGE_BG[theme]} = ${ratio.toFixed(2)} < ${TEXT_THRESHOLD}`)
                }
            }
        }
        expect(failures, failures.join('\n')).toEqual([])
    })

    it('两套主题的色值必须不同（挡住「共用霓虹色」这类回归）', () => {
        const same = tagNames.filter((t) => TAG_COLOR[t].light === TAG_COLOR[t].dark)
        expect(same, same.join(', ')).toEqual([])
    })

    it('同族内任意两色位可分（ΔL ≥ 0.15 或 ΔH ≥ 25°）', () => {
        const failures: string[] = []
        // 每个色位取它的代表 tag（同色位同色）
        const reprOf: Record<string, Tag> = {}
        for (const tag of tagNames) reprOf[SLOT_OF[tag]] ??= tag
        for (const theme of ['light', 'dark'] as const) {
            const hexes = hexesOf(theme)
            const byFam: Record<string, string[]> = {}
            for (const tag of tagNames) (byFam[SLOTS[SLOT_OF[tag]].fam] ??= []).push(SLOT_OF[tag])
            for (const [fam, list] of Object.entries(byFam)) {
                const uniq = [...new Set(list)]
                for (let i = 0; i < uniq.length; i++)
                    for (let j = i + 1; j < uniq.length; j++) {
                        const a = SLOTS[uniq[i]]
                        const b = SLOTS[uniq[j]]
                        const dH = hueGap(a.H, b.H)
                        const dL = Math.abs(oklch(hexes[reprOf[uniq[i]]]).L - oklch(hexes[reprOf[uniq[j]]]).L)
                        if (dH < HUE_MIN_GAP && dL < L_MIN_GAP - L_EPS) {
                            failures.push(`${theme} ${fam} ${uniq[i]}(H${a.H}) vs ${uniq[j]}(H${b.H}) ΔH=${dH} ΔL=${dL.toFixed(2)}`)
                        }
                    }
            }
        }
        expect(failures, failures.join('\n')).toEqual([])
    })

    it('themes.css 里每条标签 token 都存在，且与 TAG_COLOR 逐条一致', () => {
        for (const theme of ['light', 'dark'] as const) {
            const css = cssTagColors(theme)
            const tsHexes = hexesOf(theme)
            const missing = tagNames.filter((t) => !(`--tag-color-${t}` in css))
            expect(missing, `${theme} 缺 token：${missing.join(', ')}`).toEqual([])
            const mismatched = tagNames.filter((t) => css[`--tag-color-${t}`] !== tsHexes[t])
            expect(
                mismatched,
                `${theme} 值与 TAG_COLOR 不一致：${mismatched.map((t) => `${t} css=${css[`--tag-color-${t}`]} ts=${tsHexes[t]}`).join('; ')}`,
            ).toEqual([])
        }
    })

    // ── 用户逐条校准的口径（一条一个断言，变异时能精确指出是哪条） ───────────

    it('用户口径①：雷（electric）是蓝色', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C } = oklch(TAG_COLOR.electric[theme])
            expect(H, `${theme} electric H=${H.toFixed(0)} 应在蓝带 245~285`).toBeGreaterThanOrEqual(245)
            expect(H, `${theme} electric H=${H.toFixed(0)} 应在蓝带 245~285`).toBeLessThanOrEqual(285)
            expect(C, `${theme} electric C=${C.toFixed(3)} 应是有彩度的蓝`).toBeGreaterThan(0.05)
        }
    })

    it('用户口径②：流血（bleed）是红色', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C } = oklch(TAG_COLOR.bleed[theme])
            expect(H >= 350 || H <= 40, `${theme} bleed H=${H.toFixed(0)} 应为红色（350~40）`).toBe(true)
            expect(C, `${theme} bleed C=${C.toFixed(3)} 应是高彩度红`).toBeGreaterThan(0.08)
        }
    })

    it('用户口径③：控制 / 感官类 debuff 是灰色（彩度 ≤ 0.02）', () => {
        const controlled: Tag[] = ['stun', 'debuff', 'sand_blind', 'knockdown', 'knockback']
        for (const theme of ['light', 'dark'] as const) {
            for (const t of controlled) {
                const { C } = oklch(TAG_COLOR[t][theme])
                expect(C, `${theme} ${t} 应为灰（C=${C.toFixed(3)} ≤ 0.02）`).toBeLessThanOrEqual(0.02)
            }
            expect(oklch(TAG_COLOR.bleed[theme]).C, `${theme} bleed 不该是灰`).toBeGreaterThan(0.05)
            expect(oklch(TAG_COLOR.poison[theme]).C, `${theme} poison 不该是灰`).toBeGreaterThan(0.04)
        }
    })

    it('用户口径④：酒（jiu）是棕色（暖色 + 低明度）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, L, C } = oklch(TAG_COLOR.jiu[theme])
            expect(H, `${theme} jiu H=${H.toFixed(0)} 应在暖棕带 55~115`).toBeGreaterThanOrEqual(55)
            expect(H, `${theme} jiu H=${H.toFixed(0)} 应在暖棕带 55~115`).toBeLessThanOrEqual(115)
            expect(C, `${theme} jiu C=${C.toFixed(3)} 应是低彩度棕`).toBeLessThan(0.09)
            // 棕 = 暖色相 + 低彩度 + 比同带的其他色位更暗（暗色主题的深档下限是 0.58，
            // 再暗就压不过 #010102 的 4.5:1，所以这里只要求"不亮于基准档"）
            expect(L, `${theme} jiu L=${L.toFixed(2)} 应不亮于基准档`).toBeLessThanOrEqual(0.78)
            // 棕的判据是「暖色相 + 低彩度」，不是单看 L：暗色主题的深档下限受对比度约束，
            // 只能到 0.62（再暗就压不过 #010102 的 4.5:1）。与同族无关的暖色对比不作要求。
        }
    })

    it('用户口径⑤：劈砍 / 戳刺 / 钝击 / 远程等「怎么打」的标签属于流派族，且低彩度', () => {
        const styles: Tag[] = ['slash', 'pierce', 'blunt', 'unarmed', 'melee', 'polearm', 'heavy', 'thrown', 'range', 'imperial', 'one_handed', 'two_handed', 'weapon']
        for (const t of styles) expect(SLOTS[SLOT_OF[t]].fam, `${t} 应属 weapon 族`).toBe('weapon')
        for (const theme of ['light', 'dark'] as const) {
            for (const t of styles) {
                const { C } = oklch(TAG_COLOR[t][theme])
                expect(C, `${theme} ${t} 应是低彩度（C=${C.toFixed(3)} ≤ 0.07）`).toBeLessThanOrEqual(0.07)
            }
        }
    })

    it('用户口径⑥：前置（pre_action）属于机制族，远程（range）属于流派族', () => {
        expect(SLOTS[SLOT_OF.pre_action].fam, 'pre_action 应属 mech 族').toBe('mech')
        expect(SLOTS[SLOT_OF.range].fam, 'range 应属 weapon 族').toBe('weapon')
    })

    it('用户口径⑦：控制（灰）与失血（红）/ 中毒（绿）在彩度上明确分开', () => {
        const red = oklch(TAG_COLOR.bleed.light)
        const green = oklch(TAG_COLOR.poison.light)
        const gray = oklch(TAG_COLOR.stun.light)
        expect(gray.C, '控制应明显低于失血的彩度').toBeLessThan(red.C / 4)
        expect(gray.C, '控制应明显低于中毒的彩度').toBeLessThan(green.C / 3)
    })

    it('用户口径⑧：heal 浅绿 / poison 深绿（同绿带，ΔL ≥ 0.15）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const lh = oklch(TAG_COLOR.heal[theme])
            const lp = oklch(TAG_COLOR.poison[theme])
            for (const [nm, o] of [['heal', lh], ['poison', lp]] as const) {
                expect(o.H, `${theme} ${nm} 应在绿带 120~200，实测 H${o.H.toFixed(0)}`).toBeGreaterThan(120)
                expect(o.H, `${theme} ${nm} 应在绿带 120~200，实测 H${o.H.toFixed(0)}`).toBeLessThan(200)
            }
            expect(lp.L, `${theme} poison 应比 heal 深`).toBeLessThan(lh.L)
            expect(lh.L - lp.L, `${theme} heal/poison ΔL = ${(lh.L - lp.L).toFixed(2)}（要求 ≥ 0.15）`).toBeGreaterThanOrEqual(L_MIN_GAP - L_EPS)
        }
    })

    // ── 第十二 ~ 十四条（用户新增三条） ─────────────────────────────────────

    it('用户口径⑨：霜冻是极低彩度冰感色（暗色主题接近白，亮色主题只能是灰蓝）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C, L } = oklch(TAG_COLOR.frost[theme])
            expect(C, `${theme} frost C=${C.toFixed(3)} 应是低彩度蓝白（≤ 0.06）`).toBeLessThanOrEqual(0.06)
            // 仍须显著低于强调色与流派族同带的彩度（强调色 accent C≈0.083、流派 C=0.055）
            expect(C, `${theme} frost C=${C.toFixed(3)} 应低于 accent 的 0.083`).toBeLessThan(0.083)
            expect(H, `${theme} frost H=${H.toFixed(0)} 应在冷蓝带 225~258`).toBeGreaterThanOrEqual(225)
            expect(H, `${theme} frost H=${H.toFixed(0)} 应在冷蓝带 225~258`).toBeLessThanOrEqual(258)
            void L
        }
        // 「偏白」在暗色主题成立（高明度）；亮色主题受对比度硬约束，只能是中等明度的灰蓝
        const darkL = oklch(TAG_COLOR.frost.dark).L
        const lightL = oklch(TAG_COLOR.frost.light).L
        expect(darkL, `暗色主题 frost L=${darkL.toFixed(2)} 应接近白（≥0.78）`).toBeGreaterThanOrEqual(0.78)
        expect(lightL, `亮色主题 frost L=${lightL.toFixed(2)} 只能是中等明度（≤0.55）`).toBeLessThanOrEqual(0.55)
        expect(darkL - lightL, '两套主题的 L 必须拉开').toBeGreaterThan(0.15)
    })

    it('用户口径⑩：麻痹是偏黄的（黄 / 土黄带，且不在控制灰组里）', () => {
        expect(SLOTS[SLOT_OF.paralyze].fam, 'paralyze 应自成一族（不在控制灰组）').toBe('paralyze')
        for (const theme of ['light', 'dark'] as const) {
            const { H, C } = oklch(TAG_COLOR.paralyze[theme])
            expect(H, `${theme} paralyze H=${H.toFixed(0)} 应在黄 / 土黄带 40~90`).toBeGreaterThanOrEqual(40)
            expect(H, `${theme} paralyze H=${H.toFixed(0)} 应在黄 / 土黄带 40~90`).toBeLessThanOrEqual(90)
            expect(C, `${theme} paralyze C=${C.toFixed(3)} 应有明确的黄（≥0.04）`).toBeGreaterThan(0.04)
        }
        // 与控制灰的彩度差
        expect(oklch(TAG_COLOR.paralyze.light).C).toBeGreaterThan(oklch(TAG_COLOR.stun.light).C * 3)
    })

    it('用户口径⑪：流血 / 灼烧 / 中毒同属持续伤害族，且血红 ≠ 火红（同族可分）', () => {
        for (const t of ['bleed', 'burn', 'poison'] as Tag[]) {
            expect(SLOTS[SLOT_OF[t]].fam, `${t} 应属 sustain 族`).toBe('sustain')
        }
        const dH = hueGap(SLOTS[SLOT_OF.bleed].H, SLOTS[SLOT_OF.burn].H)
        const dLl = Math.abs(oklch(TAG_COLOR.bleed.light).L - oklch(TAG_COLOR.burn.light).L)
        const dLd = Math.abs(oklch(TAG_COLOR.bleed.dark).L - oklch(TAG_COLOR.burn.dark).L)
        expect(dH >= HUE_MIN_GAP || (dLl >= L_MIN_GAP && dLd >= L_MIN_GAP), `bleed/burn ΔH=${dH} ΔL亮=${dLl.toFixed(2)} ΔL暗=${dLd.toFixed(2)}`).toBe(true)
        // 第十五条口径：流血 = 大红（正红，H≈25~30）；灼烧 = 火红（红偏黄，H≈45~60）
        const hb = oklch(TAG_COLOR.bleed.light).H
        const hr = oklch(TAG_COLOR.burn.light).H
        expect(hb, `bleed H=${hb.toFixed(0)} 应是大红 / 正红（20~40）`).toBeGreaterThanOrEqual(20)
        expect(hb, `bleed H=${hb.toFixed(0)} 应是大红 / 正红（20~40）`).toBeLessThanOrEqual(40)
        expect(hr, `burn H=${hr.toFixed(0)} 应是火红（红偏黄，45~75）`).toBeGreaterThanOrEqual(45)
        expect(hr, `burn H=${hr.toFixed(0)} 应是火红（红偏黄，45~75）`).toBeLessThanOrEqual(75)
        expect(hueGap(hb, hr), '火红必须比大红更偏黄').toBeGreaterThanOrEqual(20)
        // 中毒仍是深绿，与两个红都不同带
        const hp = oklch(TAG_COLOR.poison.light).H
        expect(hueGap(hp, hb), `poison(${hp.toFixed(0)}) 与 bleed 应不同带`).toBeGreaterThanOrEqual(90)
    })

    // ── 第十五条：六条色相方向校准 ─────────────────────────────────────────

    it('用户口径⑫：流血是大红（正红，H≈25~30，高彩度）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C } = oklch(TAG_COLOR.bleed[theme])
            expect(H, `${theme} bleed H=${H.toFixed(0)} 应是大红 / 正红（20~40）`).toBeGreaterThanOrEqual(20)
            expect(H, `${theme} bleed H=${H.toFixed(0)} 应是大红 / 正红（20~40）`).toBeLessThanOrEqual(40)
            expect(C, `${theme} bleed C=${C.toFixed(3)} 应是高彩度大红`).toBeGreaterThan(0.1)
        }
    })

    it('用户口径⑬：灼烧是火红（比流血更偏黄，H 至少高 20°）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const hb = oklch(TAG_COLOR.bleed[theme]).H
            const { H, C } = oklch(TAG_COLOR.burn[theme])
            expect(H, `${theme} burn H=${H.toFixed(0)} 应是火红（红偏黄，45~62）`).toBeGreaterThanOrEqual(45)
            expect(H, `${theme} burn H=${H.toFixed(0)} 应是火红（红偏黄，45~66）`).toBeLessThanOrEqual(66)
            expect(hueGap(hb, H), `${theme} 火红必须比大红更偏黄（ΔH=${hueGap(hb, H).toFixed(0)}）`).toBeGreaterThanOrEqual(20)
            expect(C, `${theme} burn C=${C.toFixed(3)} 应是高彩度`).toBeGreaterThan(0.08)
            // 火红必须留在"红偏黄"，不能滑进黄区（黄区是麻痹金黄 H88）
            const hp = oklch(TAG_COLOR.paralyze[theme]).H
            expect(hueGap(H, hp), `${theme} 火红与金黄麻痹必须分开（ΔH=${hueGap(H, hp).toFixed(0)}）`).toBeGreaterThanOrEqual(20)
        }
    })

    it('用户口径⑭：麻痹是金黄（H≈80~95）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C } = oklch(TAG_COLOR.paralyze[theme])
            expect(H, `${theme} paralyze H=${H.toFixed(0)} 应在金黄带 75~100`).toBeGreaterThanOrEqual(75)
            expect(H, `${theme} paralyze H=${H.toFixed(0)} 应在金黄带 75~100`).toBeLessThanOrEqual(100)
            expect(C, `${theme} paralyze C=${C.toFixed(3)} 应是明确的金黄（≥0.06）`).toBeGreaterThan(0.06)
        }
    })

    it('用户口径⑮：霜冻是蓝白（C 放宽到 ≤0.06，但色相明确偏蓝）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C, L } = oklch(TAG_COLOR.frost[theme])
            expect(H, `${theme} frost H=${H.toFixed(0)} 应明确偏蓝（225~258）`).toBeGreaterThanOrEqual(225)
            expect(H, `${theme} frost H=${H.toFixed(0)} 应明确偏蓝（225~258）`).toBeLessThanOrEqual(258)
            expect(C, `${theme} frost C=${C.toFixed(3)} 应是低彩度蓝白（0.03~0.06）`).toBeGreaterThanOrEqual(0.03)
            expect(C, `${theme} frost C=${C.toFixed(3)} 应低于 accent 的 0.083`).toBeLessThan(0.083)
            // 与雷电亮蓝的区分：霜冻彩度明显更低
            expect(C, `${theme} frost 应比 electric 低彩度`).toBeLessThan(oklch(TAG_COLOR.electric[theme]).C / 2)
            void L
        }
    })

    it('用户口径⑯：雷电是亮蓝（正蓝 H≈240~280，暗色主题高明度）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C } = oklch(TAG_COLOR.electric[theme])
            expect(H, `${theme} electric H=${H.toFixed(0)} 应是正蓝（250~272）`).toBeGreaterThanOrEqual(250)
            expect(H, `${theme} electric H=${H.toFixed(0)} 应是正蓝（250~272）`).toBeLessThanOrEqual(272)
            expect(C, `${theme} electric C=${C.toFixed(3)} 应是高彩度亮蓝`).toBeGreaterThan(0.1)
        }
        expect(oklch(TAG_COLOR.electric.dark).L, '暗色主题的雷应是高明度（≥0.75）').toBeGreaterThanOrEqual(0.75)
    })

    it('用户口径⑰：残血比原来的暖色位更偏红（H < 60）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const { H, C } = oklch(TAG_COLOR.low_hp[theme])
            expect(H, `${theme} low_hp H=${H.toFixed(0)} 应往红方向（30~55）`).toBeGreaterThanOrEqual(30)
            expect(H, `${theme} low_hp H=${H.toFixed(0)} 应往红方向（30~55）`).toBeLessThanOrEqual(55)
            expect(C, `${theme} low_hp C=${C.toFixed(3)} 应保持高彩度`).toBeGreaterThan(0.08)
        }
    })

    it('灰 debuff 与低彩度流派族可区分（灰更中性、流派仍有色相）', () => {
        for (const theme of ['light', 'dark'] as const) {
            const grayC = oklch(TAG_COLOR.stun[theme]).C
            const styleC = oklch(TAG_COLOR.slash[theme]).C
            expect(grayC, `${theme} 控制灰 C=${grayC.toFixed(3)} 应低于流派主色 C=${styleC.toFixed(3)}`).toBeLessThan(styleC)
            expect(styleC, `${theme} 流派族应保留彩度（> 0.03）`).toBeGreaterThan(0.03)
        }
    })
})
