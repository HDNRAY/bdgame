import { afterEach, describe, expect, it } from 'vitest'
import { POSE_NAMES, WEAPON_ARTS, WEAPON_OVERLAYS, blankPixelMap } from '../../../../pixel-sprites'
import type { PixelEditorSavedState } from '../../../../pixel-sprites'
import {
    gridHasPixels,
    initialWeaponView,
    weaponArtToGrids,
    canPasteInto,
    firstFreeSlot,
    removeWeaponPaletteColor,
    samePalette,
} from './utils'

const SHARED = '__test_art_shared_palette'

/** 存档壳子：只有 weapon 那一层与本次相关 */
function save(weapon: PixelEditorSavedState['weapon']): PixelEditorSavedState {
    return {
        mode: 'weapon',
        frame: { map: blankPixelMap(4, 3), constName: 'DEFAULT_BUFF', poseName: 'buff', sourceKey: 'buff' },
        weapon,
        colorOverrides: {},
        fixedSlotOverrides: {},
        mountConfigs: {},
        tool: 'pen',
        slot: 1,
        mirror: false,
        showGrid: true,
        showAnchors: true,
        manualZoom: null,
    }
}

afterEach(() => {
    delete WEAPON_OVERLAYS[SHARED]
    delete WEAPON_ARTS[SHARED]
})

describe('武器美术 → 编辑器网格（weaponArtToGrids）', () => {
    it('没有 art 的武器：六张姿势图全空，通用图有画', () => {
        const { grid, poses, palette } = weaponArtToGrids('peach_sword')
        expect(gridHasPixels(grid)).toBe(true)
        for (const pose of POSE_NAMES) expect(gridHasPixels(poses[pose]), pose).toBe(false)
        expect(palette.filter(Boolean).length).toBeGreaterThan(0)
    })

    it('逐姿势图与通用图共用同一份 palette（同色 = 同一下标）', () => {
        WEAPON_OVERLAYS[SHARED] = { pixels: [[0, 0, '#ff0000']] }
        WEAPON_ARTS[SHARED] = {
            idle: { pixels: [[1, 1, '#ff0000']] },
            attack: { pixels: [[2, 2, '#00ff00']] },
        }
        const { grid, poses, palette } = weaponArtToGrids(SHARED)
        const red = palette.indexOf('#ff0000')
        const green = palette.indexOf('#00ff00')
        expect(red).toBeGreaterThan(0)
        expect(green).toBeGreaterThan(0)
        expect(grid[0][0]).toBe(red)
        expect(poses.idle[1][1]).toBe(red)
        expect(poses.attack[2][2]).toBe(green)
        // 其它姿势没有图（全 0），不是 undefined
        expect(poses.parry).toHaveLength(poses.idle.length)
        expect(gridHasPixels(poses.parry)).toBe(false)
    })

    it('文件里 palette 的键序与像素出现顺序不同：网格下标仍等于文件里的下标', () => {
        // 像素先出现下标 3、再出现下标 1；palette 键按 1,2,3 写 —— 编辑器不得按像素出现顺序重排
        WEAPON_OVERLAYS[SHARED] = {
            palette: { '1': '#111111', '2': '#222222', '3': '#333333' },
            pixels: [
                [0, 0, 3],
                [1, 0, 1],
            ],
        }
        const { grid, palette } = weaponArtToGrids(SHARED)
        expect(palette[1]).toBe('#111111')
        expect(palette[2]).toBe('#222222')
        expect(palette[3]).toBe('#333333')
        expect(grid[0][0]).toBe(3) // 不因为"先出现"被重编号成 1
        expect(grid[0][1]).toBe(1)
    })

    it('姿势块不写 palette（取图时继承）：编辑器仍按同一套下标落座', () => {
        WEAPON_OVERLAYS[SHARED] = { palette: { '1': '#111111', '3': '#333333' }, pixels: [[0, 0, 3]] }
        WEAPON_ARTS[SHARED] = { idle: { pixels: [[1, 1, 3]] } }
        const { grid, poses, palette } = weaponArtToGrids(SHARED)
        expect(palette[3]).toBe('#333333')
        expect(grid[0][0]).toBe(3)
        // 姿势块里的 3 指向同一套下标（通用图那份 palette）
        expect(poses.idle[1][1]).toBe(3)
    })
})

