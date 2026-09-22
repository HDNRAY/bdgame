import { describe, expect, it } from 'vitest'
import { OTHER_HAND_POINT } from './weapons'
import { parseEditorState, serializeEditorState } from './editor-storage'
import type { PixelEditorSavedState } from './editor-storage'
import { blankPixelMap } from './frame-io'

const base = (): PixelEditorSavedState => ({
    mode: 'frame',
    frame: { map: blankPixelMap(4, 3), constName: 'DEFAULT_BUFF', poseName: 'buff', sourceKey: 'buff' },
    weapon: { id: 'xiu_dong', grid: blankPixelMap(32, 32), palette: ['', '#ffffff'] },
    colorOverrides: {},
    fixedSlotOverrides: {},
    mountConfigs: { xiu_dong: { main: {}, off: {} } },
    tool: 'pen',
    slot: 1,
    mirror: false,
    showGrid: true,
    showAnchors: true,
    manualZoom: null,
})

describe('编辑器存档', () => {
    it('往返一致', () => {
        const s = base()
        s.frame.map[1][2] = 9
        s.weapon.grid[3][4] = 2
        s.manualZoom = 12
        s.colorOverrides = { yidao: { hair: '#123456' } }
        s.fixedSlotOverrides = { 9: '#00ff00' }
        s.mountConfigs = {
            xiu_dong: {
                main: { attack: { gripX: 21.5, gripY: 22.5, angle: -0.7854, handCover: false } },
                off: { idle: { gripX: 21.5, gripY: 22.5, handX: 41, handY: 32, handCover: true } },
            },
        }
        const back = parseEditorState(serializeEditorState(s))
        expect(back).not.toBeNull()
        expect(back!.frame.map[1][2]).toBe(9)
        expect(back!.weapon.grid[3][4]).toBe(2)
        expect(back!.manualZoom).toBe(12)
        expect(back!.weapon.palette).toEqual(['', '#ffffff'])
        expect(back!.colorOverrides.yidao.hair).toBe('#123456')
        expect(back!.fixedSlotOverrides[9]).toBe('#00ff00')
        expect(back!.mountConfigs.xiu_dong.main.attack.angle).toBeCloseTo(-0.7854, 6)
        // 手部覆盖是布尔字段，与 flip 同级：往返不能丢
        expect(back!.mountConfigs.xiu_dong.main.attack.handCover).toBe(false)
        expect(back!.mountConfigs.xiu_dong.off.idle.handCover).toBe(true)
        // 旧格式的绝对坐标会在载入时归一化成相对偏移（绝对坐标被丢弃）
        expect(back!.mountConfigs.xiu_dong.off.idle.handX).toBeUndefined()
        expect(back!.mountConfigs.xiu_dong.off.idle.handDX).toBeCloseTo(41 - OTHER_HAND_POINT.idle.x, 6)
    })

    it('缺字段 / 坏数据 / 空串一律返回 null（回到默认，而不是半截脏数据）', () => {
        expect(parseEditorState(null)).toBeNull()
        expect(parseEditorState('')).toBeNull()
        expect(parseEditorState('not json')).toBeNull()
        expect(parseEditorState('[]')).toBeNull()
        expect(parseEditorState('{}')).toBeNull()
        const s = base() as unknown as Record<string, unknown>
        s.mode = 'nope'
        expect(parseEditorState(JSON.stringify(s))).toBeNull()
        const s2 = base() as unknown as Record<string, unknown>
        s2.tool = 'laser'
        expect(parseEditorState(JSON.stringify(s2))).toBeNull()
        const s3 = base()
        s3.frame.map = [[0, 0], [0]] as never // 行不等长
        expect(parseEditorState(serializeEditorState(s3))).toBeNull()
        const s4 = base()
        s4.weapon.palette = [1, 2] as never
        expect(parseEditorState(serializeEditorState(s4))).toBeNull()
        const s5 = base()
        s5.slot = -1
        expect(parseEditorState(serializeEditorState(s5))).toBeNull()
        const s6 = base()
        s6.colorOverrides = { yidao: { hair: 'red' } } as never
        expect(parseEditorState(serializeEditorState(s6))).toBeNull()
        const s7 = base()
        s7.fixedSlotOverrides = { 9: 'gold' } as never
        expect(parseEditorState(serializeEditorState(s7))).toBeNull()
        const s8 = base()
        s8.mountConfigs = { xiu_dong: { main: { attack: { gripX: 'x' } } } } as never
        expect(parseEditorState(serializeEditorState(s8))).toBeNull()
        // 非法槽位名
        const s9 = base()
        s9.mountConfigs = { xiu_dong: { middle: {} } } as never
        expect(parseEditorState(serializeEditorState(s9))).toBeNull()
    })
})

