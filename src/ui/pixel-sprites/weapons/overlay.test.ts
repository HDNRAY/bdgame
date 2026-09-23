import { afterEach, describe, expect, it } from 'vitest'
import type { WeaponArtTable, WeaponOverlay } from '../types'
import { WEAPON_WIDTH, WEAPON_HEIGHT } from '../constants'
import { WEAPON_ARTS, WEAPON_OVERLAYS } from './entries/index'
import { POSE_NAMES } from './poses'
import { getWeaponArt, getWeaponOverlay, resolveWeaponPixels, weaponHasArt } from './overlay'

/**
 * 逐姿势取图链（art[pose] → art.idle → overlay）与向后兼容。
 *
 * 取图链读的是模块级的 WEAPON_ARTS / WEAPON_OVERLAYS，测试里直接往这两张表里塞临时武器
 * （vitest 每个测试文件是独立的模块注册表，不会污染别的文件），跑完删掉。
 */
const CHAIN = '__test_art_chain'
const ONLY_IDLE = '__test_art_only_idle'
const EMPTY = '__test_art_empty'
const TEST_IDS = [CHAIN, ONLY_IDLE, EMPTY]

afterEach(() => {
    for (const id of TEST_IDS) {
        delete WEAPON_OVERLAYS[id]
        delete WEAPON_ARTS[id]
    }
})

describe('逐姿势取图链', () => {
    it('art[pose] 命中就用它，不落 idle', () => {
        WEAPON_OVERLAYS[CHAIN] = { pixels: [[9, 9, '#999999']] }
        WEAPON_ARTS[CHAIN] = {
            idle: { pixels: [[1, 1, '#111111']] },
            attack: { pixels: [[2, 2, '#222222']] },
        }
        expect(getWeaponArt(CHAIN, 'attack')).toBe(WEAPON_ARTS[CHAIN].attack)
        expect(getWeaponArt(CHAIN, 'idle')).toBe(WEAPON_ARTS[CHAIN].idle)
        // 没画的姿势落到 idle
        expect(getWeaponArt(CHAIN, 'parry')).toBe(WEAPON_ARTS[CHAIN].idle)
        expect(getWeaponArt(CHAIN, 'move')).toBe(WEAPON_ARTS[CHAIN].idle)
    })

    it('没有 art 时逐姿势结果就是 overlay 本身（引用相等）', () => {
        WEAPON_OVERLAYS[CHAIN] = { pixels: [[9, 9, '#999999']] }
        for (const pose of [...POSE_NAMES, 'move']) {
            expect(getWeaponArt(CHAIN, pose)).toBe(WEAPON_OVERLAYS[CHAIN])
        }
        expect(weaponHasArt(CHAIN)).toBe(true)
    })

    it('art 里只有 idle：所有姿势（含 move）都坍缩到 idle', () => {
        WEAPON_OVERLAYS[ONLY_IDLE] = { pixels: [] }
        WEAPON_ARTS[ONLY_IDLE] = { idle: { pixels: [[1, 1, '#111111']] } }
        for (const pose of [...POSE_NAMES, 'move']) {
            expect(getWeaponArt(ONLY_IDLE, pose)).toBe(WEAPON_ARTS[ONLY_IDLE].idle)
        }
        expect(weaponHasArt(ONLY_IDLE)).toBe(true)
    })

    it('空对象 / 空 pixels 视为「没有」，继续往下塌到 overlay', () => {
        WEAPON_OVERLAYS[EMPTY] = { pixels: [[9, 9, '#999999']] }
        WEAPON_ARTS[EMPTY] = {
            attack: { pixels: [] },
            idle: {} as WeaponOverlay,
        }
        for (const pose of [...POSE_NAMES, 'move']) {
            expect(getWeaponArt(EMPTY, pose)).toBe(WEAPON_OVERLAYS[EMPTY])
        }
        // 姿势图全空，但通用图本身有像素 —— 这把武器仍算「有美术」
        expect(weaponHasArt(EMPTY)).toBe(true)
    })

    it('逐级都没像素时返回 undefined；未知武器也是 undefined', () => {
        WEAPON_ARTS[EMPTY] = { attack: { pixels: [] } }
        expect(getWeaponArt(EMPTY, 'attack')).toBeUndefined()
        expect(weaponHasArt(EMPTY)).toBe(false)
        expect(getWeaponArt('__no_such_weapon', 'idle')).toBeUndefined()
        expect(weaponHasArt('__no_such_weapon')).toBe(false)
    })

    it('武器整体没有美术时 weaponHasArt 为 false（空手也一样）', () => {
        expect(weaponHasArt('bare_hands')).toBe(false)
    })
})

