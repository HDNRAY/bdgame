/**
 * 画布色镜像的漂移守卫。
 *
 * `src/ui/canvas/battle-colors.ts` 的 `UI_COLOR_MIRROR` 是 themes.css 的 **TS 镜像**
 * —— canvas / PixiJS 读不到 CSS 变量，只能拿真实色值，所以必须留一份。
 * 留一份的代价是"两处会漂移"（改了 themes.css 忘了改这里），本测试就是拦这个的：
 * 逐条断言镜像值 == themes.css 解析出来的值。
 *
 * 解析方式与 `src/bridge/__tests__/tag-colors.test.ts` 一致（fs + 正则，零依赖）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { UI_COLOR_MIRROR, CANVAS_COLORS, resolveUiColor, PIXEL_SKIN_FALLBACK } from '../battle-colors'

/** 从 themes.css 抽某个主题块里的 token 值 */
function themesToken(theme: 'light' | 'dark'): Record<string, string> {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const css = fs.readFileSync(path.join(dir, '..', '..', 'styles', 'themes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const out: Record<string, string> = {}
    for (const b of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = b[1]
        const isDark = /\[data-theme=['"]dark['"]\]/.test(sel)
        const isLight = /\[data-theme=['"]light['"]\]/.test(sel) || /:root/.test(sel)
        if (theme === 'dark' ? !isDark : !isLight) continue
        for (const m of b[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
    }
    return out
}

/** 顺着 var() 别名链解析到最终字面值 */
function resolveAlias(tokens: Record<string, string>, name: string, depth = 0): string | undefined {
    if (depth > 8) return undefined
    const raw = tokens[name]
    if (raw === undefined) return undefined
    const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw.trim())
    return m ? resolveAlias(tokens, m[1], depth + 1) : raw
}

describe('画布色镜像（battle-colors.ts）', () => {
    for (const theme of ['light', 'dark'] as const) {
        it(`${theme}：每个镜像值都等于 themes.css 的 token 值`, () => {
            const tokens = themesToken(theme)
            const failures: string[] = []
            for (const [name, pair] of Object.entries(UI_COLOR_MIRROR)) {
                const actual = resolveAlias(tokens, name)
                if (actual === undefined) {
                    failures.push(`${theme} ${name}: themes.css 里没有这个 token`)
                    continue
                }
                if (actual.toLowerCase() !== pair[theme].toLowerCase()) {
                    failures.push(`${theme} ${name}: 镜像 ${pair[theme]} ≠ themes.css ${actual}`)
                }
            }
            expect(failures, failures.join('\n')).toEqual([])
        })
    }

    it('resolveUiColor：var() 解析成当前主题的真实色值，非 var() 原样返回', () => {
        expect(resolveUiColor('var(--color-p1)', 'light')).toBe(UI_COLOR_MIRROR['--color-p1'].light)
        expect(resolveUiColor('var( --color-p2 )', 'dark')).toBe(UI_COLOR_MIRROR['--color-p2'].dark)
        expect(resolveUiColor('#123456', 'light')).toBe('#123456')
        // 没登记的 var() 原样返回（上层能看见问题，而不是静默变黑）
        expect(resolveUiColor('var(--color-not-mirrored)', 'light')).toBe('var(--color-not-mirrored)')
    })

    it('画布专用色都是合法十六进制色（canvas 只接受真实色值）', () => {
        for (const [k, v] of Object.entries(CANVAS_COLORS)) {
            expect(/^#[0-9a-f]{6}$/.test(v), `CANVAS_COLORS.${k} = ${v}`).toBe(true)
        }
        expect(/^#[0-9a-f]{6}$/.test(PIXEL_SKIN_FALLBACK)).toBe(true)
    })
})
