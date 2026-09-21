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
 * 共用绘图工具见 scripts/lib/pixel-canvas.ts（与 pose-preview.ts 共用，保证渲染一致）。
 */
import { resolve } from 'node:path'
import { getWeaponAngle, getWeaponHand, makeCharacterSprite, POSE_NAMES, WEAPON_OVERLAYS } from '../src/ui/pixel-sprites'
import {
    ART,
    COLS,
    GAP,
    Grid,
    ROWS,
    artMap,
    drawRawArt,
    drawSpriteFrame,
    drawWeapon,
    separator,
    writePng,
} from './lib/pixel-canvas'

/** 角色精灵（各姿势共用同一张 idle 身体，姿势差异只体现在武器上） */
function drawCharacter(g: Grid, charId: string, oy: number) {
    return drawSpriteFrame(g, makeCharacterSprite(charId, '#4ecdc4', '#d0d0d0'), 'idle', oy)
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
