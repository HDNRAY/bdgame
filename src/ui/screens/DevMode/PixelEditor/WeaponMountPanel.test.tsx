import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WeaponMountPanel } from './WeaponMountPanel'

/**
 * 武器挂点实验台的渲染冒烟：字段/按钮/片段齐全，渲染期不抛错。
 */
describe('WeaponMountPanel 渲染冒烟', () => {
    beforeAll(() => {
        vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    })
    afterAll(() => {
        vi.unstubAllGlobals()
    })

    it('渲染出合成图、六个姿势、挂点字段与导出片段', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel configs={{}} onChange={() => {}} charId="yidao" setStatus={() => {}} />,
        )
        expect(html).toContain('pixel-editor-mount-overlay')
        for (const pose of ['idle', 'attack', 'dodge', 'parry', 'hit', 'buff']) {
            expect(html, pose).toContain(`>${pose}</button>`)
        }
        expect(html).toContain('角度(度)')
        expect(html).toContain('握点 X')
        expect(html).toContain('第二握点 X')
        expect(html).toContain('挂点偏移 X')
        expect(html).toContain('目标手偏移 X')
        expect(html).toContain('复制挂点片段')
        // 槽位切换
        expect(html).toContain('>主手</button>')
        expect(html).toContain('>副手</button>')
        expect(html).toMatch(/<summary[^>]*>查看挂点代码<\/summary>/)
    })

    it('锚定手：主手槽下说明「单手武器默认锚主手」且可选；副手槽下禁用并说明原因', () => {
        const mainSlot = renderToStaticMarkup(
            <WeaponMountPanel configs={{}} onChange={() => {}} charId="yidao" setStatus={() => {}} />,
        )
        expect(mainSlot).toContain('单手武器默认锚主手')
        expect(mainSlot).not.toContain('<span>锚定手</span><select disabled')

        const offSlot = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{}}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
                initialSlot="off"
            />,
        )
        // 副手槽固定用全局副手手位 → 该选项禁用
        expect(offSlot).toContain('<span>锚定手</span><select disabled')
        expect(offSlot).toContain('副手槽的落点固定用全局副手手位')
    })

    it('副手槽的改动会导出成 off 块（与主手同一套压缩规则）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{
                    // 面板默认选中的是列表第一把武器（玄铁重剑）
                    dark_iron_sword: {
                        main: {},
                        off: { idle: { gripX: 25, gripY: 25, handX: 41, handY: 32, angle: 0 } },
                    },
                }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
            />,
        )
        expect(html).toContain('off: {')
        // 副手基准 = OTHER_HAND_POINT.idle (46.5, 32) → 41 折算成 handDX: -5.5
        expect(html).toContain('idle: { gripX: 25, gripY: 25, angle: 0, handDX: -5.5, handDY: 0 }')
    })

    it('改过的配置会体现在导出片段里（attack 单独列出）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{
                    dark_iron_sword: {
                        main: { attack: { gripX: 25, gripY: 25, handX: 30.5, handY: 31, angle: -0.0762 } },
                        off: {},
                    },
                }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
            />,
        )
        // 主手基准 = HAND_POINTS.attack (24.5, 27.5) → (30.5, 31) 折算成 handDX: 6, handDY: 3.5
        expect(html).toContain('attack: { gripX: 25, gripY: 25, angle: -0.0762, handDX: 6, handDY: 3.5 },')
    })
})
