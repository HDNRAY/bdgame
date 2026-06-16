/**
 * 像素模板原型 — 快速验证效果
 * npx tsx scripts/pixel-prototype.ts
 */

type Palette = Record<string, string>
type PixelMap = number[][] // 2D array of palette index

interface PixelSprite {
    palette: Palette
    /** 全身帧 */
    full: Record<string, PixelMap>
    /** 头像（脸部区域，由程序自动裁切） */
    portrait: Record<string, PixelMap>
}

// ── 通用肤色/发色/衣色 ──
const BASE_PALETTE: Palette = {
    0: 'transparent',
    1: '#2c1810', // 深棕 - 头发
    2: '#e8c49a', // 肤色
    3: '#1a1a2e', // 深蓝 - 衣1
    4: '#16213e', // 藏青 - 衣2
    5: '#0f3460', // 中蓝 - 衣3
    6: '#ffffff', // 白 - 眼白
    7: '#333333', // 深灰 - 瞳孔
    8: '#e74c3c', // 红 - 装饰/受伤
    9: '#f1c40f', // 黄 - 特效
    A: '#2ecc71', // 绿 - 特效
    B: '#9b59b6', // 紫 - 特效
}

// ── 通用男性体型的像素模板 16×16 ──
const IDLE_FRAME: PixelMap = [
    //  0 1 2 3 4 5 6 7 8 9 A B C D E F
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], // 头顶发
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], // 头发
    [0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0], // 脸
    [0, 0, 1, 2, 6, 2, 2, 6, 2, 1, 0, 0, 0, 0, 0, 0], // 眼睛
    [0, 1, 1, 2, 7, 2, 2, 7, 2, 1, 1, 0, 0, 0, 0, 0], // 眼睛+鼻子
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0], // 上身
    [0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0, 0], // 上身
    [1, 1, 4, 4, 3, 3, 3, 3, 4, 4, 1, 1, 0, 0, 0, 0], // 手臂
    [1, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 1, 0, 0, 0, 0], // 手臂
    [1, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 1, 0, 0, 0, 0], // 手臂
    [1, 1, 4, 4, 3, 3, 3, 3, 4, 4, 1, 1, 0, 0, 0, 0], // 腰
    [0, 1, 1, 0, 5, 5, 5, 5, 0, 1, 1, 0, 0, 0, 0, 0], // 腿
    [0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0], // 腿
    [0, 0, 0, 0, 5, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0], // 脚
    [0, 0, 0, 0, 5, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0], // 脚
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 地面
]

