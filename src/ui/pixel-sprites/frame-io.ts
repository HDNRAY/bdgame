/**
 * 像素帧导入/导出（编辑器用）—— **一次一张图**
 *
 * 导出两种形态，都是「一张图」：
 *  - TS 片段：`PixelMap`（number[][]）字面量，每行 19 个数字、8 空格缩进、行尾逗号，
 *    与 sprites.ts 中已有帧逐字符同构，可整段替换常量；
 *  - 单张图 JSON：合法 JSON（无行尾多余逗号，每行一组像素），下载 .json 用它。
 *
 * 导入只吃一张图（`[[...]]`、带声明的一张图、单键对象），一个文件里多张会明确报错 ——
 * 避免把多张数组首尾接起来当一张解析（历史上 `第一个 [` 到 `最后一个 ]` 就是这么错的）。
 */
import type { HandAnchorData } from './frame-edit'
import type { CharacterColors } from './palette'
import type { WeaponPoseConfig } from './types'
import { baseAnchorHand } from './weapons'
import type { PixelMap } from './types'
import { SPRITE_HEIGHT, SPRITE_PAD_LEFT, SPRITE_WIDTH } from './constants'

/** 与 sprites.ts 现有帧一致的排版参数 */
const PER_LINE = 19
const NUMBER_INDENT = '        '
const ROW_INDENT = '    '

/** 只输出数组本体（`[...]`，不含变量名），排版与 sprites.ts 一致 */
export function formatPixelMapLiteral(map: PixelMap): string {
    const rows = map.map((row) => {
        const lines: string[] = []
        for (let i = 0; i < row.length; i += PER_LINE) {
            lines.push(NUMBER_INDENT + row.slice(i, i + PER_LINE).join(', ') + ',')
        }
        return `${ROW_INDENT}[\n${lines.join('\n')}\n${ROW_INDENT}],`
    })
    return `[\n${rows.join('\n')}\n]`
}

/** 输出可直接粘进 sprites.ts 的完整常量声明 */
export function formatPixelMapSource(name: string, map: PixelMap): string {
    return `export const ${name}: PixelMap = ${formatPixelMapLiteral(map)}`
}

/** 单行紧凑 JSON（用于塞进别的 JSON / 单行配置） */
export function stringifyPixelMap(map: PixelMap): string {
    return JSON.stringify(map)
}

export type ParsePixelMapResult = { ok: true; map: PixelMap; key?: string } | { ok: false; error: string }

/** 去掉 `,]` / `,}` 前的多余逗号（我们的字面量样式每行都以逗号结尾，严格 JSON 不接受） */
function dropTrailingCommas(json: string): string {
    return json.replace(/,\s*([\]}])/g, '$1')
}

/**
 * 把 TS 字面量放宽成 JSON：
 *  - 单引号字符串 → 双引号
 *  - 未加引号的键（`pixels:`）→ 加引号
 *  - 行注释与块注释都去掉
 *  - 行尾多余逗号 → 去掉
 * 这样从旧的 weapons.ts 直接复制出来的条目也能读。
 */
function normalizeTsLiteral(src: string): string {
    let out = ''
    let quote: string | null = null
    for (let i = 0; i < src.length; i++) {
        const ch = src[i]
        if (quote) {
            if (ch === '\\') {
                out += ch + (src[i + 1] ?? '')
                i++
                continue
            }
            if (ch === quote) {
                quote = null
                out += '"'
                continue
            }
            out += ch === '"' ? '\\"' : ch
            continue
        }
        if (ch === '"' || ch === "'") {
            quote = ch
            out += '"'
            continue
        }
        if (ch === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i++
            out += '\n'
            continue
        }
        out += ch
    }
    return dropTrailingCommas(out.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":'))
}

/** 从 text[start] 处（必须是 `[`）取出配平的数组片段；跳过字符串字面量里的括号 */
function findBalancedArray(text: string, start: number): { body: string; next: number } | null {
    if (text[start] !== '[') return null
    let depth = 0
    let quote: string | null = null
    for (let i = start; i < text.length; i++) {
        const ch = text[i]
        if (quote) {
            if (ch === '\\') i++
            else if (ch === quote) quote = null
            continue
        }
        if (ch === '"' || ch === "'") {
            quote = ch
            continue
        }
        if (ch === '[' || ch === '{') depth++
        else if (ch === ']' || ch === '}') {
            depth--
            if (depth === 0) return { body: text.slice(start, i + 1), next: i + 1 }
        }
    }
    return null
}

function tryParseJson(json: string): { ok: true; value: unknown } | { ok: false; error: string } {
    try {
        return { ok: true, value: JSON.parse(normalizeTsLiteral(json)) }
    } catch (e) {
        return { ok: false, error: `JSON 解析失败：${(e as Error).message}` }
    }
}

/** 是否是「一张图」的形状：非空的二维数组，每行非空 */
function looksLikePixelRows(value: unknown): boolean {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((row) => Array.isArray(row) && row.length > 0 && row.every((v) => typeof v === 'number'))
    )
}

