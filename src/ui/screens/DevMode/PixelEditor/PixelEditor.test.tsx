import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PixelEditor } from './PixelEditor'

/**
 * 渲染冒烟测试：编辑器渲染期一旦抛错（访问 undefined、函数签名变了等）这里立刻红。
 * 只做静态渲染（不跑 useEffect，画布绘制不在覆盖范围内）。
 */
describe('PixelEditor 渲染冒烟', () => {
    // node 环境没有 window，而主题为 'system' 时会读 window.matchMedia —— 给个最小替身
    beforeAll(() => {
        vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    })
    afterAll(() => {
        vi.unstubAllGlobals()
    })

    it('渲染出画布、工具栏、调色板、导入导出与信息面板', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('pixel-editor-canvas')
        expect(html).toContain('pixel-editor-readout')
        expect(html).toContain('调色板')
        expect(html).toContain('载入粘贴')
        expect(html).toContain('复制片段')
        expect(html).toContain('pixel-editor-info')
    })

    it('两种模式都在（身体帧 / 武器）', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('身体帧')
        expect(html).toContain('武器')
    })

    it('调色板不露出受击星光，金边名字简化', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).not.toContain('受击星光')
        expect(html).toContain('金边')
        expect(html).not.toContain('爆气金边（光环）')
    })

    it('金边只有一层（没有圈数输入）', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('加金边')
        expect(html).not.toContain('pixel-editor-num')
    })

    it('编辑的是源图（48×48），导出片段可直接替换常量', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('48×48')
        expect(html).toContain('export const DEFAULT_BUFF: PixelMap = [')
    })

    it('支持切换画布底板色系（含游戏浅色底/深色底与自定义）', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('pixel-editor-backdrop')
        expect(html).toContain('游戏浅色底')
        expect(html).toContain('游戏深色底')
        expect(html).toContain('自定义')
    })

    it('画布尺寸显式写死（CSS = 缓冲，1:1 不被拉伸），并带「适应」按钮', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toMatch(/<canvas width="\d+" height="\d+" style="width:\d+px;height:\d+px" class="pixel-editor-canvas"/)
        expect(html).toContain('适应')
    })

    it('说明文字进了 tooltip（面板标题带 title）', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toMatch(/<h3 title="[^"]+">导入 \/ 导出<\/h3>/)
        expect(html).toMatch(/<h3 title="[^"]+">调色板<\/h3>/)
        // 锚点面板折叠起来，省右栏高度
        expect(html).toMatch(/<details class="pixel-editor-panel"[^>]*><summary/)
    })
})
