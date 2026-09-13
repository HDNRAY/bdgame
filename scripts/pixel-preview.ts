/**
 * 像素武器预览工具（开发用，零依赖）
 *
 * 用途：把某个武器按「角色精灵 + 武器 + 手部遮罩」合成渲染成 PNG，用于逐格检查握持位置、
 * 姿势角度与配色；旋转方式与游戏一致（旋转整张位图 → 逐目标格反向采样最近邻），
 * 因此看到的就是 canvas / PixiJS 里的实际效果，不会出现逐像素取整导致的挤压或丢像素。
 *
 * 用法：
 *   npm run pixel -- <武器ID[,武器ID...]> [姿势|all] [缩放]
 *   npm run pixel -- po_lang_zhu_zhi             # 该武器 5 个姿势各一行
 *   npm run pixel -- qimei_staff,po_lang_zhu_zhi parry   # 同姿势横向对照 + 右侧原始美术
 *
 * 输出：scripts/preview/<name>.png（该目录已被 gitignore）
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
    HAND_COVER,
    LEFT_HAND_COVER,
    POSE_NAMES,
    WEAPON_OVERLAYS,
    getWeaponAngle,
    getWeaponHand,
    getWeaponPoseConfig,
    makeCharacterSprite,
    resolveWeaponPixels,
    shouldDrawHandCover,
} from '../src/ui/pixel-sprites'

/** 画布格数：与像素查看器保持一致（内容 60×48，左留 45、上留 3） */
const COLS = 120
const ROWS = 54
const OFF_X = 45
const OFF_Y = 3
/** 武器美术网格边长（constants.ts WEAPON_WIDTH/HEIGHT） */
const ART = 32
/** 合成区与右侧原始美术之间的间隔格 */
const GAP = 4

type Palette = Record<string, string>

function hexToRgb(color: string): [number, number, number] {
    const s = color.replace('#', '')
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

/** 简易像素画布（RGBA，背景棋盘格用于看透明区） */
class Grid {
    readonly data: Uint8Array
    constructor(
        readonly w: number,
        readonly h: number,
    ) {
        this.data = new Uint8Array(w * h * 4)
    }

    fill(x: number, y: number, color: string): void {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
        const [r, g, b] = hexToRgb(color)
        const i = (y * this.w + x) * 4
        this.data[i] = r
        this.data[i + 1] = g
        this.data[i + 2] = b
        this.data[i + 3] = 255
    }

    checker(bg1 = '#20242c', bg2 = '#262b34'): void {
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.fill(x, y, (x + y) % 2 ? bg1 : bg2)
    }

    /** 最近邻放大（像素画导出） */
    scaled(k: number): { w: number; h: number; rgba: Uint8Array } {
        const W = this.w * k
        const H = this.h * k
        const out = new Uint8Array(W * H * 4)
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const si = (Math.floor(y / k) * this.w + Math.floor(x / k)) * 4
                const di = (y * W + x) * 4
                out[di] = this.data[si]
                out[di + 1] = this.data[si + 1]
                out[di + 2] = this.data[si + 2]
                out[di + 3] = this.data[si + 3]
            }
        }
        return { w: W, h: H, rgba: out }
    }
}

// ── 零依赖 PNG 写出（IHDR + IDAT + IEND）──
const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c >>> 0
    }
    return t
})()

function crc32(buf: Uint8Array): number {
    let c = 0xffffffff
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
}

function writePng(path: string, w: number, h: number, rgba: Uint8Array): void {
    const stride = w * 4 + 1
    const raw = Buffer.alloc(stride * h)
    for (let y = 0; y < h; y++) {
        raw[y * stride] = 0 // filter: none
        Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1)
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(w, 0)
    ihdr.writeUInt32BE(h, 4)
    ihdr[8] = 8 // bit depth
    ihdr[9] = 6 // color type: RGBA
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', new Uint8Array()),
    ])
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, png)
}

/** 角色精灵（各姿势共用同一张 idle 身体，姿势差异只体现在武器上） */
function drawCharacter(g: Grid, charId: string, oy: number): Palette {
    const sprite = makeCharacterSprite(charId, '#4ecdc4', '#d0d0d0')
    const palette = sprite.palette
    for (let y = 0; y < sprite.frames.idle.length; y++) {
        for (let x = 0; x < sprite.frames.idle[y].length; x++) {
            const color = palette[String(sprite.frames.idle[y][x])]
            if (color && color !== 'transparent') g.fill(x + OFF_X, y + OFF_Y + oy, color)
        }
    }
    return palette
}

