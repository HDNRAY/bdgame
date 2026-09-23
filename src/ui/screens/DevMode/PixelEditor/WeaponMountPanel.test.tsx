import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WeaponMountPanel } from './WeaponMountPanel'
import { HAND_POINTS, OTHER_HAND_POINT } from '../../../pixel-sprites'

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
        expect(html).toContain('武器共用')
        expect(html).toContain('本姿势')
        expect(html).toContain('握点 X')
        expect(html).toContain('握点 Y')
        expect(html).toContain('握点偏移 X')
        expect(html).toContain('握点偏移 Y')
        expect(html).toContain('挂点偏移 X')
        expect(html).toContain('复制挂点片段')
        // 手部覆盖：本槽位共用 + 本姿势两处（与「镜像」同级）
        expect(html.match(/<span>手部覆盖<\/span>/g)).toHaveLength(2)
        expect(html).toContain('>不覆盖</option>')
        // 槽位切换
        // 默认选中玄铁重剑（非 one_handed）→ 没有副手槽，槽位切换整行不显示
        expect(html).not.toContain('>副手</button>')
        expect(html).toMatch(/<summary[^>]*>查看挂点代码<\/summary>/)
    })

    it('长柄武器不显示副手槽；单手武器才显示，且副手槽下「锚定手」禁用并说明原因', () => {
        const twoHand = renderToStaticMarkup(
            <WeaponMountPanel configs={{}} onChange={() => {}} charId="yidao" setStatus={() => {}} initialWeaponId="qimei_staff" />,
        )
        expect(twoHand).not.toContain('>副手</button>')
        const oneHand = renderToStaticMarkup(
            <WeaponMountPanel configs={{}} onChange={() => {}} charId="yidao" setStatus={() => {}} initialWeaponId="xiu_dong" initialSlot="off" />,
        )
        expect(oneHand).toContain('>副手</button>')
        expect(oneHand).toContain('副手槽的落点固定用全局副手手位')
        expect(oneHand).toContain('<span>锚定手</span><select disabled')
    })


    it('副手槽的改动会导出成 off 块（与主手同一套压缩规则）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{
                    // 单手武器才有副手槽（绣冬）
                    xiu_dong: {
                        main: {},
                        off: { idle: { gripX: 25, gripY: 25, handX: 41, handY: 32, angle: 0 } },
                    },
                }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
                initialWeaponId="xiu_dong"
            />,
        )
        expect(html).toContain('off: {')
        // 副手默认继承主手的武器握点；只有副手自己声明了不同的握点才会写出来（这里 off.idle 显式给了 25,25）
        const dx = 41 - OTHER_HAND_POINT.idle.x
        const dy = 32 - OTHER_HAND_POINT.idle.y
        const parts = ['angle: 0']
        if (dx) parts.push(`handDX: ${dx}`)
        if (dy) parts.push(`handDY: ${dy}`)
        expect(html).toContain(`idle: { ${parts.join(', ')} }`)
    })

    it('非单手武器不导出 off 块（即使编辑器里残留了副手覆盖）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{ iron_spear: { main: {}, off: { idle: { handDX: 1 } } } }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
                initialWeaponId="iron_spear"
            />,
        )
        expect(html).not.toContain('off: {')
        const oneHand = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{ xiu_dong: { main: {}, off: { idle: { handDX: 1 } } } }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
                initialWeaponId="xiu_dong"
            />,
        )
        expect(oneHand).toContain('off: {')
    })

    it('姿势只写了偏移时，登记值里的角度不丢（回归）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{ iron_spear: { main: { idle: { gripDY: 1 } }, off: {} } }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
                initialWeaponId="iron_spear"
            />,
        )
        // 铁枪 parry 的登记角度是烘焙进文件的显式值，姿势覆盖里没写角度 → 导出必须带上
        expect(html).toMatch(/parry: \{[^}]*angle:/)
    })

    it('改过的配置会体现在导出片段里（attack 单独列出）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{
                    dark_iron_sword: {
                        main: {
                            idle: { gripX: 25, gripY: 25 },
                            attack: { gripX: 25, gripY: 25, handX: 30.5, handY: 31, angle: -0.0762 },
                        },
                        off: {},
                    },
                }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
            />,
        )
        // attack 单独列出，手位写成「相对基准的偏移」（绝对坐标 handX/handY 被折算掉）
        expect(html).toContain('attack: {')
        expect(html).toContain(`handDX: ${30.5 - HAND_POINTS.attack.x}`)
        expect(html).toContain(`handDY: ${31 - HAND_POINTS.attack.y}`)
        expect(html).toContain('angle: -0.0762')
    })

    it('手部覆盖开关会导出：本槽位共用进基底，姿势覆盖单独写（与 flip 同一套压缩规则）', () => {
        const html = renderToStaticMarkup(
            <WeaponMountPanel
                configs={{
                    dark_iron_sword: {
                        main: { idle: { gripX: 25, gripY: 25, handCover: false }, attack: { handCover: true } },
                        off: {},
                    },
                }}
                onChange={() => {}}
                charId="yidao"
                setStatus={() => {}}
            />,
        )
        expect(html).toContain('handCover: false')
        // attack 条目里带上它自己的覆盖值（同一条目还可能有登记值折算出的偏移，所以用正则）
        expect(html).toMatch(/attack: \{[^}]*handCover: true/)
    })
})
