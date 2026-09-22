import { describe, expect, it } from 'vitest'
import { HAND_COVER, LEFT_HAND_COVER } from './weapons'
import { dragHandOffset } from './frame-edit'
import {
    DUAL_OFFHAND_ANGLE,
    baseAnchorHand,
    handCoverTables,
    HAND_POINTS,
    OTHER_HAND_POINT,
    POSE_NAMES,
    WEAPON_POSES,
    getWeaponHand,
    getWeaponPoseConfig,
    resolveWeaponMount,
} from './weapons'

/** 临时摘掉某武器的 off 子表，测完还原（避免测试依赖"库里有没有人登记副手"） */
function withoutOffTable<T>(weaponId: string, fn: () => T): T {
    const table = WEAPON_POSES[weaponId]
    const backup = table.off
    delete table.off
    try {
        return fn()
    } finally {
        if (backup) table.off = backup
    }
}

describe('武器槽位：主手 / 副手', () => {
    it('副手默认 = 全局副手手位 + DUAL_OFFHAND_ANGLE（未登记 off 的单手武器）', () => {
        withoutOffTable('peach_sword', () => {
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
    })

    it('登记了 off 子表 → 用 off 表，且不再走副手默认', () => {
        const withOff = Object.keys(WEAPON_POSES).filter((id) => Object.keys(WEAPON_POSES[id].off ?? {}).length > 0)
        // 库里至少要有武器登记过副手，否则这条覆盖是空的（提醒：别把 off 数据删了）
        expect(withOff.length).toBeGreaterThan(0)
        for (const id of withOff) {
            for (const pose of POSE_NAMES) {
                const m = resolveWeaponMount(id, pose, { slot: 'off' })
                const cfg = getWeaponPoseConfig(id, pose, 'off')
                expect(m.usingOffhandDefault, `${id}/${pose}`).toBe(false)
                // 生效握点 = 武器握点（基底）+ 该姿势的握点偏移
                expect(m.gripX, `${id}/${pose}`).toBeCloseTo(cfg.gripX + (cfg.gripDX ?? 0), 6)
                expect(m.gripY, `${id}/${pose}`).toBeCloseTo(cfg.gripY + (cfg.gripDY ?? 0), 6)
            }
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
        withoutOffTable('qimei_staff', () => {
            const main = resolveWeaponMount('qimei_staff', 'idle', { slot: 'main' })
            const off = resolveWeaponMount('qimei_staff', 'idle', { slot: 'off' })
            expect(off.usingOffhandDefault).toBe(true)
            expect(off.hand).toEqual(main.hand)
            expect(off.angle).toBeCloseTo(main.angle, 6)
        })
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
        withoutOffTable('peach_sword', () => {
            const base = resolveWeaponMount('peach_sword', 'idle', { slot: 'off' })
            const idle = WEAPON_POSES.peach_sword.idle
            if (!idle) throw new Error('peach_sword.idle 缺失')
            const shifted = resolveWeaponMount('peach_sword', 'idle', {
                slot: 'off',
                config: { ...idle, handDX: -3, handDY: 1 },
            })
            expect(shifted.hand).toEqual({ x: OTHER_HAND_POINT.idle.x - 3, y: OTHER_HAND_POINT.idle.y + 1 })
            expect(base.hand).toEqual(OTHER_HAND_POINT.idle)
        })
    })

    it('getWeaponHand/Angle 的 slot 参数与 resolver 一致', () => {
        for (const pose of POSE_NAMES) {
            const off = resolveWeaponMount('xiu_dong', pose, { slot: 'off' })
            expect(getWeaponHand('xiu_dong', pose, 'off')).toEqual(off.hand)
            expect(resolveWeaponMount('xiu_dong', pose, { slot: 'off' }).angle).toBeCloseTo(off.angle, 6)
        }
    })
})

describe('编辑器拖动折算与手部遮罩选择', () => {
    it('副手槽拖动按副手基准折算：位移 1:1，不产生"基准差"跳跃', () => {
        const cfg = {} // 副手默认：手位 = OTHER_HAND_POINT
        const offBase = OTHER_HAND_POINT.idle // (46.5, 32)
        const mainBase = HAND_POINTS.idle // (37, 32)
        // 从副手默认位置拖 +2 / -1
        const off = dragHandOffset(cfg, 'idle', 'off', offBase, 2, -1)
        expect(off).toEqual({ handDX: 2, handDY: -1 })
        // 按错基准（主手）会多出 9.5 的横向偏移 —— 这正是之前"一拖就跳"的原因
        const wrong = dragHandOffset(cfg, 'idle', 'main', offBase, 2, -1)
        expect(wrong.handDX).toBeCloseTo(2 + (offBase.x - mainBase.x), 6)
        // 拖动后的落点 = 起点 + 位移
        const moved = { ...cfg, ...off }
        const m = resolveWeaponMount('peach_sword', 'idle', { slot: 'off', config: moved })
        expect(m.hand).toEqual({ x: offBase.x + 2, y: offBase.y - 1 })
    })

    it('副手基准必须等于「副手默认」落点（每个姿势，含带 DUAL_ATTACK_ADJUST 的 attack）', () => {
        // 用「未登记 off」的武器测默认路径（库里已有几把登记过副手）
        withoutOffTable('peach_sword', () => {
            for (const pose of POSE_NAMES) {
                const base = baseAnchorHand({}, pose, 'off')
                const defaultMount = resolveWeaponMount('peach_sword', pose, { slot: 'off' })
                expect(defaultMount.hand, `off/${pose}`).toEqual(base)
                // 也等于全局副手手位（attack 不再叠加双手连线用的修正）
                expect(base).toEqual(OTHER_HAND_POINT[pose])
            }
        })
    })

    it('副手槽拖动：偏移量 == 拖动位移（基准与默认落点一致，不掺基准差）', () => {
        withoutOffTable('peach_sword', () => {
            for (const pose of POSE_NAMES) {
                const cfg = WEAPON_POSES.peach_sword[pose] ?? WEAPON_POSES.peach_sword.idle ?? {}
                const start = resolveWeaponMount('peach_sword', pose, { slot: 'off' }).hand
                // 副手槽基准必须正好等于默认落点 → 拖动位移原样进偏移
                expect(baseAnchorHand(cfg, pose, 'off'), `off/${pose}`).toEqual(start)
                expect(dragHandOffset(cfg, pose, 'off', start, 2, -1), `off/${pose}`).toEqual({ handDX: 2, handDY: -1 })
            }
        })
    })

    it('主手槽拖动：偏移量 == 起点相对基准 + 拖动位移（每个姿势都成立）', () => {
        for (const pose of POSE_NAMES) {
            const cfg = WEAPON_POSES.peach_sword[pose] ?? WEAPON_POSES.peach_sword.idle ?? {}
            const start = resolveWeaponMount('peach_sword', pose, { slot: 'main' }).hand
            const base = baseAnchorHand(cfg, pose, 'main')
            expect(dragHandOffset(cfg, pose, 'main', start, 2, -1), `main/${pose}`).toEqual({
                handDX: start.x - base.x + 2,
                handDY: start.y - base.y - 1,
            })
        }
    })

    it('手部遮罩按槽位互换：主手槽盖主手、副手槽盖副手', () => {
        const main = handCoverTables('main')
        expect(main.primary).toBe(HAND_COVER)
        expect(main.secondary).toBe(LEFT_HAND_COVER)
        const off = handCoverTables('off')
        expect(off.primary).toBe(LEFT_HAND_COVER)
        expect(off.secondary).toBe(HAND_COVER)
    })
})
