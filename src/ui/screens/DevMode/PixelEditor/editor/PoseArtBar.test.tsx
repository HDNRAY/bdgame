import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { POSE_NAMES } from '../../../../pixel-sprites'
import { PoseArtBar } from './PoseArtBar'

const noop = () => {}

/** 取某个按钮的 class（按按钮文字定位；按钮上还有「已 / 未」标记） */
function buttonClass(html: string, label: string): string {
    const m = html.match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*>${label}`))
    return m?.[1] ?? ''
}

function render(current: string, filled: Record<string, boolean>, baseFilled: boolean): string {
    return renderToStaticMarkup(
        <PoseArtBar
            current={current}
            filled={filled}
            baseFilled={baseFilled}
            onSelect={noop}
            onCopyToOthers={noop}
            onClearCurrent={noop}
        />,
    )
}

describe('PoseArtBar（武器图逐姿势工具条）', () => {
    it('通用 + 六个姿势 + 两个批量动作都在', () => {
        const html = render('idle', { idle: true }, false)
        expect(html).toContain('>通用<')
        for (const pose of POSE_NAMES) expect(html).toContain(pose)
        expect(html).toContain('复制当前→其它')
        expect(html).toContain('清空本站势')
    })

    it('已画的槽带 filled 样式与「已」标记，未画的带「未」', () => {
        const html = render('idle', { idle: true, attack: false }, false)
        expect(buttonClass(html, 'idle')).toContain('active')
        expect(buttonClass(html, 'idle')).toContain('filled')
        expect(buttonClass(html, 'attack')).not.toContain('filled')
        expect(buttonClass(html, '通用')).not.toContain('filled')
        expect(html).toContain('已')
        expect(html).toContain('未')
    })

    it('当前槽的按钮是 active（通用图也可以是当前槽）', () => {
        expect(buttonClass(render('attack', {}, false), 'attack')).toContain('active')
        expect(buttonClass(render('base', {}, true), '通用')).toContain('active')
        expect(buttonClass(render('base', {}, true), '通用')).toContain('filled')
    })
})