// ── 攻击姿势（前倾出手） ──
const ATTACK_FRAME: PixelMap = [
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 6, 2, 2, 6, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 2, 7, 2, 2, 7, 1, 1, 0, 0, 0, 0],
    [0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0],
    [0, 1, 1, 4, 4, 3, 3, 3, 3, 4, 4, 1, 1, 0, 0, 0],
    [0, 1, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 1, 0, 0, 0],
    [1, 1, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 1, 0, 0, 0],
    [1, 4, 4, 4, 1, 3, 3, 3, 3, 1, 4, 4, 1, 0, 0, 0],
    [1, 1, 4, 4, 0, 5, 5, 5, 5, 0, 4, 4, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 5, 5, 5, 5, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

// ── 受击姿势（后仰） ──
const HIT_FRAME: PixelMap = [
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 2, 6, 2, 2, 6, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 2, 7, 2, 2, 7, 2, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 3, 3, 3, 3, 3, 3, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 3, 3, 3, 3, 3, 3, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 4, 4, 3, 3, 3, 3, 4, 4, 1, 1, 0, 0],
    [0, 1, 1, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 1, 0, 0],
    [0, 1, 4, 4, 4, 1, 3, 3, 3, 3, 1, 4, 4, 1, 0, 0],
    [0, 1, 4, 4, 4, 1, 3, 3, 3, 3, 1, 4, 4, 1, 0, 0],
    [0, 1, 1, 4, 4, 1, 5, 5, 5, 5, 1, 4, 4, 1, 0, 0],
    [0, 0, 1, 1, 0, 0, 5, 5, 5, 5, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

// ── 武器叠加层 ──
// 在角色手部位置偏移绘制
const WEAPONS: Record<string, { pixels: [number, number, string][] }> = {
    // 刀 (在角色右侧画一条斜线)
    sword: {
        pixels: [
            [7, -4, '#c0c0c0'],
            [8, -3, '#c0c0c0'],
            [9, -2, '#c0c0c0'],
            [10, -1, '#c0c0c0'],
            [11, 0, '#c0c0c0'],
            [12, 1, '#c0c0c0'],
        ],
    },
    // 枪 (竖线)
    spear: {
        pixels: [
            [10, -6, '#8B4513'],
            [10, -5, '#8B4513'],
            [10, -4, '#8B4513'],
            [10, -3, '#8B4513'],
            [10, -2, '#8B4513'],
            [10, -1, '#8B4513'],
            [10, 0, '#8B4513'],
            [10, 1, '#8B4513'],
            [10, 2, '#8B4513'],
            [9, -7, '#c0c0c0'],
            [10, -7, '#c0c0c0'],
            [11, -7, '#c0c0c0'],
        ],
    },
    // 拳 (手部发光)
    fist: {
        pixels: [
            [8, 0, '#f1c40f'],
            [9, 0, '#f1c40f'],
            [8, 1, '#f1c40f'],
            [9, 1, '#f1c40f'],
        ],
    },
    // 三相珠 (环绕的小球)
    tri_orb: {
        pixels: [
            [5, -2, '#e74c3c'],
            [3, 1, '#3498db'],
            [7, 2, '#2ecc71'],
            [4, 3, '#e74c3c'],
            [8, -1, '#3498db'],
        ],
    },
    // 斩铁 (大太刀)
    zantetsu: {
        pixels: [
            [8, -6, '#1a1a2e'],
            [9, -5, '#1a1a2e'],
            [10, -4, '#1a1a2e'],
            [11, -3, '#1a1a2e'],
            [12, -2, '#1a1a2e'],
            [13, -1, '#1a1a2e'],
            [14, 0, '#1a1a2e'],
            [9, -7, '#ffd700'],
            [8, -7, '#ffd700'], // 护手
        ],
    },
}

// ── Buff 图标 6×6 ──
const BUFF_ICONS: Record<string, { palette: Palette; pixels: PixelMap }> = {
    iaijutsu: {
        palette: { 0: 'transparent', 1: '#ffd700', 2: '#fff', 3: '#333' },
        pixels: [
            [0, 1, 1, 1, 1, 0],
            [1, 3, 3, 3, 3, 1],
            [1, 3, 2, 2, 3, 1],
            [1, 3, 2, 2, 3, 1],
            [1, 3, 3, 3, 3, 1],
            [0, 1, 1, 1, 1, 0],
        ],
    },
    paralyze_immunity: {
        palette: { 0: 'transparent', 1: '#3498db', 2: '#f1c40f', 3: '#fff' },
        pixels: [
            [0, 0, 1, 1, 0, 0],
            [0, 1, 2, 2, 1, 0],
            [1, 2, 3, 3, 2, 1],
            [1, 2, 3, 3, 2, 1],
            [0, 1, 2, 2, 1, 0],
            [0, 0, 1, 1, 0, 0],
        ],
    },
    thunder_constitution: {
        palette: { 0: 'transparent', 1: '#2ecc71', 2: '#27ae60', 3: '#fff' },
        pixels: [
            [0, 1, 1, 1, 1, 0],
            [1, 2, 2, 2, 2, 1],
            [1, 2, 3, 0, 0, 1],
            [1, 2, 0, 3, 0, 1],
            [1, 2, 2, 2, 2, 1],
            [0, 1, 1, 1, 1, 0],
        ],
    },
    cinnabar_mark: {
        palette: { 0: 'transparent', 1: '#e74c3c', 2: '#c0392b', 3: '#f1c40f' },
        pixels: [
            [0, 1, 1, 1, 1, 0],
            [1, 2, 2, 2, 2, 1],
            [1, 2, 3, 3, 2, 1],
            [1, 2, 3, 3, 2, 1],
            [1, 2, 2, 2, 2, 1],
            [0, 1, 1, 1, 1, 0],
        ],
    },
}

// ── 渲染 ──
function renderPixel(
    map: PixelMap,
    palette: Palette,
    scale: number,
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
) {
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const color = palette[map[y][x].toString(16).toUpperCase()]
            if (!color || color === 'transparent') continue
            ctx.fillStyle = color
            ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale)
        }
    }
}