describe('编辑器武器图初值（initialWeaponView）', () => {
    it('没有存档：全部来自文件', () => {
        const view = initialWeaponView(null, 'peach_sword')
        const file = weaponArtToGrids('peach_sword')
        expect(view.id).toBe('peach_sword')
        expect(view.grid).toEqual(file.grid)
        expect(view.palette).toEqual(file.palette)
        for (const pose of POSE_NAMES) expect(view.poses[pose]).toEqual(file.poses[pose])
    })

    it('老存档（没有 poses）：逐姿势回落到文件，不再被清空；通用图仍用存档那张', () => {
        // 文件里 idle 有图（素手无相就是这种：通用 = 白玉环、idle = 护甲）
        WEAPON_OVERLAYS[SHARED] = { pixels: [[0, 0, '#ff0000']] }
        WEAPON_ARTS[SHARED] = { idle: { pixels: [[1, 1, '#00ff00']] } }
        const file = weaponArtToGrids(SHARED)

        const grid = blankPixelMap(32, 32)
        grid[5][5] = 1 // 存档里那张通用图（自带的调色板 #123456）
        const view = initialWeaponView(save({ id: SHARED, grid, palette: ['', '#123456'], poses: {} }), SHARED)

        // 症状回归：老存档以前会把 idle 清空 → 按钮显示「未」、画布空白
        expect(gridHasPixels(view.poses.idle)).toBe(true)
        expect(view.poses.idle[1][1]).toBe(view.palette.indexOf('#00ff00'))
        for (const pose of POSE_NAMES) expect(view.poses[pose]).toEqual(file.poses[pose])
        // 通用图保留存档里那张，且颜色正确（下标重映射到合成调色板）
        expect(view.palette[view.grid[5][5]]).toBe('#123456')
    })

    it('存档已有姿势：用存档的，缺的那几个才回落文件', () => {
        WEAPON_OVERLAYS[SHARED] = { pixels: [[0, 0, '#ff0000']] }
        WEAPON_ARTS[SHARED] = { idle: { pixels: [[1, 1, '#00ff00']] }, attack: { pixels: [[2, 2, '#0000ff']] } }

        const own = blankPixelMap(32, 32)
        own[7][7] = 1
        const view = initialWeaponView(
            save({ id: SHARED, grid: blankPixelMap(32, 32), palette: ['', '#abcdef'], poses: { idle: own } }),
            SHARED,
        )

        expect(view.palette[view.poses.idle[7][7]]).toBe('#abcdef') // 存档画的 → 存档的颜色
        expect(gridHasPixels(view.poses.attack)).toBe(true) // 存档没画 → 文件里的
        expect(view.palette[view.poses.attack[2][2]]).toBe('#0000ff')
    })

    it('存档里六个姿势全空（被老逻辑清空后又自动存下来的）：也回落到文件', () => {
        WEAPON_OVERLAYS[SHARED] = { pixels: [[0, 0, '#ff0000']] }
        WEAPON_ARTS[SHARED] = { idle: { pixels: [[1, 1, '#00ff00']] } }
        const blank = (): ReturnType<typeof blankPixelMap> => blankPixelMap(32, 32)
        const view = initialWeaponView(
            save({
                id: SHARED,
                grid: blank(),
                palette: ['', '#ff0000'],
                poses: Object.fromEntries(POSE_NAMES.map((pose) => [pose, blank()])),
            }),
            SHARED,
        )
        expect(gridHasPixels(view.poses.idle)).toBe(true)
        expect(view.palette[view.poses.idle[1][1]]).toBe('#00ff00')
    })

    it('存档调色板里文件没有的颜色会追加，且不改变文件原有下标', () => {
        WEAPON_OVERLAYS[SHARED] = { pixels: [[0, 0, '#ff0000']] }
        const file = weaponArtToGrids(SHARED)
        const shared = file.palette.indexOf('#ff0000')
        expect(shared).toBeGreaterThan(0)

        const grid = blankPixelMap(32, 32)
        grid[0][0] = 1 // 存档调色板下标 1 = #ff0000（文件里也有）
        grid[1][1] = 2 // 存档调色板下标 2 = #123456（文件里没有）
        const view = initialWeaponView(
            save({ id: SHARED, grid, palette: ['', '#ff0000', '#123456'], poses: {} }),
            SHARED,
        )
        expect(view.palette.slice(0, file.palette.length)).toEqual(file.palette)
        // 文件里就有的颜色 → 复用文件下标，不重复追加
        expect(view.grid[0][0]).toBe(shared)
        expect(view.palette.filter((c) => c === '#ff0000')).toHaveLength(1)
        // 新增颜色 → 追加在后面
        expect(view.palette[view.grid[1][1]]).toBe('#123456')
    })
})

