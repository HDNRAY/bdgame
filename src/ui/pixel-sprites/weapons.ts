/** 武器叠加层 */

import type { WeaponOverlay } from './types'

/** 各体型右手位置（16×16 坐标空间） */
export const HAND_POINTS: Record<string, { x: number; y: number }> = {
    default: { x: 11, y: 8 },
}

export const WEAPON_OVERLAYS: Record<string, WeaponOverlay> = {
    bare_hands: { pixels: [], gripX: 0, gripY: 0 },
    fist: {
        gripX: 8,
        gripY: 0,
        pixels: [
            [8, 0, '#ffd700'],
            [9, 0, '#ffd700'],
        ],
    },
    sword: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [8, 3, '#e8e8e8'],
            [9, 3, '#e8e8e8'],
            [9, 4, '#d0d0d0'],
            [10, 4, '#e8e8e8'],
            [10, 5, '#d0d0d0'],
            [11, 6, '#d0d0d0'],
            [7, 7, '#b8860b'],
            [8, 7, '#daa520'],
            [9, 7, '#b8860b'],
        ],
    },
    spear: {
        gripX: 10,
        gripY: 6,
        pixels: [
            [10, 3, '#996633'],
            [10, 4, '#996633'],
            [10, 5, '#996633'],
            [10, 6, '#996633'],
            [10, 7, '#996633'],
            [9, 2, '#e0e0e0'],
            [10, 2, '#e0e0e0'],
            [11, 2, '#e0e0e0'],
        ],
    },
    twin_swords: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [5, 4, '#e8e8e8'],
            [6, 4, '#e8e8e8'],
            [6, 5, '#d0d0d0'],
            [7, 5, '#d0d0d0'],
            [7, 6, '#d0d0d0'],
            [9, 4, '#e8e8e8'],
            [10, 4, '#e8e8e8'],
            [10, 5, '#d0d0d0'],
            [11, 6, '#d0d0d0'],
            [5, 7, '#b8860b'],
            [9, 7, '#b8860b'],
        ],
    },
    zantetsu: {
        gripX: 9,
        gripY: 7,
        pixels: [
            [9, 0, '#3a3a3a'],
            [10, 1, '#3a3a3a'],
            [10, 2, '#4a4a4a'],
            [11, 2, '#3a3a3a'],
            [11, 3, '#4a4a4a'],
            [12, 4, '#3a3a3a'],
            [12, 5, '#4a4a4a'],
            [13, 6, '#3a3a3a'],
            [8, 7, '#ffd700'],
            [9, 7, '#ffed4e'],
            [10, 7, '#ffd700'],
        ],
    },
    ciyuan_blade: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [7, 2, '#b366ff'],
            [8, 3, '#b366ff'],
            [8, 4, '#a855ff'],
            [9, 4, '#b366ff'],
            [9, 5, '#a855ff'],
            [10, 6, '#b366ff'],
            [7, 7, '#ffed4e'],
            [8, 7, '#ffed4e'],
        ],
    },
    overlord_blade: {
        gripX: 9,
        gripY: 7,
        pixels: [
            [9, 1, '#ff5555'],
            [10, 2, '#ff5555'],
            [10, 3, '#dd3333'],
            [11, 3, '#ff5555'],
            [11, 4, '#dd3333'],
            [12, 5, '#ff5555'],
            [12, 6, '#dd3333'],
            [8, 7, '#1a1a1a'],
            [9, 7, '#1a1a1a'],
            [10, 7, '#1a1a1a'],
        ],
    },
    tri_orb: {
        gripX: 7,
        gripY: 6,
        pixels: [
            [9, 3, '#ff6b6b'],
            [10, 3, '#ff6b6b'],
            [9, 4, '#ff6b6b'],
            [10, 4, '#e74c3c'],
            [2, 7, '#5dade2'],
            [3, 7, '#5dade2'],
            [2, 8, '#5dade2'],
            [3, 8, '#3498db'],
            [11, 7, '#52d273'],
            [12, 7, '#52d273'],
            [11, 8, '#52d273'],
            [12, 8, '#2ecc71'],
        ],
    },
    frost_twin_blades: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [5, 4, '#a8d8ff'],
            [6, 4, '#a8d8ff'],
            [6, 5, '#c9e4ff'],
            [7, 6, '#c9e4ff'],
            [9, 4, '#a8d8ff'],
            [10, 4, '#a8d8ff'],
            [10, 5, '#c9e4ff'],
            [5, 7, '#7fb3d5'],
            [9, 7, '#7fb3d5'],
        ],
    },
    heshan_sword: {
        gripX: 8,
        gripY: 7,
        pixels: [
            [8, 3, '#ffb366'],
            [9, 3, '#ffb366'],
            [9, 4, '#ff9944'],
            [10, 5, '#ffb366'],
            [10, 6, '#ff9944'],
            [7, 7, '#ff6b6b'],
            [8, 7, '#ff6b6b'],
        ],
    },
    dagger: {
        gripX: 8,
        gripY: -3,
        pixels: [
            [7, -2, '#d8d8d8'],
            [8, -1, '#d8d8d8'],
            [9, 0, '#d8d8d8'],
            [10, 1, '#d8d8d8'],
            [8, -3, '#996633'],
        ],
    },
    iron_spear: {
        gripX: 10,
        gripY: -3,
        pixels: [
            [10, -6, '#996633'],
            [10, -5, '#996633'],
            [10, -4, '#996633'],
            [10, -3, '#996633'],
            [10, -2, '#996633'],
            [10, -1, '#996633'],
            [9, -7, '#c0c0c0'],
            [11, -7, '#c0c0c0'],
        ],
    },
}

/** 根据武器 ID 获取叠加层 */
export function getWeaponOverlay(weaponId: string): WeaponOverlay {
    return WEAPON_OVERLAYS[weaponId] ?? WEAPON_OVERLAYS.bare_hands
}