describe('向后兼容：没有 art 的武器逐像素不变', () => {
    it('所有武器 × 六姿势：解析结果与 WEAPON_OVERLAYS[id] 一致', () => {
        const ids = Object.keys(WEAPON_OVERLAYS)
        expect(ids.length).toBeGreaterThan(0)

        for (const id of ids) {
            const base = WEAPON_OVERLAYS[id]
            const basePixels = resolveWeaponPixels(base)
            const art: WeaponArtTable | undefined = WEAPON_ARTS[id]
            const hasArt = Boolean(art && Object.keys(art).length > 0 && Object.values(art).some((ov) => ov && ov.pixels.length > 0))

            for (const pose of POSE_NAMES) {
                const got = getWeaponArt(id, pose)
                if (!hasArt) {
                    // 没有 art 字段的武器：结果必须与改动前的取图入口逐像素（且同一个对象）一致
                    if (basePixels.length > 0) {
                        expect(got, `${id}.${pose} 应是同一个 overlay 对象`).toBe(base)
                        expect(resolveWeaponPixels(got as WeaponOverlay), `${id}.${pose}`).toEqual(basePixels)
                    } else {
                        expect(got, `${id}.${pose} 应为「没有可画像素」`).toBeUndefined()
                    }
                    // getWeaponOverlay（旧入口）的解析结果也不变
                    expect(resolveWeaponPixels(getWeaponOverlay(id)), `${id}.${pose} overlay`).toEqual(basePixels)
                    continue
                }

                // 有 art 的武器：取图链 art[pose] → art.idle → overlay 里第一个可画的块
                // （块自己的像素没变；只是姿势块没写 palette 时取到的是继承共用那份后的**新对象**，
                //  所以引用相等不再成立，要比逐像素。）
                const chain = [art?.[pose], art?.idle, base].filter(
                    (ov): ov is WeaponOverlay => Boolean(ov && Array.isArray(ov.pixels) && ov.pixels.length > 0),
                )
                const picked = chain[0]
                if (got === undefined) {
                    expect(picked, `${id}.${pose} 取图链应全空`).toBeUndefined()
                    continue
                }
                expect(picked, `${id}.${pose} 应有可画的那一块`).toBeDefined()
                // 逐像素一致：给没写 palette 的块兜上这把武器共用那份再解析
                const pickedPalette = picked!.palette ?? base.palette
                expect(resolveWeaponPixels(got), `${id}.${pose} 像素`).toEqual(
                    resolveWeaponPixels({ ...picked!, palette: pickedPalette }),
                )
                // 姿势块没写 palette → 取到的块 palette 就是该武器 overlay 的那份（内容相同）
                if (picked!.palette === undefined) {
                    expect(got.palette, `${id}.${pose} 应继承武器共用调色板`).toBe(WEAPON_OVERLAYS[id].palette)
                }
            }
        }
    })

    it('未知武器：getWeaponArt 返回 undefined，getWeaponOverlay 仍回退到空手（空像素）', () => {
        expect(getWeaponArt('__no_such_weapon', 'idle')).toBeUndefined()
        expect(resolveWeaponPixels(getWeaponOverlay('__no_such_weapon'))).toEqual([])
    })
})

describe('武器美术的下标约定', () => {
    it('没有武器把颜色写在下标 0 上（0 是「空」的保留号）', () => {
        // 0 在编辑器里就是"没画"（blankPixelMap 填 0、gridHasPixels 判 v > 0、导出只写 v > 0），
        // 帧格式的槽位 0 也是透明。写在 0 上的颜色编辑器显示不出来，导出还会被当空格子丢掉。
        for (const overlay of Object.values(WEAPON_OVERLAYS)) {
            expect(Object.keys(overlay.palette ?? {})).not.toContain('0')
            expect(overlay.pixels.some(([, , color]) => color === 0)).toBe(false)
        }
        for (const [id, table] of Object.entries(WEAPON_ARTS)) {
            for (const [pose, block] of Object.entries(table)) {
                if (!block) continue
                expect(Object.keys(block.palette ?? {}), `${id}.${pose}`).not.toContain('0')
                expect(block.pixels.some(([, , color]) => color === 0), `${id}.${pose}`).toBe(false)
            }
        }
    })
})

describe('武器美术的坐标约定', () => {
    it('每个像素坐标都是 0..31 的整数（半格坐标会把像素编辑器打崩）', () => {
        // 轴向几何里 x = (s + d) / 2、y = (s - d) / 2 —— s 与 d 奇偶不一致就会得到 .5 的坐标。
        // 这种数据渲染时看着还行（被取整），但编辑器是 grid[y][x] 直接落座：x 是小数 → 抛
        // "Cannot set properties of undefined (setting '23.5')" → 整页白屏。
        const bad: string[] = []
        const check = (id: string, where: string, pixels: readonly (readonly [number, number, unknown])[]) => {
            for (const [x, y] of pixels) {
                if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= WEAPON_WIDTH || y < 0 || y >= WEAPON_HEIGHT) {
                    bad.push(`${id}.${where} [${x}, ${y}]`)
                }
            }
        }
        for (const [id, overlay] of Object.entries(WEAPON_OVERLAYS)) check(id, 'overlay', overlay.pixels)
        for (const [id, table] of Object.entries(WEAPON_ARTS)) {
            for (const [pose, block] of Object.entries(table)) if (block) check(id, pose, block.pixels)
        }
        expect(bad).toEqual([])
    })
})
