import { describe, expect, it } from 'vitest'
import {
    DUAL_OFFHAND_ANGLE,
    HAND_POINTS,
    OTHER_HAND_POINT,
    POSE_NAMES,
    WEAPON_POSES,
    getWeaponHand,
    getWeaponPoseConfig,
    resolveWeaponMount,
} from './weapons'

describe('武器槽位：主手 / 副手', () => {
    it('副手默认 = 全局副手手位 + DUAL_OFFHAND_ANGLE（单手武器）', () => {
        for (const pose of POSE_NAMES) {
            const m = resolveWeaponMount('peach_sword', pose, { slot: 'off' })
            expect(m.usingOffhandDefault).toBe(true)
            expect(m.hand).toEqual(OTHER_HAND_POINT[pose])
            expect(m.hand).not.toEqual(HAND_POINTS[pose])
            expect(m.angle).toBeCloseTo((DUAL_OFFHAND_ANGLE[pose] ?? 0) + (m.flip ? Math.PI : 0), 6)
            // 握柄沿用主手表（武器图里握哪一格不该因为槽位而变）
            expect(m.gripX).toBe(getWeaponPoseConfig('peach_sword', pose).gripX)
        }
    })

    it('主手不受影响（与旧行为一致）：手位取主手、attack 仍 -45°', () => {
        const idle = resolveWeaponMount('peach_sword', 'idle', { slot: 'main' })
        expect(idle.hand).toEqual(HAND_POINTS.idle)
        expect(idle.angle).toBe(0)
        expect(idle.usingOffhandDefault).toBe(false)
        expect(resolveWeaponMount('peach_sword', 'attack', { slot: 'main' }).angle).toBeCloseTo(-Math.PI / 4, 6)
    })

    it('武器登记了 off 子表 → 用它的配置，不再走副手默认', () => {
        const backup = WEAPON_POSES.peach_sword.off
        try {
            WEAPON_POSES.peach_sword.off = {
                idle: { gripX: 24, gripY: 24, handX: 10, handY: 20, angle: 0.5 },
            }
            const m = resolveWeaponMount('peach_sword', 'idle', { slot: 'off' })
            expect(m.usingOffhandDefault).toBe(false)
            expect(m.hand).toEqual({ x: 10, y: 20 })
            expect(m.angle).toBeCloseTo(0.5, 6)
        } finally {
            WEAPON_POSES.peach_sword.off = backup
        }
    })

    it('双手武器挂副手槽 → 沿用主手配置（本来就锚副手）', () => {
        const main = resolveWeaponMount('qimei_staff', 'idle', { slot: 'main' })
        const off = resolveWeaponMount('qimei_staff', 'idle', { slot: 'off' })
        expect(off.usingOffhandDefault).toBe(true)
        expect(off.hand).toEqual(main.hand)
        expect(off.angle).toBeCloseTo(main.angle, 6)
        expect(off.grip2X).toBe(main.grip2X)
    })

    it('相对偏移：handDX/handDY 叠加在基准上；绝对值优先于偏移', () => {
        const base = resolveWeaponMount('peach_sword', 'idle', { slot: 'main' })
        const shifted = resolveWeaponMount('peach_sword', 'idle', {
            config: { ...WEAPON_POSES.peach_sword.idle, handDX: 2, handDY: -1.5 },
        })
        expect(shifted.hand).toEqual({ x: base.hand.x + 2, y: base.hand.y - 1.5 })
        const absolute = resolveWeaponMount('peach_sword', 'idle', {
            config: { ...WEAPON_POSES.peach_sword.idle, handDX: 2, handDY: -1.5, handX: 10, handY: 20 },
        })
        expect(absolute.hand).toEqual({ x: 10, y: 20 })
    })

    it('副手槽的相对偏移叠在全局副手手位上', () => {
        const base = resolveWeaponMount('peach_sword', 'idle', { slot: 'off' })
        const shifted = resolveWeaponMount('peach_sword', 'idle', {
            slot: 'off',
            config: { ...WEAPON_POSES.peach_sword.idle, handDX: -3, handDY: 1 },
        })
        expect(shifted.hand).toEqual({ x: OTHER_HAND_POINT.idle.x - 3, y: OTHER_HAND_POINT.idle.y + 1 })
        expect(base.hand).toEqual(OTHER_HAND_POINT.idle)
    })

    it('getWeaponHand/Angle 的 slot 参数与 resolver 一致', () => {
        for (const pose of POSE_NAMES) {
            const off = resolveWeaponMount('xiu_dong', pose, { slot: 'off' })
            expect(getWeaponHand('xiu_dong', pose, undefined, 'off')).toEqual(off.hand)
            expect(resolveWeaponMount('xiu_dong', pose, { slot: 'off' }).angle).toBeCloseTo(off.angle, 6)
        }
    })
})