/** 校验并拷贝成 PixelMap（行等长、非负整数） */
function toPixelMap(raw: unknown): ParsePixelMapResult {
    if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: '不是非空二维数组' }
    const map: PixelMap = []
    let width = -1
    for (let y = 0; y < raw.length; y++) {
        const row = raw[y]
        if (!Array.isArray(row) || row.length === 0) {
            return { ok: false, error: `第 ${y} 行不是非空数组（一张图需要外层 [...] 包住所有行）` }
        }
        if (width < 0) width = row.length
        else if (row.length !== width) return { ok: false, error: `第 ${y} 行长度 ${row.length}，与第 0 行的 ${width} 不一致` }
        const out: number[] = []
        for (let x = 0; x < row.length; x++) {
            const v = row[x]
            if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
                return { ok: false, error: `(${x},${y}) 不是非负整数：${JSON.stringify(v)}` }
            }
            out.push(v)
        }
        map.push(out)
    }
    return { ok: true, map }
}

/**
 * 解析**一张图**。
 *
 * 接受：`[[...]]` 二维数组、`export const X: PixelMap = [[...]]` 这种带声明的一张图、
 * 单键对象 `{"buff": [[...]]}`；行尾多余逗号也认。
 *
 * 不接受一个文件里的多张图（整份 sprites.ts、`{"idle": [...], "buff": [...]}`）——
 * 会明确报「这段是 N 张图」，让调用方只取一张，避免把多张数组首尾接起来当一张解析。
 */
export function parsePixelMap(text: string): ParsePixelMapResult {
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, error: '内容为空' }

    // 单键对象：{"名字": [[...]]}
    if (trimmed.startsWith('{')) {
        const parsed = tryParseJson(trimmed)
        if (!parsed.ok) return parsed
        const obj = parsed.value
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: '不是一张图（既不是数组也不是对象）' }
        const entries = Object.entries(obj as Record<string, unknown>)
        const images = entries.filter(([, v]) => looksLikePixelRows(v))
        if (images.length > 1) return { ok: false, error: `这段是 ${images.length} 张图（${entries.map(([k]) => k).join(' / ')}），编辑器一次只处理一张` }
        if (images.length === 0) return { ok: false, error: '对象里没有一张图的数组' }
        const [key, value] = images[0]
        const result = toPixelMap(value)
        return result.ok ? { ...result, key } : result
    }

    const start = trimmed.indexOf('[')
    if (start < 0) return { ok: false, error: '找不到数组（需要 [[...]] 结构）' }
    const first = findBalancedArray(trimmed, start)
    if (!first) return { ok: false, error: '方括号不配平' }
    const parsed = tryParseJson(first.body)
    if (!parsed.ok) return parsed
    if (!looksLikePixelRows(parsed.value)) return toPixelMap(parsed.value)

    // 后面还有没有第二张图？
    const rest = trimmed.slice(first.next)
    const otherStarts: number[] = []
    for (let i = rest.indexOf('['); i >= 0; i = rest.indexOf('[', i + 1)) {
        otherStarts.push(i)
        if (otherStarts.length >= 8) break
    }
    let others = 0
    for (const i of otherStarts) {
        const next = findBalancedArray(rest, i)
        if (!next) break
        const value = tryParseJson(next.body)
        if (value.ok && looksLikePixelRows(value.value)) others++
    }
    if (others > 0) {
        return { ok: false, error: `这段至少是 ${others + 1} 张图（多个数组），编辑器一次只处理一张：请只保留其中一张的 [[...]]` }
    }

    return toPixelMap(parsed.value)
}

