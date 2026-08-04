/**
 * 一次性脚本：读取 sample.json（idle 帧）+ sample2.json（attack 帧），
 * 生成新的 sprites.ts（DEFAULT_IDLE + DEFAULT_ATTACK 48×48）并覆盖写入源码。
 *
 * 转换规则（已与用户确认）：
 * - cells 一维数组 (48×48=2304 项)，null=透明
 * - dict index n → PixelMap 值 = n+1（dict0→1, dict1→2, ...）
 * - 不使用负数槽位
 *
 * 用法：npx tsx scripts/import-sample.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IDLE_SAMPLE = join(__dirname, '../src/ui/pixel-sprites/sample.json')
const ATTACK_SAMPLE = join(__dirname, '../src/ui/pixel-sprites/sample2.json')
const SPRITES_TS = join(__dirname, '../src/ui/pixel-sprites/sprites.ts')

interface DictEntry {
    id: string
    code: string
    name: string
    hex: string
    rgb: number[]
}

/** 读取 sample json → 48×48 rows（value = dict index + 1, null → 0） */
function loadRows(file: string): { rows: number[][]; dict: DictEntry[] } {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const size: [number, number] = raw.size
    const dict: DictEntry[] = raw.dict
    const cells: (number | null)[] = raw.cells

    if (size[0] !== 48 || size[1] !== 48) {
        throw new Error(`期望 48×48，实际 ${size[0]}×${size[1]}`)
    }
    if (cells.length !== 48 * 48) {
        throw new Error(`${file} cells 长度 ${cells.length} ≠ 2304`)
    }

    console.error(`=== ${file.split('/').pop()} dict 颜色 ===`)
    dict.forEach((d, i) => console.error(`  dict[${i}] ${d.id} ${d.hex} (${d.name})`))

    const rows: number[][] = []
    for (let y = 0; y < 48; y++) {
        const row: number[] = []
        for (let x = 0; x < 48; x++) {
            const v = cells[y * 48 + x]
            row.push(v === null || v === undefined ? 0 : v + 1)
        }
        rows.push(row)
    }
    return { rows, dict }
}

/** 打印像素统计（便于核对） */
function printStats(label: string, rows: number[][], dict: DictEntry[]) {
    const counts = new Map<number, number>()
    let nonZero = 0
    for (const row of rows) {
        for (const v of row) {
            if (v !== 0) nonZero++
            counts.set(v, (counts.get(v) ?? 0) + 1)
        }
    }
    console.error(`=== ${label} 像素统计 ===`)
    console.error(`  非透明像素: ${nonZero}`)
    for (const [k, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
        console.error(`  索引 ${k} (${dict[k - 1]?.hex ?? '?'}): ${c}`)
    }
}

/** 生成 PixelMap 数组文本（保持现有 37+11 换行风格） */
function emitPixelMap(name: string, rows: number[][]): string[] {
    const lines: string[] = []
    lines.push(`export const ${name}: PixelMap = [`)
    for (let y = 0; y < 48; y++) {
        const row = rows[y]
        const part1 = row.slice(0, 37)
        const part2 = row.slice(37, 48)
        lines.push(`    [`)
        lines.push(`        ${part1.join(', ')},`)
        lines.push(`        ${part2.join(', ')},`)
        lines.push(`    ],`)
    }
    lines.push(']')
    return lines
}

const idle = loadRows(IDLE_SAMPLE)
const attack = loadRows(ATTACK_SAMPLE)

// 生成 sprites.ts 文本
const lines: string[] = []
lines.push("import type { PixelMap } from './types'")
lines.push('')
lines.push('type SpriteSet = { idle: PixelMap; attack: PixelMap }')
lines.push('')
lines.push(...emitPixelMap('DEFAULT_IDLE', idle.rows))
lines.push('')
lines.push(...emitPixelMap('DEFAULT_ATTACK', attack.rows))
lines.push('')
lines.push('export const SPRITES: Record<string, SpriteSet> = {')
lines.push('    default: { idle: DEFAULT_IDLE, attack: DEFAULT_ATTACK },')
lines.push('}')
lines.push('')

// 输出到 sprites.ts
writeFileSync(SPRITES_TS, lines.join('\n'))
console.log('written:', SPRITES_TS)

printStats('idle', idle.rows, idle.dict)
printStats('attack', attack.rows, attack.dict)
