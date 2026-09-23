import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PixelEditor } from './PixelEditor'
import { PalettePanel } from './editor/PalettePanel'

/** 取出导出文本框里的文本（HTML 转义还原一下，断言更直观） */
function exportText(html: string): string {
    const m = /pixel-editor-textarea--export"[^>]*>([\s\S]*?)<\/textarea>/.exec(html)
    return (m?.[1] ?? '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
}

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
        // 复制 / 粘贴按钮在工具栏（挨着撤销重做）；用 </button> 收尾以区分「复制片段」那种导出按钮
        expect(html).toContain('>撤销</button>')
        expect(html).toContain('>重做</button>')
        expect(html).toContain('>复制</button>')
        expect(html).toContain('>粘贴</button>')
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

    it('六个姿势按钮 + 清空都在；有姿势图时导出 art 块（空的姿势不写）', () => {
        stored = JSON.stringify(weaponState())
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('清空本站势')
        expect(html).not.toContain('复制当前→其它')
        expect(html).toContain('>通用<')
        expect(html).toContain('>idle<span')
        expect(html).toContain('>buff<span')
        // 当前槽 idle 已画 → 导出 art 块；attack 是空的 → 不写
        const text = exportText(html)
        expect(text).toContain('// weapons/entries/peach_sword.ts → art:')
        expect(text).toContain('    idle: {')
        expect(text).toContain('        pixels: [')
        expect(text).not.toContain('    attack: {')
        // 片段只给像素：不写 palette（调色板走「复制调色板」按钮），下标沿用文件里的号不重编号
        expect(text).not.toContain('palette:')
        expect(text).not.toContain('const PALETTE')
        expect(text).toContain('[0, 0, 8],')
    })

    it('武器模式的复制按钮只有两个：当前条目 / 调色板（整块的「复制片段」只在身体帧模式）', () => {
        stored = JSON.stringify(weaponState())
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).not.toContain('>复制片段</button>')
        expect(html).toContain('>复制当前条目</button>')
        expect(html).toContain('>复制调色板</button>')
        // 代码框里给的是像素，调色板不在里面（要调色板请点「复制调色板」）
        expect(exportText(html)).not.toContain('const PALETTE')
    })

    it('老存档（没有 poses）+ 文件里也没有逐姿势美术：六个姿势仍空，导出 overlay 块', () => {
        const legacy = weaponState()
        const weapon = { ...(legacy.weapon as Record<string, unknown>) }
        delete weapon.poses
        delete weapon.pose
        weapon.grid = [
            [0, 1],
            [0, 0],
        ]
        legacy.weapon = weapon
        stored = JSON.stringify(legacy)
        const html = renderToStaticMarkup(<PixelEditor />)
        const text = exportText(html)
        expect(text).toContain('// weapons/entries/peach_sword.ts → overlay:')
        expect(text).toContain('overlay: {')
        expect(text).toContain('    pixels: [')
        // 下标沿用文件里的号（存档那支新色补在下标 8），不重编号
        expect(text).toContain('[1, 0, 8],')
        expect(text).not.toContain('→ art:')
        expect(text).not.toContain('palette:')
    })

    it('老存档（没有 poses）不再清空逐姿势美术：改从文件取图（素手无相 idle 有画）', () => {
        const legacy = weaponState()
        const weapon = { ...(legacy.weapon as Record<string, unknown>) }
        delete weapon.poses
        delete weapon.pose
        weapon.id = 'iron_back_hand'
        legacy.weapon = weapon
        stored = JSON.stringify(legacy)
        const html = renderToStaticMarkup(<PixelEditor />)
        // 回归：以前这里会把六个姿势一律清空 → 按钮显示「未」
        expect(html).toContain('>idle<span class="pixel-editor-pose-mark">已<')
        // 老存档没有 pose 字段 → 落在通用图槽（默认 base），所以导出的是 overlay 块
        expect(html).toContain('// weapons/entries/iron_back_hand.ts → overlay:')
    })

    it('复制片段跟着当前槽：在通用图导出 overlay 块，不是 idle 的 art 块', () => {
        // 存档里 idle 有画（所以旧逻辑会导出 art 块），但当前槽是通用图
        const s = weaponState()
        const weapon = { ...(s.weapon as Record<string, unknown>) }
        weapon.pose = 'base'
        s.weapon = weapon
        stored = JSON.stringify(s)
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('// weapons/entries/peach_sword.ts → overlay:')
        expect(html).not.toContain('→ art:')
    })

    it('在姿势槽、但一个姿势都没画：退回 overlay 块（那张图本来就来自通用图）', () => {
        const s = weaponState()
        const weapon = { ...(s.weapon as Record<string, unknown>) }
        weapon.pose = 'idle'
        weapon.poses = { idle: [[0, 0], [0, 0]], attack: [[0, 0], [0, 0]] }
        s.weapon = weapon
        stored = JSON.stringify(s)
        const html = renderToStaticMarkup(<PixelEditor />)
        expect(html).toContain('// weapons/entries/peach_sword.ts → overlay:')
        expect(html).not.toContain('→ art:')
    })
})

describe('调色板面板 · 空位（下标留着但没颜色）', () => {
    const noop = () => {}
    const propsFor = (weaponPalette: string[]) => ({
        mode: 'weapon' as const,
        slotList: weaponPalette.map((_, i) => i).filter((i) => i > 0),
        slot: 1,
        selectSlot: noop,
        colorOf: (v: number) => weaponPalette[v],
        weaponPalette,
        effectiveColors: { skin: '#000000', hair: '#000000', eyes: '#000000', accent: '#000000', decoration: '#000000' },
        charId: 'yidao',
        setCharId: noop,
        colorOverridden: false,
        missingSlots: [],
        fixedSlotOverrides: {},
        setFixedSlotOverrides: noop,
        setColorOverrides: noop,
        setStatus: noop,
        copy: noop,
        setWeaponColorAt: noop,
        removeWeaponColor: noop,
        addWeaponColor: noop,
        previewWeaponId: 'peach_sword',
        setPreviewWeaponId: noop,
    })

    it('空位被过滤掉：不渲染色块，只显示有颜色的下标', () => {
        const html = renderToStaticMarkup(<PalettePanel {...propsFor(['', '#ff0000', '', '#00ff00'])} />)
        // 下标 2 是空位 → 整格不出现（连 title 都没有）
        expect(html).not.toContain('下标 2')
        expect(html).not.toContain('空位')
        // 有颜色的 1 / 3 照常显示，各自带删除按钮与取色器
        expect(html).toContain('颜色 1（#ff0000）')
        expect(html).toContain('颜色 3（#00ff00）')
        expect(html.match(/删掉这个颜色/g)).toHaveLength(2)
        expect(html.match(/type="color"/g)).toHaveLength(2)
    })

    it('全是空位时一个色块都不渲染（列表为空，只剩「+ 加色」）', () => {
        const html = renderToStaticMarkup(<PalettePanel {...propsFor(['', '', ''])} />)
        expect(html).not.toContain('pixel-editor-swatch-wrap')
        expect(html).toContain('加一个颜色')
    })
})