export interface UnpadResult {
    map: PixelMap
    /** 是否识别为渲染帧并裁掉了左侧留白 */
    cropped: boolean
}

/**
 * 把「渲染帧」转回源图。
 *
 * 老版本编辑器编辑/导出的是 padSprite 之后的渲染帧（60×48，内容右移 7 格）；
 * 直接当源图用会整体右移 7 格、右边被裁掉。这里做识别：宽度/高度等于渲染画布、
 * 且左侧 padLeft 列全空 → 裁掉左侧留白，取 sourceWidth 列。
 * 不是渲染帧就原样返回（cropped=false）。
 */
export function unpadRenderedFrame(map: PixelMap, sourceWidth: number, padLeft = SPRITE_PAD_LEFT): UnpadResult {
    if (map.length !== SPRITE_HEIGHT || (map[0]?.length ?? 0) !== SPRITE_WIDTH) return { map, cropped: false }
    for (const row of map) {
        for (let x = 0; x < padLeft; x++) {
            if (row[x] !== 0) return { map, cropped: false }
        }
    }
    return { map: map.map((row) => row.slice(padLeft, padLeft + sourceWidth)), cropped: true }
}

/** 造一张空白帧 */
export function blankPixelMap(width: number, height: number): PixelMap {
    return Array.from({ length: height }, () => new Array<number>(width).fill(0))
}

/**
 * 单张图的 JSON 文本（合法 JSON：无行尾多余逗号、每行一组像素，便于 diff 与直接回导）。
 * 下载 .json 用的就是它。
 */
export function formatPixelMapJson(map: PixelMap): string {
    const rows = map.map((row) => `    [${row.join(', ')}]`)
    return `[\n${rows.join(',\n')}\n]`
}

/** 数值写成 `x + SPRITE_PAD_LEFT` 的形式（与 weapons/hands.ts 里的写法一致；半格写作 31.5） */
function anchorValue(v: number): string {
    const n = v - SPRITE_PAD_LEFT
    return Number.isInteger(n) ? `${n} + SPRITE_PAD_LEFT` : `${n} + SPRITE_PAD_LEFT`
}

/**
 * 生成手部锚点的 TS 片段（可直接粘进 weapons/hands.ts 的
 * HAND_POINTS / OTHER_HAND_POINT / HAND_COVER / LEFT_HAND_COVER 里对应姿势那一条）。
 */
export function formatAnchorSnippet(pose: string, main: HandAnchorData, off: HandAnchorData): string {
    const point = (p: { x: number; y: number }) => `{ x: ${anchorValue(p.x)}, y: ${p.y} }`
    const cover = (cells: [number, number][]) =>
        cells.map(([x, y]) => `        [${anchorValue(x)}, ${y}],`).join('\n')
    return [
        `// ── 手部锚点（${pose}）：源图坐标；锚点表按「内容坐标 + SPRITE_PAD_LEFT」书写 ──`,
        `// HAND_POINTS`,
        `    ${pose}: ${point(main.point)},`,
        `// OTHER_HAND_POINT`,
        `    ${pose}: ${point(off.point)},`,
        `// HAND_COVER`,
        `    ${pose}: [`,
        cover(main.cover),
        `    ],`,
        `// LEFT_HAND_COVER`,
        `    ${pose}: [`,
        cover(off.cover),
        `    ],`,
    ].join('\n')
}

/** 武器调色板里存色（0 号是「空」，不参与导出） */
export interface WeaponGridData {
    /** 32×32 网格：0 = 空，其余是 palette 的下标 */
    grid: PixelMap
    /** 下标 0 占位（空），1..n 是颜色 */
    palette: string[]
}