/** 武器 + 双手遮罩（旋转整张位图，逐目标格反向采样） */
function drawWeapon(g: Grid, weaponId: string, pose: string, oy: number, palette: Palette): void {
    const cfg = getWeaponPoseConfig(weaponId, pose)
    const hand = getWeaponHand(weaponId, pose)
    const angle = getWeaponAngle(weaponId, pose, true)
    if (shouldDrawHandCover(pose)) {
        const skin = palette['3'] ?? '#f5d6c6'
        for (const [cx, cy] of HAND_COVER[pose] ?? []) g.fill(cx + OFF_X, cy + OFF_Y + oy, skin)
        // 双手武器（或双持副手）才画第二只手
        if (cfg.grip2X !== undefined) {
            for (const [cx, cy] of LEFT_HAND_COVER[pose] ?? []) g.fill(cx + OFF_X, cy + OFF_Y + oy, skin)
        }
    }
    const art = artMap(weaponId)
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)
    const radius = Math.ceil(Math.hypot(ART, ART)) + 2
    const hx = Math.round(hand.x + OFF_X)
    const hy = Math.round(hand.y + OFF_Y)
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const ax = dx * cos - dy * sin + cfg.gripX
            const ay = dx * sin + dy * cos + cfg.gripY
            const color = art.get(`${Math.round(ax)},${Math.round(ay)}`)
            if (color) g.fill(hx + dx, hy + dy + oy, color)
        }
    }
}

/** 武器美术像素表：`x,y` → 颜色 */
function artMap(weaponId: string): Map<string, string> {
    const overlay = WEAPON_OVERLAYS[weaponId]
    const map = new Map<string, string>()
    if (!overlay) return map
    for (const [x, y, color] of resolveWeaponPixels(overlay)) map.set(`${x},${y}`, color)
    return map
}

/** 右侧原始美术（不旋转），用于看材质本身 */
function drawRawArt(g: Grid, weaponId: string, oy: number): void {
    for (const [key, color] of artMap(weaponId)) {
        const [x, y] = key.split(',').map(Number)
        g.fill(COLS + GAP + x, oy + y + Math.floor((ROWS - ART) / 2), color)
    }
}

function separator(g: Grid, w: number, oy: number): void {
    for (let x = 0; x < w; x++) g.fill(x, oy, '#3a4150')
}

/** 单武器 · 全部姿势（每姿势一行，合成图） */
function renderPoses(weaponId: string, scale: number): string {
    const poses = [...POSE_NAMES]
    const g = new Grid(COLS, ROWS * poses.length)
    g.checker()
    poses.forEach((pose, i) => {
        const oy = i * ROWS
        const palette = drawCharacter(g, 'yidao', oy)
        drawWeapon(g, weaponId, pose, oy, palette)
        separator(g, COLS, oy)
        console.log(
            `${weaponId}/${pose}: 手(${getWeaponHand(weaponId, pose).x},${getWeaponHand(weaponId, pose).y}) ` +
                `角 ${((getWeaponAngle(weaponId, pose, true) * 180) / Math.PI).toFixed(1)}°`,
        )
    })
    const img = g.scaled(scale)
    const path = resolve(`scripts/preview/${weaponId}-all.png`)
    writePng(path, img.w, img.h, img.rgba)
    return path
}

/** 多武器 · 同一姿势（横向对照：合成 + 右侧原始美术） */
function renderCompare(weaponIds: string[], pose: string, scale: number): string {
    const W = COLS + GAP + ART
    const g = new Grid(W, ROWS * weaponIds.length)
    g.checker()
    weaponIds.forEach((id, i) => {
        const oy = i * ROWS
        const palette = drawCharacter(g, 'yidao', oy)
        drawWeapon(g, id, pose, oy, palette)
        drawRawArt(g, id, oy)
        separator(g, W, oy)
        console.log(
            `${id}/${pose}: 手(${getWeaponHand(id, pose).x},${getWeaponHand(id, pose).y}) ` +
                `角 ${((getWeaponAngle(id, pose, true) * 180) / Math.PI).toFixed(1)}° 像素 ${artMap(id).size}`,
        )
    })
    const img = g.scaled(scale)
    const path = resolve(`scripts/preview/${weaponIds.join('+')}-${pose}.png`)
    writePng(path, img.w, img.h, img.rgba)
    return path
}

function main(): void {
    const [idsArg, poseArg = 'all', scaleArg = '6'] = process.argv.slice(2)
    if (!idsArg || idsArg === '--help' || idsArg === '-h') {
        console.log('用法: npm run pixel -- <武器ID[,武器ID...]> [姿势|all] [缩放]')
        console.log('可用姿势:', POSE_NAMES.join(' / '))
        console.log('已有像素图的武器:', Object.keys(WEAPON_OVERLAYS).join(', '))
        process.exit(idsArg ? 0 : 1)
    }
    const ids = idsArg.split(',').map((s) => s.trim())
    const unknown = ids.filter((id) => !WEAPON_OVERLAYS[id])
    if (unknown.length) {
        console.error('未找到武器叠加图:', unknown.join(', '))
        process.exit(1)
    }
    if (poseArg !== 'all' && !POSE_NAMES.includes(poseArg as (typeof POSE_NAMES)[number])) {
        console.error('未知姿势:', poseArg, '可用:', POSE_NAMES.join(' / '), '或 all')
        process.exit(1)
    }
    const scale = Number(scaleArg)
    if (!Number.isFinite(scale) || scale < 1) {
        console.error('缩放需为 ≥1 的数字')
        process.exit(1)
    }
    if (poseArg === 'all') {
        for (const id of ids) console.log('写出:', renderPoses(id, scale))
    } else {
        console.log('写出:', renderCompare(ids, poseArg, scale))
    }
}

main()
