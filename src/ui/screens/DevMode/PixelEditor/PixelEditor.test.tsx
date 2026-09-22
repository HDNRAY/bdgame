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

    it('支持一键切换画笔/橡皮，并有本地存档相关入口', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('按 E 可与橡皮一键来回切')
        expect(html).toContain('右键也是擦除')
        expect(html).toContain('清存档')
    })

    it('角色配色（发色等）可改：每个角色槽位带取色器 + 配色片段导出', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('复制配色片段')
        expect(html).toContain('重置配色')
        expect(html).toMatch(/title="改「发色」的颜色[^"]*"/)
        expect(html).toMatch(/title="改「皮肤」的颜色[^"]*"/)
    })

    it('所有槽位都能改色：描边/白/金边也有取色器', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toMatch(/title="改「描边」的颜色[^"]*"/)
        expect(html).toMatch(/title="改「白」的颜色[^"]*"/)
        expect(html).toMatch(/title="改「金边」的颜色[^"]*"/)

    })

    it('说明文字进了 tooltip（面板标题带 title）', () => {
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toMatch(/<h3 title="[^"]+">导入 \/ 导出<\/h3>/)
        expect(html).toMatch(/<h3 title="[^"]+">调色板<\/h3>/)
        // 锚点面板折叠起来，省右栏高度
        expect(html).toMatch(/<details class="pixel-editor-panel"[^>]*><summary/)
    })
})

/** 武器图模式（逐姿势）的存档样本 */
function weaponState(): Record<string, unknown> {
    return {
        mode: 'weapon',
        frame: { map: [[0]], constName: 'DEFAULT_BUFF', poseName: 'buff', sourceKey: 'buff' },
        weapon: {
            id: 'peach_sword',
            grid: [[0, 0], [0, 0]],
            palette: ['', '#ff0000'],
            poses: { idle: [[1, 0], [0, 0]], attack: [[0, 0], [0, 0]] },
            pose: 'idle',
        },
        colorOverrides: {},
        fixedSlotOverrides: {},
        mountConfigs: {},
        tool: 'pen',
        slot: 1,
        mirror: false,
        showGrid: true,
        showAnchors: true,
        manualZoom: null,
    }
}

describe('PixelEditor 武器图模式 · 逐姿势美术', () => {
    let stored: string | null = null

    beforeAll(() => {
        vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
        vi.stubGlobal('localStorage', {
            getItem: () => stored,
            setItem: () => {},
            removeItem: () => {},
        })
    })
    afterAll(() => {
        vi.stubGlobal('localStorage', undefined)
        vi.unstubAllGlobals()
    })

    it('六个姿势按钮 + 复制/清空都在；有姿势图时导出 art 块（空的姿势不写）', () => {
        stored = JSON.stringify(weaponState())
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('复制当前→其它')
        expect(html).toContain('清空本站势')
        expect(html).toContain('>通用<')
        expect(html).toContain('>idle<span')
        expect(html).toContain('>buff<span')
        // 当前槽 idle 已画 → 导出 art 块；attack 是空的 → 不写
        expect(html).toContain('// weapons/entries/peach_sword.ts → art:')
        expect(html).toContain('    idle: {')
        expect(html).not.toContain('    attack: {')
        expect(html).toContain('[0, 0, 1],')
    })

    it('老存档（只有一张图）：六个姿势全空，导出 overlay 块（保持现状），不崩不丢', () => {
        const legacy = weaponState()
        const weapon = { ...(legacy.weapon as Record<string, unknown>) }
        delete weapon.poses
        delete weapon.pose
        weapon.grid = [
            [0, 2],
            [0, 0],
        ]
        legacy.weapon = weapon
        stored = JSON.stringify(legacy)
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('// weapons/entries/peach_sword.ts → overlay:')
        expect(html).toContain('overlay: {')
        expect(html).toContain('[1, 0, 1],')
        expect(html).not.toContain('→ art:')
    })
})