/**
 * 生成武器美术片段：`overlay:` 块（粘进 weapons/entries/<武器>.ts 里，与 poses: 并列）。
 * 下标会重新编号成 1..n（紧凑），调色板只输出用到的颜色。
 */
export function formatWeaponOverlaySnippet(weaponId: string, grid: PixelMap, palette: string[]): string {
    const used = new Set<number>()
    for (const row of grid) for (const v of row) if (v > 0) used.add(v)
    const indices = [...used].sort((a, b) => a - b)
    const keyOf = (i: number) => String(indices.indexOf(i) + 1)
    // 片段给出该武器文件里的 `overlay:` 块（与 poses: 并列）
    const lines: string[] = [`// weapons/entries/${weaponId}.ts → overlay:`, 'overlay: {']
    if (indices.length > 0) {
        lines.push('    palette: {')
        for (const i of indices) lines.push(`        '${keyOf(i)}': '${palette[i] ?? '#000000'}',`)
        lines.push('    },')
    }
    lines.push('    pixels: [')
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const v = grid[y][x]
            if (v > 0) lines.push(`        [${x}, ${y}, ${keyOf(v)}],`)
        }
    }
    lines.push('    ],')
    lines.push('},')
    return lines.join('\n')
}

export type ParseWeaponResult =
    | { ok: true; grid: PixelMap; palette: string[]; id?: string }
    | { ok: false; error: string }

/**
 * 解析一张武器图：`{ pixels: [[x, y, 颜色或下标], ...], palette?: { '1': '#rrggbb' } }`。
 * 也接受带武器 id 的整条 `WEAPON_OVERLAYS` 条目（取第一个花括号对象）。
 * 输出 32×32 网格（0 = 空）+ 调色板（下标 0 占位）。
 */
export function parseWeaponOverlay(text: string, width = 32, height = 32): ParseWeaponResult {
    const trimmed = text.trim()
    if (!trimmed) return { ok: false, error: '内容为空' }
    const start = trimmed.indexOf('{')
    if (start < 0) return { ok: false, error: '找不到对象（需要 { pixels: [...], palette: {...} }）' }
    const balanced = findBalancedObject(trimmed, start)
    if (!balanced) return { ok: false, error: '花括号不配平' }
    const parsed = tryParseJson(balanced.body)
    if (!parsed.ok) return parsed
    let obj = parsed.value
    let id: string | undefined
    // `test_blade: { ... }` 这种「键在前、对象在后」的条目：从花括号前面认 id
    // 新格式片段首行注释里带目标文件：`// weapons/entries/<id>.ts → overlay:`
    const fromComment = trimmed.match(/weapons\/entries\/([A-Za-z_0-9]+)\.ts/)
    if (fromComment) id = fromComment[1]
    const beforeKey = trimmed.slice(0, start).match(/([A-Za-z_$][\w$]*)\s*:\s*$/)
    // `overlay:` / `poses:` 是结构键，不是武器 id
    if (!id && beforeKey && beforeKey[1] !== 'overlay' && beforeKey[1] !== 'poses') id = beforeKey[1]
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const entries = Object.entries(obj as Record<string, unknown>)
        const inner = entries.find(
            ([, v]) => v && typeof v === 'object' && !Array.isArray(v) && Array.isArray((v as { pixels?: unknown }).pixels),
        )
        if (inner) {
            id = inner[0]
            obj = inner[1]
        }
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: '不是武器图对象' }
    const pixels = (obj as { pixels?: unknown }).pixels
    if (!Array.isArray(pixels)) return { ok: false, error: '缺少 pixels 数组' }
    const rawPalette = (obj as { palette?: unknown }).palette
    const palette: string[] = ['']
    const colorToIndex = new Map<string, number>()
    if (rawPalette && typeof rawPalette === 'object' && !Array.isArray(rawPalette)) {
        for (const [k, v] of Object.entries(rawPalette as Record<string, unknown>)) {
            if (typeof v !== 'string') continue
            const idx = Number(k)
            if (!Number.isInteger(idx) || idx < 0) continue
            palette[idx] = v
        }
    }
    for (let i = 1; i < palette.length; i++) {
        if (palette[i]) colorToIndex.set(palette[i].toLowerCase(), i)
    }
    const indexForColor = (color: string): number => {
        const key = color.toLowerCase()
        const found = colorToIndex.get(key)
        if (found) return found
        palette.push(color)
        const idx = palette.length - 1
        colorToIndex.set(key, idx)
        return idx
    }
    const grid: PixelMap = Array.from({ length: height }, () => new Array<number>(width).fill(0))
    let placed = 0
    for (const p of pixels) {
        if (!Array.isArray(p) || p.length < 3) return { ok: false, error: 'pixels 里应形如 [x, y, 颜色]' }
        const x = Number(p[0])
        const y = Number(p[1])
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
            return { ok: false, error: `像素坐标越界：(${p[0]}, ${p[1]})，网格 ${width}×${height}` }
        }
        const color = p[2]
        let idx: number
        if (typeof color === 'number') {
            idx = color
            if (idx <= 0 || idx >= palette.length || !palette[idx]) {
                return { ok: false, error: `像素 (${x},${y}) 用了调色板里没有的下标 ${idx}` }
            }
        } else if (typeof color === 'string') {
            idx = indexForColor(color)
        } else {
            return { ok: false, error: `像素 (${x},${y}) 颜色既不是下标也不是色值` }
        }
        grid[y][x] = idx
        placed++
    }
    if (placed === 0) return { ok: false, error: 'pixels 是空的' }
    const maxIdx = Math.max(...grid.flat())
    return { ok: true, grid, palette: palette.slice(0, maxIdx + 1), id }
}