describe('复制 / 粘贴（canPasteInto）', () => {
    it('空剪贴板不能贴', () => {
        expect(canPasteInto(null, blankPixelMap(32, 32))).toBe(false)
        expect(canPasteInto(undefined, blankPixelMap(32, 32))).toBe(false)
        expect(canPasteInto([], blankPixelMap(32, 32))).toBe(false)
    })

    it('同尺寸能贴：武器图 → 武器图、身体帧 → 身体帧', () => {
        expect(canPasteInto(blankPixelMap(32, 32), blankPixelMap(32, 32))).toBe(true)
        expect(canPasteInto(blankPixelMap(48, 48), blankPixelMap(48, 48))).toBe(true)
    })

    it('尺寸不同不能贴（跨模式：身体帧 48×48 vs 武器图 32×32，硬贴会把画布换成错的尺寸）', () => {
        expect(canPasteInto(blankPixelMap(48, 48), blankPixelMap(32, 32))).toBe(false)
        expect(canPasteInto(blankPixelMap(32, 32), blankPixelMap(48, 48))).toBe(false)
        // 只有宽或只有高一致也不行
        expect(canPasteInto(blankPixelMap(32, 48), blankPixelMap(32, 32))).toBe(false)
        expect(canPasteInto(blankPixelMap(48, 32), blankPixelMap(32, 32))).toBe(false)
    })
})

describe('删调色板颜色：通用图 + 六个姿势图一起处理（只留空位、不重排）', () => {
    const palette = ['', '#111111', '#222222', '#333333', '#444444']
    /** 造一张只在 (0,0) 写下标的图，方便断言 */
    const withIndex = (v: number): ReturnType<typeof blankPixelMap> => {
        const g = blankPixelMap(32, 32)
        g[0][0] = v
        return g
    }
    const posesWith = (values: Partial<Record<(typeof POSE_NAMES)[number], number>>) => {
        const out: Record<string, ReturnType<typeof blankPixelMap>> = {}
        for (const pose of POSE_NAMES) out[pose] = withIndex(values[pose] ?? 0)
        return out
    }

    it('当前图在用这个颜色 → 不删', () => {
        const grid = withIndex(2)
        const poses = posesWith({})
        const res = removeWeaponPaletteColor(grid, poses, palette, 2)
        expect(res.blocked).toBe(true)
        expect(res.palette).toBe(palette)
    })

    it('别的姿势图在用这个颜色 → 也判定为"还在用"，不删', () => {
        const grid = blankPixelMap(32, 32) // 当前图完全没用
        const poses = posesWith({ buff: 2 }) // 只有某个姿势用了 2
        const res = removeWeaponPaletteColor(grid, poses, palette, 2)
        expect(res.blocked).toBe(true)
        expect(res.palette).toBe(palette)
        // 不重排就不需要返回网格：没有任何图要搬下标
        expect(res).not.toHaveProperty('grid')
        expect(res).not.toHaveProperty('poses')
    })

    it('没人在用的颜色：只把那一格留空，七张图的下标一个不动', () => {
        const grid = withIndex(4)
        const poses = posesWith({ idle: 4, attack: 2 })
        const res = removeWeaponPaletteColor(grid, poses, palette, 3)
        expect(res.blocked).toBe(false)
        expect(res.palette[3]).toBe('')
        // 还在用的 4 没有被搬到 3，2 也没动 → 七张图的下标全都原位有效
        expect(res.palette[4]).toBe('#444444')
        expect(res.palette[2]).toBe('#222222')
        expect(res.palette).toHaveLength(palette.length)
        expect(res).not.toHaveProperty('grid')
        expect(res).not.toHaveProperty('poses')
    })

    it('blocked 判定覆盖全部七张图（通用图 + 六个姿势）', () => {
        for (const pose of POSE_NAMES) {
            const poses = posesWith({})
            poses[pose][0][0] = 2
            const res = removeWeaponPaletteColor(blankPixelMap(32, 32), poses, palette, 2)
            expect(res.blocked, pose).toBe(true)
        }
        // 通用图单独在用也算
        expect(removeWeaponPaletteColor(withIndex(2), posesWith({}), palette, 2).blocked).toBe(true)
    })
})

describe('调色板工具（firstFreeSlot / samePalette）', () => {
    it('firstFreeSlot 返回第一个 >=1 的空位，没有就返回末尾', () => {
        expect(firstFreeSlot([''])).toBe(1)
        expect(firstFreeSlot(['', '#111111'])).toBe(2)
        // 删色留下的空位会被优先重新填上
        expect(firstFreeSlot(['', '#111111', '', '#333333'])).toBe(2)
        expect(firstFreeSlot(['', '#111111', '#222222'])).toBe(3)
        // 全空：第一个空位就是 1
        expect(firstFreeSlot(['', '', ''])).toBe(1)
    })

    it('samePalette 逐下标比颜色，空位按空位比', () => {
        expect(samePalette(['', '#111111'], ['', '#111111'])).toBe(true)
        expect(samePalette(['', '#111111'], ['', '#222222'])).toBe(false)
        // 空位 == 缺位（短的那份按空位补齐）
        expect(samePalette(['', '#111111'], ['', '#111111', ''])).toBe(true)
        expect(samePalette(['', '#111111'], ['', '#111111', '#222222'])).toBe(false)
        // 空位与有颜色不同
        expect(samePalette(['', ''], ['', '#111111'])).toBe(false)
    })
})
