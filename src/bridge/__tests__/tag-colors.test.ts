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
 * OKLab / WCAG 数学内联（约 30 行，零依赖）——与第 4 节口径一致，不引入 chroma-js。
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

// ── 徽章底色与门槛 ───────────────────────────────────────────────────────────

/** themes.css 里 --color-entity-bg 的实际值（两套主题） */
const BADGE_BG = { light: '#f2f2f5', dark: '#010102' } as const
const TEXT_THRESHOLD = 4.5

// ── 8 族色相带（docs 第 7 节 7.2）与「同族可分」判据 ─────────────────────────

/** 每个色位的族 + 色相 + 两套主题的 L（用于同族可分性检查） */
const SLOTS: Record<string, { fam: string; H: number; L: { light: number; dark: number } }> = {
    weaponA: { fam: 'weapon', H: 40, L: { light: 0.5, dark: 0.76 } },
    weaponB: { fam: 'weapon', H: 70, L: { light: 0.5, dark: 0.76 } },
    dmgA: { fam: 'dmg', H: 95, L: { light: 0.5, dark: 0.76 } },
    dmgB: { fam: 'dmg', H: 120, L: { light: 0.5, dark: 0.76 } },
    dmgC: { fam: 'dmg', H: 145, L: { light: 0.5, dark: 0.76 } },
    heal: { fam: 'recover', H: 150, L: { light: 0.5, dark: 0.76 } },
    qiA: { fam: 'qi', H: 185, L: { light: 0.35, dark: 0.56 } },
    qiB: { fam: 'qi', H: 210, L: { light: 0.35, dark: 0.57 } },
    poison: { fam: 'debuff', H: 160, L: { light: 0.35, dark: 0.56 } },
    evaA: { fam: 'eva', H: 235, L: { light: 0.5, dark: 0.76 } },
    evaB: { fam: 'eva', H: 260, L: { light: 0.5, dark: 0.76 } },
    defA: { fam: 'def', H: 285, L: { light: 0.5, dark: 0.76 } },
    defB: { fam: 'def', H: 310, L: { light: 0.5, dark: 0.76 } },
    mech: { fam: 'mech', H: 335, L: { light: 0.5, dark: 0.76 } },
}

/** 每族允许的色相带（含端点的闭区间；带与带之间不重叠） */
const FAMILY_BANDS: Record<string, [number, number]> = {
    weapon: [40, 70],
    dmg: [95, 145],
    recover: [150, 150],
    qi: [185, 210],
    debuff: [160, 160],
    eva: [235, 260],
    def: [285, 310],
    mech: [335, 335],
}

const HUE_MIN_GAP = 25
const L_MIN_GAP = 0.15

function hexesOf(theme: 'light' | 'dark'): Record<string, string> {
    return Object.fromEntries(Object.entries(TAG_COLOR).map(([tag, pair]) => [tag, pair[theme]]))
}

// ── themes.css 解析（token 唯一事实来源） ────────────────────────────────────

function themesCss(): string {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    return fs.readFileSync(path.join(dir, '..', '..', 'ui', 'styles', 'themes.css'), 'utf8')
}

