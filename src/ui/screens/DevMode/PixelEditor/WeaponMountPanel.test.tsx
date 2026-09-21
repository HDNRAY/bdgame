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
        expect(html).toContain('锚点手 X')
        expect(html).toContain('目标手 X')
        expect(html).toContain('复制挂点片段')
        expect(html).toMatch(/<summary[^>]*>查看挂点代码<\/summary>/)
    })

    it('改过的配置会体现在导出片段里（attack 单独列出）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{ dark_iron_sword: { attack: { gripX: 25, gripY: 25, handX: 30.5, handY: 31, angle: -0.0762 } } }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
            />,
        )
        expect(html).toContain('attack: { gripX: 25, gripY: 25, handX: 30.5, handY: 31, angle: -0.0762 },')
    })
})
