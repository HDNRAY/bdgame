import { afterEach, describe, expect, it } from 'vitest'
import type { WeaponArtTable, WeaponOverlay } from '../types'
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

                // 有 art 的武器：逐姿势取到的必须是 art[pose] / art.idle / overlay 三者之一
                const candidates = [art?.[pose], art?.idle, base].filter((ov): ov is WeaponOverlay => Boolean(ov))
                if (got === undefined) {
                    expect(candidates.every((ov) => ov.pixels.length === 0), `${id}.${pose}`).toBe(true)
                } else {
                    expect(candidates, `${id}.${pose}`).toContain(got)
                }
            }
        }
    })

    it('未知武器：getWeaponArt 返回 undefined，getWeaponOverlay 仍回退到空手（空像素）', () => {
        expect(getWeaponArt('__no_such_weapon', 'idle')).toBeUndefined()
        expect(resolveWeaponPixels(getWeaponOverlay('__no_such_weapon'))).toEqual([])
    })
})