/** 抽某个主题块里的 --tag-color-<tag> → 值 */
function cssTagColors(theme: 'light' | 'dark'): Record<string, string> {
    const css = themesCss().replace(/\/\*[\s\S]*?\*\//g, '')
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    const out: Record<string, string> = {}
    for (const b of blocks) {
        const sel = b[1]
        const isDark = /\[data-theme=['"]dark['"]\]/.test(sel)
        const isLight = /\[data-theme=['"]light['"]\]/.test(sel) || /:root/.test(sel)
        if (theme === 'dark' ? !isDark : !isLight) continue
        for (const m of b[2].matchAll(/(--tag-color-[a-z_]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
    }
    return out
}

const tagNames = Object.keys(TAG_COLOR) as Tag[]

// tag → 色位（与 tagDisplay.ts 的分组一致；测试内单独维护，避免把实现细节导出到生产代码）
const SLOT_OF: Record<Tag, string> = {
    unarmed: 'weaponA',
    one_handed: 'weaponA',
    weapon: 'weaponA',
    thrown: 'weaponA',
    blunt: 'weaponB',
    melee: 'weaponB',
    two_handed: 'weaponB',
    pierce: 'weaponB',
    polearm: 'weaponB',
    heavy: 'weaponB',
    slash: 'dmgA',
    bleed: 'dmgA',
    self_damage: 'dmgA',
    burn: 'dmgB',
    low_hp: 'dmgB',
    knockdown: 'dmgB',
    knockback: 'dmgC',
    bonus_damage: 'dmgC',
    electric: 'dmgC',
    heal: 'heal',
    buff: 'heal',
    cleanse: 'heal',
    pre_action: 'heal',
    qi: 'qiA',
    qi_action: 'qiB',
    chan: 'qiB',
    poison: 'poison',
    paralyze: 'poison',
    stun: 'poison',
    debuff: 'poison',
    move: 'evaA',
    sand_blind: 'evaA',
    frost: 'evaB',
    parry: 'defA',
    heavy_reduce: 'defA',
    ignore_parry: 'defA',
    defense: 'defB',
    super_armor: 'defB',
    counter: 'defB',
    inherent: 'mech',
    internal: 'mech',
    implant: 'mech',
    jiu: 'mech',
    talent: 'mech',
    trigger: 'mech',
    summon: 'mech',
    stance: 'mech',
    craft: 'mech',
    imperial: 'mech',
    retrieve_weapon: 'mech',
    post_action: 'mech',
    range: 'mech',
    range_up: 'mech',
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
                    failures.push(
                        `${theme} ${tag}: ${hexes[tag]} on ${BADGE_BG[theme]} = ${ratio.toFixed(2)} < ${TEXT_THRESHOLD}`,
                    )
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
        const byFam: Record<string, string[]> = {}
        for (const tag of tagNames) {
            const slot = SLOT_OF[tag]
            ;(byFam[SLOTS[slot].fam] ??= []).push(slot)
        }
        for (const [fam, list] of Object.entries(byFam)) {
            const uniq = [...new Set(list)]
            for (let i = 0; i < uniq.length; i++)
                for (let j = i + 1; j < uniq.length; j++) {
                    const a = SLOTS[uniq[i]]
                    const b = SLOTS[uniq[j]]
                    const raw = Math.abs(a.H - b.H)
                    const dH = Math.min(raw, 360 - raw)
                    const dLl = Math.abs(a.L.light - b.L.light)
                    const dLd = Math.abs(a.L.dark - b.L.dark)
                    if (dH < HUE_MIN_GAP && !(dLl >= L_MIN_GAP && dLd >= L_MIN_GAP)) {
                        failures.push(
                            `${fam} ${uniq[i]}(H${a.H}) vs ${uniq[j]}(H${b.H}) ΔH=${dH} ΔL亮=${dLl.toFixed(2)} ΔL暗=${dLd.toFixed(2)}`,
                        )
                    }
                }
        }
        expect(failures, failures.join('\n')).toEqual([])
    })

    it('每个色位都落在自己族的色相带内', () => {
        const failures: string[] = []
        for (const [slot, def] of Object.entries(SLOTS)) {
            const band = FAMILY_BANDS[def.fam]
            if (!band) {
                failures.push(`${slot}: 族 ${def.fam} 没有声明的色相带`)
                continue
            }
            if (def.H < band[0] || def.H > band[1]) failures.push(`${slot} H${def.H} 不在 ${def.fam} 带 [${band}]`)
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

    it('用户口径：heal 是浅绿、poison 是深绿（同绿带，ΔL ≥ 0.15）', () => {
        const heal = TAG_COLOR.heal
        const poison = TAG_COLOR.poison
        for (const theme of ['light', 'dark'] as const) {
            const lh = oklch(heal[theme])
            const lp = oklch(poison[theme])
            // 都在绿带（H 120~200）
            expect(lh.H, `${theme} heal 应在绿带，实测 H${lh.H.toFixed(0)}`).toBeGreaterThan(120)
            expect(lh.H, `${theme} heal 应在绿带，实测 H${lh.H.toFixed(0)}`).toBeLessThan(200)
            expect(lp.H, `${theme} poison 应在绿带，实测 H${lp.H.toFixed(0)}`).toBeGreaterThan(120)
            expect(lp.H, `${theme} poison 应在绿带，实测 H${lp.H.toFixed(0)}`).toBeLessThan(200)
            // poison 更深 + ΔL ≥ 0.15
            expect(lp.L, `${theme} poison 应比 heal 深`).toBeLessThan(lh.L)
            expect(
                lh.L - lp.L,
                `${theme} heal/poison ΔL = ${(lh.L - lp.L).toFixed(2)}（要求 ≥ 0.15）`,
            ).toBeGreaterThanOrEqual(L_MIN_GAP)
        }
    })
})