/** 从 text[start] 处（必须是 `{`）取出配平的对象片段 */
function findBalancedObject(text: string, start: number): { body: string; next: number } | null {
    if (text[start] !== '{') return null
    let depth = 0
    let quote: string | null = null
    for (let i = start; i < text.length; i++) {
        const ch = text[i]
        if (quote) {
            if (ch === '\\') i++
            else if (ch === quote) quote = null
            continue
        }
        if (ch === '"' || ch === "'") {
            quote = ch
            continue
        }
        if (ch === '{' || ch === '[') depth++
        else if (ch === '}' || ch === ']') {
            depth--
            if (depth === 0) return { body: text.slice(start, i + 1), next: i + 1 }
        }
    }
    return null
}

/**
 * 生成 CHARACTER_COLORS 的条目片段（可直接粘进 palette.ts）。
 * 编辑器里改过发色/皮肤等之后，用它把配色落回代码。
 */
export function formatCharacterColorsSnippet(charId: string, colors: CharacterColors): string {
    return (
        `    ${charId}: { skin: '${colors.skin}', hair: '${colors.hair}', eyes: '${colors.eyes}', ` +
        `accent: '${colors.accent}', decoration: '${colors.decoration}' },`
    )
}

function fmtNum(v: number): string {
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000)
}

/** 角度：是「整数/半度」就写成 (15 * Math.PI) / 180，否则按弧度原值写（与武器条目里的习惯一致） */
function fmtAngle(rad: number): string {
    if (rad === 0) return '0'
    const deg = (rad * 180) / Math.PI
    const halfSteps = Math.round(deg * 2) / 2
    if (Math.abs(deg - halfSteps) < 0.01) return `(${fmtNum(halfSteps)} * Math.PI) / 180`
    return fmtNum(rad)
}

/** 能被 makePoses 基底携带的字段（所有姿势一致时才放进基底） */
/** 两个可能为空的数字之差；任一为空则视为 0（不写偏移） */
function offsetOfNum(a: number | undefined, b: number | undefined): number {
    if (a === undefined || b === undefined) return 0
    return Math.round((a - b) * 1e4) / 1e4
}

const BASE_CANDIDATES: (keyof WeaponPoseConfig)[] = ['gripX', 'gripY', 'flip', 'anchorHand', 'noHandCover']
/** 相对偏移字段（写进基底会"继承"，所以判定差异时按 0 兜底） */
const OFFSET_KEYS: (keyof WeaponPoseConfig)[] = ['handDX', 'handDY']
/** 其余逐姿势字段 */
const POSE_KEYS: (keyof WeaponPoseConfig)[] = ['angle']

