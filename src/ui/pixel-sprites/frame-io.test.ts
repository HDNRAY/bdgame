import { describe, expect, it } from 'vitest'
import {
    blankPixelMap,
    formatPixelMapJson,
    formatPixelMapLiteral,
    formatPixelMapSource,
    parsePixelMap,
    formatCharacterColorsSnippet,
    formatWeaponOverlaySnippet,
    formatWeaponPoseSnippet,
    parseWeaponOverlay,
    stringifyPixelMap,
    unpadRenderedFrame,
} from './frame-io'
import { DEFAULT_IDLE } from './sprites'
import { HAND_POINTS } from './weapons'
import type { WeaponPoseConfig } from './types'
import { POSE_NAMES, WEAPON_POSES, resolveWeaponMount } from './weapons'

describe('像素帧排版', () => {
    it('每行 19 个数字、8 空格缩进（与 sprites.ts 现有帧同构）', () => {
        const literal = formatPixelMapLiteral(blankPixelMap(48, 2))
        const lines = literal.split('\n')
        expect(lines[0]).toBe('[')
        expect(lines[1]).toBe('    [')
        expect(lines[2]).toBe('        ' + new Array(19).fill('0').join(', ') + ',')
        // 48 宽 → 19+19+10 三段
        expect(lines[2 + 2]).toBe('        ' + new Array(10).fill('0').join(', ') + ',')
        expect(lines[2 + 3]).toBe('    ],')
        expect(lines[lines.length - 1]).toBe(']')
    })

    it('TS 片段带常量声明', () => {
        expect(formatPixelMapSource('DEFAULT_BUFF', blankPixelMap(2, 1)).startsWith('export const DEFAULT_BUFF: PixelMap = [')).toBe(
            true,
        )
    })
})

describe('单张图 JSON', () => {
    it('是合法 JSON 且能原样解析回来（每行一组像素）', () => {
        const json = formatPixelMapJson(DEFAULT_IDLE)
        expect(json.startsWith('[\n    [')).toBe(true)
        // 合法 JSON：没有 `,]` 这种行尾多余逗号
        expect(json).not.toMatch(/,\s*[\]]/)
        const parsed = JSON.parse(json) as number[][]
        expect(parsed.length).toBe(DEFAULT_IDLE.length)
        expect(parsed[0]).toEqual(DEFAULT_IDLE[0])
        const round = parsePixelMap(json)
        expect(round.ok).toBe(true)
        if (round.ok) expect(round.map).toEqual(DEFAULT_IDLE)
    })
})

describe('像素帧解析（一张图）', () => {
    it('导出的数据能原样解析回来', () => {
        const text = formatPixelMapSource('DEFAULT_IDLE', DEFAULT_IDLE)
        const parsed = parsePixelMap(text)
        expect(parsed.ok).toBe(true)
        if (parsed.ok) expect(stringifyPixelMap(parsed.map)).toBe(stringifyPixelMap(DEFAULT_IDLE))
    })

    it('紧凑 JSON 也能解析', () => {
        const map = blankPixelMap(3, 2)
        map[1][2] = 9
        const parsed = parsePixelMap(stringifyPixelMap(map))
        expect(parsed.ok).toBe(true)
        if (parsed.ok) expect(parsed.map[1][2]).toBe(9)
    })

    it('带声明的一张图 / 单键对象都能读', () => {
        const decl = parsePixelMap(formatPixelMapSource('DEFAULT_BUFF', DEFAULT_IDLE))
        expect(decl.ok).toBe(true)
        const obj = parsePixelMap(`{"buff": ${formatPixelMapJson(DEFAULT_IDLE)}}`)
        expect(obj.ok).toBe(true)
        if (obj.ok) expect(obj.key).toBe('buff')
    })

    it('一个文件里有多张图 → 明确报错，而不是把多张拼成一张', () => {
        const two = `${formatPixelMapSource('DEFAULT_IDLE', DEFAULT_IDLE)}\n\n${formatPixelMapSource('DEFAULT_BUFF', DEFAULT_IDLE)}`
        const r = parsePixelMap(two)
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.error).toMatch(/张图/)
        const obj = parsePixelMap(`{"idle": ${formatPixelMapJson(DEFAULT_IDLE)}, "buff": ${formatPixelMapJson(DEFAULT_IDLE)}}`)
        expect(obj.ok).toBe(false)
        if (!obj.ok) expect(obj.error).toMatch(/张图/)
    })

    it('尺寸不齐 / 空 / 负数都给明确报错', () => {
        expect(parsePixelMap('').ok).toBe(false)
        expect(parsePixelMap('[[0,0],[0]]').ok).toBe(false)
        expect(parsePixelMap('[]').ok).toBe(false)
        expect(parsePixelMap('[[0,-1]]').ok).toBe(false)
        expect(parsePixelMap('[[0,1.5]]').ok).toBe(false)
        const bad = parsePixelMap('[[0,0],[0]]')
        expect(bad.ok === false && bad.error).toMatch(/长度/)
    })
})

