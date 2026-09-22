import { afterEach, describe, expect, it } from 'vitest'
import { POSE_NAMES, WEAPON_ARTS, WEAPON_OVERLAYS } from '../../../../pixel-sprites'
import { gridHasPixels, weaponArtToGrids } from './utils'

const SHARED = '__test_art_shared_palette'

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
})