function renderWeapon(weaponId: string, ctx: CanvasRenderingContext2D, ox: number, oy: number, scale: number) {
    const w = WEAPONS[weaponId]
    if (!w) return
    for (const [px, py, color] of w.pixels) {
        ctx.fillStyle = color
        ctx.fillRect(ox + px * scale, oy + py * scale, scale, scale)
    }
}

// ── 主渲染 ──
const canvas = new OffscreenCanvas(1200, 600)
const ctx = canvas.getContext('2d')!

const S = 3 // 每个像素 3px
const frames: Record<string, PixelMap> = { idle: IDLE_FRAME, attack: ATTACK_FRAME, hit: HIT_FRAME }

ctx.clearRect(0, 0, 1200, 600)

// 标题
ctx.fillStyle = '#333'
ctx.font = 'bold 20px sans-serif'
ctx.fillText('像素模板原型', 20, 30)

// ── 三个姿势 ──
const poses = ['idle', 'attack', 'hit']
ctx.font = '14px sans-serif'
for (let i = 0; i < poses.length; i++) {
    const px = 40 + i * 220
    ctx.fillStyle = '#666'
    ctx.fillText(poses[i], px, 60)
    renderPixel(frames[poses[i]], BASE_PALETTE, S, ctx, px, 70)
}

// ── 武器叠加演示 ──
ctx.fillStyle = '#333'
ctx.font = 'bold 16px sans-serif'
ctx.fillText('武器叠加 (idle 姿势)', 40, 170)

const weaponList = ['sword', 'spear', 'fist', 'tri_orb', 'zantetsu']
for (let i = 0; i < weaponList.length; i++) {
    const px = 40 + i * 220
    ctx.fillStyle = '#666'
    ctx.font = '14px sans-serif'
    ctx.fillText(weaponList[i], px, 200)
    renderPixel(IDLE_FRAME, BASE_PALETTE, S, ctx, px, 210)
    renderWeapon(weaponList[i], ctx, px, 210, S)
}

// ── Buff 图标演示 ──
ctx.fillStyle = '#333'
ctx.font = 'bold 16px sans-serif'
ctx.fillText('Buff 图标 (6×6 放大4倍)', 40, 370)

const bufY = 390
let bx = 40
for (const [id, icon] of Object.entries(BUFF_ICONS)) {
    ctx.fillStyle = '#666'
    ctx.font = '12px sans-serif'
    ctx.fillText(id, bx, bufY - 10)
    renderPixel(icon.pixels, icon.palette, 4, ctx, bx, bufY)
    bx += 60
}

// ── 头像裁切区域演示（裁脸部区域 8×8） ──
ctx.fillStyle = '#333'
ctx.font = 'bold 16px sans-serif'
ctx.fillText('头像 (脸部裁切 ×4)', 40, 490)

// 裁脸：从 IDLE_FRAME 的第3行开始取8行
const FACE_CROP_Y = 2
const FACE_SIZE = 8
for (let i = 0; i < 3; i++) {
    const px = 40 + i * 100
    const pose = poses[i]
    ctx.fillStyle = '#666'
    ctx.font = '12px sans-serif'
    ctx.fillText(poses[i], px, 520)
    const faceMap = frames[pose].slice(FACE_CROP_Y, FACE_CROP_Y + FACE_SIZE).map((row) => row.slice(2, 10))
    renderPixel(faceMap, BASE_PALETTE, 4, ctx, px, 530)
}

// ── 输出 ──
const blob = await canvas.convertToBlob()
const buffer = await blob.arrayBuffer()
const base64 = Buffer.from(buffer).toString('base64')
console.log(`data:image/png;base64,${base64}`)