describe('渲染帧 → 源图', () => {
    const toPadded = (src: number[][]) => src.map((row) => { const r = new Array(60).fill(0); row.forEach((v, x) => { r[x + 7] = v }); return r })

    it('60×48 的渲染帧裁回 48×48，且与源图逐格相同（往返不掉像素）', () => {
        const r = unpadRenderedFrame(toPadded(DEFAULT_IDLE), 48)
        expect(r.cropped).toBe(true)
        expect(r.map).toEqual(DEFAULT_IDLE)
    })

    it('左侧留白非空（不是渲染帧）时原样返回', () => {
        const padded = toPadded(DEFAULT_IDLE)
        padded[10][0] = 5
        const r = unpadRenderedFrame(padded, 48)
        expect(r.cropped).toBe(false)
        expect(r.map).toBe(padded)
    })

    it('源图（48×48）原样返回', () => {
        const r = unpadRenderedFrame(DEFAULT_IDLE, 48)
        expect(r.cropped).toBe(false)
        expect(r.map).toBe(DEFAULT_IDLE)
    })
})

describe('武器图导入导出', () => {
    const grid = () => {
        const g = blankPixelMap(32, 32)
        g[4][4] = 1 // #aa0000
        g[4][5] = 2 // #00bb00
        g[5][5] = 2
        return g
    }
    const palette = ['', '#aa0000', '#00bb00']

    it('导出的片段能被解析回来（往返不掉像素）', () => {
        const snippet = formatWeaponOverlaySnippet('test_blade', grid(), palette)
        expect(snippet).toContain("test_blade: {")
        expect(snippet).toContain("'1': '#aa0000',")
        expect(snippet).toContain('[4, 4, 1],')
        const parsed = parseWeaponOverlay(snippet)
        expect(parsed.ok).toBe(true)
        if (parsed.ok) {
            expect(parsed.id).toBe('test_blade')
            expect(parsed.grid[4][4]).toBeGreaterThan(0)
            expect(parsed.grid[5][5]).toBe(parsed.grid[4][5]) // 同色合并成同一下标
            expect(parsed.palette.filter(Boolean)).toEqual(['#aa0000', '#00bb00'])
        }
    })

    it('直接写色值的写法也能读', () => {
        const parsed = parseWeaponOverlay(`{ pixels: [[1, 2, '#112233'], [3, 4, '#112233']], palette: {} }`)
        expect(parsed.ok).toBe(true)
        if (parsed.ok) {
            expect(parsed.palette.filter(Boolean)).toEqual(['#112233'])
            expect(parsed.grid[2][1]).toBe(parsed.grid[4][3])
        }
    })

    it('坐标越界 / 下标缺失 / 空 pixels 都给明确报错', () => {
        expect(parseWeaponOverlay('{ pixels: [[40, 4, 1]], palette: { "1": "#fff" } }').ok).toBe(false)
        expect(parseWeaponOverlay('{ pixels: [[1, 1, 9]], palette: { "1": "#fff" } }').ok).toBe(false)
        expect(parseWeaponOverlay('{ pixels: [], palette: {} }').ok).toBe(false)
        expect(parseWeaponOverlay('[[1,2,3]]').ok).toBe(false)
    })
})

describe('角色配色片段', () => {
    it('按 palette.ts 的写法输出一行，可直接粘进 CHARACTER_COLORS', () => {
        const line = formatCharacterColorsSnippet('yidao', {
            skin: '#f5d6c6',
            hair: '#123456',
            eyes: '#b71902',
            accent: '#8c1d18',
            decoration: '#d4a848',
        })
        expect(line).toBe(
            "    yidao: { skin: '#f5d6c6', hair: '#123456', eyes: '#b71902', accent: '#8c1d18', decoration: '#d4a848' },",
        )
    })
})