/**
 * 把一条配置折算成「导出形态」：绝对手位 → 相对偏移（handDX/handDY）。
 * - handX/handY 成对出现才折算，单个轴保留原样（引擎本来就只认成对）；
 * - 折算出的偏移按 0 兜底参与比较，避免"没写 = 继承基底"把别的姿势的偏移也继承过去。
 */
function toExportShape(
    cfg: Partial<WeaponPoseConfig>,
    pose: string,
    slot: 'main' | 'off',
): Partial<WeaponPoseConfig> {
    const out: Partial<WeaponPoseConfig> = { ...cfg }
    const handPair = typeof cfg.handX === 'number' && typeof cfg.handY === 'number'
    if (handPair) {
        const base = baseAnchorHand(cfg, pose, slot)
        out.handDX = Math.round((cfg.handX! - base.x) * 10000) / 10000
        out.handDY = Math.round((cfg.handY! - base.y) * 10000) / 10000
        delete out.handX
        delete out.handY
    }
    return out
}

function offsetOf(cfg: Partial<WeaponPoseConfig>, key: keyof WeaponPoseConfig): number {
    const v = cfg[key]
    return typeof v === 'number' ? v : 0
}

function formatKey(key: keyof WeaponPoseConfig, cfg: Partial<WeaponPoseConfig>): string {
    const v = cfg[key]
    if (typeof v === 'boolean') return `${key}: ${v}`
    // 字符串字段（目前只有 anchorHand: 'main' | 'off'）必须带引号，否则导出的 TS 不合法
    if (typeof v === 'string') return `${key}: '${v}'`
    if (typeof v === 'number') return `${key}: ${key === 'angle' ? fmtAngle(v) : fmtNum(v)}`
    return `${key}: ${String(v)}`
}

/**
 * 生成挂点片段：`poses:` 块（粘进 weapons/entries/<武器>.ts 里，与 overlay: 并列）。
 * 基底取 idle 的共用字段（grip/flip/第二握点…），与基底不同的姿势再单独列出。
 */