describe('编辑器存档 · 旧版挂点配置迁移', () => {
    it('v1 的「武器 → 姿势 → 配置」（没有槽位层）载入后归到主手槽', () => {
        const legacy = {
            mode: 'mount',
            frame: { map: [[0, 0]], constName: 'X', poseName: 'idle', sourceKey: 'idle' },
            weapon: { id: 'xiu_dong', grid: [[0, 0]], palette: [''] },
            colorOverrides: {},
            fixedSlotOverrides: {},
            mountConfigs: { xiu_dong: { attack: { gripX: 21.5, angle: -0.5 } } },
            tool: 'pen',
            slot: 1,
            mirror: false,
            showGrid: true,
            showAnchors: true,
            manualZoom: null,
        }
        const parsed = parseEditorState(JSON.stringify(legacy))
        expect(parsed).not.toBeNull()
        expect(parsed!.mountConfigs.xiu_dong.main.attack.angle).toBeCloseTo(-0.5, 6)
        expect(parsed!.mountConfigs.xiu_dong.off).toEqual({})
    })
})

describe('编辑器存档 · 逐姿势美术', () => {
    it('逐姿势图 + 当前槽位往返一致（六张图共用同一份 palette）', () => {
        const s = base()
        s.weapon.poses = { idle: blankPixelMap(4, 3), attack: blankPixelMap(4, 3) }
        s.weapon.poses.attack[1][2] = 3
        s.weapon.pose = 'attack'
        const back = parseEditorState(serializeEditorState(s))
        expect(back).not.toBeNull()
        expect(back!.weapon.pose).toBe('attack')
        expect(back!.weapon.poses?.attack[1][2]).toBe(3)
        expect(back!.weapon.poses?.idle[1][2]).toBe(0)
        // 通用图与调色板都不受影响
        expect(back!.weapon.grid).toEqual(s.weapon.grid)
        expect(back!.weapon.palette).toEqual(['', '#ffffff'])
    })

    it('老存档（只有一张图、没有 poses / pose）载入后 = 那张图是通用图，不崩不丢', () => {
        const raw = base() as unknown as Record<string, unknown>
        const weapon = { ...(raw.weapon as Record<string, unknown>) }
        delete weapon.poses
        delete weapon.pose
        ;(weapon.grid as number[][])[3][4] = 2
        raw.weapon = weapon
        const back = parseEditorState(JSON.stringify(raw))
        expect(back).not.toBeNull()
        expect(back!.weapon.grid[3][4]).toBe(2)
        expect(back!.weapon.poses).toEqual({})
        expect(back!.weapon.pose).toBe('base')
    })

    it('非法姿势名 / 坏网格 / 非法当前槽一律 null', () => {
        const s1 = base()
        s1.weapon.poses = { nope: blankPixelMap(4, 3) } as never
        expect(parseEditorState(serializeEditorState(s1))).toBeNull()
        const s2 = base()
        s2.weapon.poses = { idle: [[0, 0], [0]] } as never
        expect(parseEditorState(serializeEditorState(s2))).toBeNull()
        const s3 = base()
        s3.weapon.pose = 'laser'
        expect(parseEditorState(serializeEditorState(s3))).toBeNull()
        const s4 = base()
        s4.weapon.poses = [] as never
        expect(parseEditorState(serializeEditorState(s4))).toBeNull()
    })
})