describe('武器挂点片段', () => {
    it('字符串字段带引号（anchorHand）、布尔字段不带引号', () => {
        const snippet = formatWeaponPoseSnippet(
            'test_blade',
            {
                idle: { gripX: 8, gripY: 7, flip: true, noHandCover: true, anchorHand: 'main' },
                attack: { gripX: 8, gripY: 7, anchorHand: 'off', angle: -Math.PI / 4 },
            },
            ['idle', 'attack'],
        )
        // 基底沿用 idle；attack 条目自包含（整替基底，不是合并），anchorHand 带引号
        expect(snippet).toContain("...makePoses({ gripX: 8, gripY: 7, flip: true, anchorHand: 'main', noHandCover: true })")
        expect(snippet).toContain("attack: { gripX: 8, gripY: 7, anchorHand: 'off', angle: (-45 * Math.PI) / 180 }")
        // 不能出现没引号的裸标识符
        expect(snippet).not.toMatch(/anchorHand: (main|off)\b(?!')/)
    })

    it('单引号包裹后是合法 TS（用 Function 解析一遍）', () => {
        const snippet = formatWeaponPoseSnippet(
            'test_blade',
            { idle: { gripX: 1, gripY: 2, anchorHand: 'off' } },
            ['idle'],
        )
        // makePoses 的作用就是把基底铺到每个姿势（与 weapons.ts 里的真实实现一致）
        const src = `const POSE_NAMES = ['idle', 'attack', 'dodge', 'parry', 'hit', 'buff']`
            + `; const makePoses = (base) => Object.fromEntries(POSE_NAMES.map((p) => [p, { ...base }]))`
            + `; const WEAPON_POSES = {\n${snippet}\n}; return WEAPON_POSES.test_blade.idle.anchorHand`
        // eslint-disable-next-line no-new-func
        const value = new Function(src)()
        expect(value).toBe('off')
    })
})

/** 用导出片段 + 真实的 makePoses 语义（基底铺到每个姿势）求值，拿到 WEAPON_POSES 条目 */
function evalPoseSnippet(snippet: string): Record<string, Record<string, Record<string, unknown>>> {
    const src =
        `const POSE_NAMES = ${JSON.stringify([...POSE_NAMES])}` +
        '; const makePoses = (base) => Object.fromEntries(POSE_NAMES.map((p) => [p, { ...base }]))' +
        `; const WEAPON_POSES = {\n${snippet}\n}; return WEAPON_POSES`
    // eslint-disable-next-line no-new-func
    return new Function(src)() as Record<string, Record<string, Record<string, unknown>>>
}

describe('武器挂点片段 · 往返一致', () => {
    // 导出再求值后，引擎解析出的落点（手位/角度/握柄）必须完全一致。
    // 注意：导出会把绝对坐标 handX/handY 折算成相对偏移 handDX/handDY，所以比对的是"解析结果"而不是字段名。
    const IDS = ['peach_sword', 'dark_iron_sword', 'tri_orb', 'qimei_staff', 'xiu_dong', 'chun_lei', 'iron_spear']
    for (const id of IDS) {
        it(`${id}：导出后每个姿势的落点与登记值一致`, () => {
            const original = WEAPON_POSES[id]
            const configs = Object.fromEntries([...POSE_NAMES].map((p) => [p, original[p] ?? original.idle]))
            const snippet = formatWeaponPoseSnippet(id, configs, [...POSE_NAMES])
            const roundTripped = evalPoseSnippet(snippet)[id]
            for (const pose of POSE_NAMES) {
                const want = resolveWeaponMount(id, pose)
                const gotCfg = (roundTripped[pose] ?? {}) as Partial<WeaponPoseConfig>
                const got = resolveWeaponMount(id, pose, { config: gotCfg })
                expect(got.hand, `${id}.${pose}.hand`).toEqual(want.hand)
                expect(got.angle, `${id}.${pose}.angle`).toBeCloseTo(want.angle, 6)
                expect(got.gripX, `${id}.${pose}.gripX`).toBeCloseTo(want.gripX, 6)
                expect(got.gripY, `${id}.${pose}.gripY`).toBeCloseTo(want.gripY, 6)
            }
        })
    }

    it('绝对坐标折算成相对偏移：等于基准就不写，偏离基准写 handDX/handDY', () => {
        const snippet = formatWeaponPoseSnippet(
            'test_blade',
            {
                idle: { gripX: 1, gripY: 2, handX: 37.5, handY: 31.5 }, // HAND_POINTS.idle = (37, 32)
                parry: { gripX: 1, gripY: 2, handX: HAND_POINTS.parry.x, handY: HAND_POINTS.parry.y - 5 },
            },
            ['idle', 'parry'],
        )
        expect(snippet).toContain('...makePoses({ gripX: 1, gripY: 2, handDX: 0.5, handDY: -0.5 })')
        // parry 的手位正好等于基准 → 不写；-5 的那部分写成 handDY
        // 条目是自包含的：基底的非 0 偏移在这里必须显式归零
        expect(snippet).toContain('parry: { gripX: 1, gripY: 2, handDX: 0, handDY: -5 }')
        expect(snippet).not.toContain('handX: 37.5')
    })
})