export function formatWeaponPoseSnippet(
    weaponId: string,
    configs: Record<string, Partial<WeaponPoseConfig>>,
    poses: string[],
    opts: {
        /** 副手槽子表：传了就写一段 `off:` 块（与主手同一套压缩规则） */
        offTable?: Record<string, Partial<WeaponPoseConfig>>
    } = {},
): string {
    /**
     * 写一张表（主手 or 副手）。
     *
     * 关键语义：表里的姿势条目是**整体替换** `...makePoses(基底)` 生成的同名条目（不是合并），
     * 所以每个写出来的条目必须**自包含**（该姿势需要的字段全写出来）；
     * 只有和基底完全一样的姿势才可以省略（它会原样继承基底那份）。
     *
     * 偏移字段（handDX/handDY/targetDX/targetDY）额外注意：基底里写了非 0 偏移时，
     * 某个姿势若需要 0 偏移，必须显式写 `handDX: 0`，否则会继承基底的偏移。
     */
    const writeTable = (
        table: Record<string, Partial<WeaponPoseConfig>>,
        indent: string,
        slot: 'main' | 'off',
        /** 副手表：从主手基底继承的结构性字段（相同就不重复写，姿势偏移也相对它计算） */
        inherit?: Partial<WeaponPoseConfig>,
    ): string[] => {
        const shaped: Record<string, Partial<WeaponPoseConfig>> = {}
        for (const pose of poses) {
            const cfg = table[pose]
            if (cfg) shaped[pose] = toExportShape(cfg, pose, slot)
        }
        const idle = shaped.idle ?? {}
        // 基底：只写结构性字段（握点/第二握点/翻转/锚定手/不遮手）——姿势条目会继承它们
        const baseParts: string[] = []
        for (const k of BASE_CANDIDATES) {
            if (k === 'gripX' || k === 'gripY') continue
            if (idle[k] !== undefined) baseParts.push(formatKey(k, idle))
        }
        // 只有基底真的写了握点才输出；副手表里与主手基底相同的握点不写（继承主手）
        const gripParts: string[] = []
        if (typeof idle.gripX === 'number' && idle.gripX !== inherit?.gripX) gripParts.push(`gripX: ${fmtNum(idle.gripX)}`)
        if (typeof idle.gripY === 'number' && idle.gripY !== inherit?.gripY) gripParts.push(`gripY: ${fmtNum(idle.gripY)}`)
        const inheritBase = inherit ?? idle
        const allParts = [
            ...gripParts,
            ...baseParts.filter((line) => {
                const k = line.slice(0, line.indexOf(':')) as keyof WeaponPoseConfig
                return idle[k] !== inherit?.[k]
            }),
        ]
        void inheritBase
        const out: string[] = [`${indent}...makePoses({${allParts.length ? ' ' + allParts.join(', ') + ' ' : ''}}),`]

        for (const pose of poses) {
            const cfg = shaped[pose]
            if (!cfg) continue
            const parts: string[] = []
            // 握点：武器端只有一个（在基底），姿势要调就写偏移
            // 优先用配置里显式写的偏移（编辑器写的就是它）；旧数据写的是绝对握点 → 折算成偏移
            // 偏移基准：主手表 = 自己的基底；副手表默认 = 主手基底（继承），
            // 但副手表自己声明了不同的握点（基底行会写出来）时，偏移相对副手基底算，避免重复计入。
            const offOwnGrip =
                inherit !== undefined &&
                ((idle.gripX !== undefined && idle.gripX !== inherit.gripX) ||
                    (idle.gripY !== undefined && idle.gripY !== inherit.gripY))
            const gripBase = offOwnGrip ? idle : (inherit ?? idle)
            const gripOffsets: [keyof WeaponPoseConfig, keyof WeaponPoseConfig, number][] = [
                ['gripDX', 'gripX', cfg.gripDX !== undefined ? cfg.gripDX : offsetOfNum(cfg.gripX, gripBase.gripX)],
                ['gripDY', 'gripY', cfg.gripDY !== undefined ? cfg.gripDY : offsetOfNum(cfg.gripY, gripBase.gripY)],
            ]
            for (const [outKey, , v] of gripOffsets) if (v !== 0) parts.push(`${outKey}: ${fmtNum(v)}`)
            // 结构性字段里与基底不同的（翻转/锚定手/不遮手…；握点已在上面按偏移处理）
            for (const k of BASE_CANDIDATES) {
                if (k === 'gripX' || k === 'gripY') continue
                if (cfg[k] !== undefined && cfg[k] !== (inherit ? inherit[k] : idle[k])) parts.push(formatKey(k, cfg))
            }
            for (const k of POSE_KEYS) if (cfg[k] !== undefined) parts.push(formatKey(k, cfg))
            // 偏移：只写非 0（不继承基底，省略即 0）
            for (const k of OFFSET_KEYS) {
                const v = offsetOf(cfg, k)
                if (v !== 0) parts.push(`${k}: ${fmtNum(v)}`)
            }
            for (const k of ['handX', 'handY'] as const) {
                if (cfg[k] !== undefined && cfg[k] !== 0) parts.push(formatKey(k, cfg))
            }
            if (parts.length === 0) continue
            out.push(`${indent}${pose}: { ${parts.join(', ')} },`)
        }
        return out
    }

    // 现在是「一个武器一个文件」：片段直接给出该文件里的 `poses:` 块
    const shapedMainIdle = toExportShape(configs.idle ?? {}, 'idle', 'main')
    const lines: string[] = [`// weapons/entries/${weaponId}.ts → poses:`, 'poses: {']
    lines.push(...writeTable(configs, '    ', 'main'))
    if (opts.offTable && Object.keys(opts.offTable).length > 0) {
        lines.push('    off: {')
        lines.push(...writeTable(opts.offTable, '        ', 'off', shapedMainIdle))
        lines.push('    },')
    }
    lines.push('},')
    return lines.join('\n')
}
