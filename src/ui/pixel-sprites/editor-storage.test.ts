import { describe, expect, it } from 'vitest'
import { parseEditorState, serializeEditorState } from './editor-storage'
import type { PixelEditorSavedState } from './editor-storage'
import { blankPixelMap } from './frame-io'

const base = (): PixelEditorSavedState => ({
    mode: 'frame',
    frame: { map: blankPixelMap(4, 3), constName: 'DEFAULT_BUFF', poseName: 'buff', sourceKey: 'buff' },
    weapon: { id: 'xiu_dong', grid: blankPixelMap(32, 32), palette: ['', '#ffffff'] },
    colorOverrides: {},
    fixedSlotOverrides: {},
    mountConfigs: {},
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
        s.mountConfigs = { xiu_dong: { attack: { gripX: 21.5, gripY: 22.5, angle: -0.7854 } } }
        const back = parseEditorState(serializeEditorState(s))
        expect(back).not.toBeNull()
        expect(back!.frame.map[1][2]).toBe(9)
        expect(back!.weapon.grid[3][4]).toBe(2)
        expect(back!.manualZoom).toBe(12)
        expect(back!.weapon.palette).toEqual(['', '#ffffff'])
        expect(back!.colorOverrides.yidao.hair).toBe('#123456')
        expect(back!.fixedSlotOverrides[9]).toBe('#00ff00')
        expect(back!.mountConfigs.xiu_dong.attack.angle).toBeCloseTo(-0.7854, 6)
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
        s8.mountConfigs = { xiu_dong: { attack: { gripX: 'x' } } } as never
        expect(parseEditorState(serializeEditorState(s8))).toBeNull()
    })
})
