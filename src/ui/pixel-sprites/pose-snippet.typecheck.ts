/**
 * 编译期守卫：编辑器导出的片段必须能原样粘进 `weapons/entries/<武器>.ts` 这个**武器文件**里。
 *
 * 这个文件没有运行时作用（不被任何模块 import，不进包），只用来让 `tsc` 每次检查
 * 片段形状：`overlay:` / `poses:` 两块、`off` 子表、相对偏移（handDX/handDY、targetDX/targetDY）、
 * 角度、翻转、anchorHand 字符串、第二握点……
 *
 * 历史坑：`WeaponPoseTable` 曾写成 `Record<string, WeaponPoseConfig> & { off?: ... }`，
 * 交叉类型自相矛盾 —— 只要片段里带 `off` 块，粘贴就报类型错（而库里当时没有一把武器
 * 带 off，所以 tsc 一直是绿的）。现在类型改成显式姿势键，并由本文件钉死。
 */
import { WEAPON_POSES, type WeaponPoseTable } from './weapons'
import type { WeaponPoseConfig, WeaponOverlay } from './types'

// 与 weapons/poses.ts 里的 makePoses 同签名
function makePoses(base: Partial<WeaponPoseConfig>): Record<string, Partial<WeaponPoseConfig>> {
    return { idle: { ...base }, attack: { ...base } }
}

/** 武器文件的形状：overlay（美术）+ poses（挂点） */
export interface WeaponFileShape {
    overlay?: WeaponOverlay
    poses: WeaponPoseTable
}

/** 形如编辑器导出的完整武器文件：overlay 块 + poses 块（含逐姿势覆盖与副手槽 off 块） */
export const weaponFileShape: Record<string, WeaponFileShape> = {
    example_single_hand: {
        overlay: { palette: { '1': '#ffffff' }, pixels: [[0, 0, 1]] },
        poses: {
            ...makePoses({ gripX: 24, gripY: 24, handDX: 0.5, handDY: -0.5 }),
            attack: { gripX: 24, gripY: 24, handDY: -1 },
            parry: { gripX: 24, gripY: 24, angle: 2.6857 },
            off: {
                ...makePoses({ gripX: 24, gripY: 24 }),
                attack: { gripX: 24, gripY: 24, angle: (-12 * Math.PI) / 180, handDX: 2, handDY: 1 },
            },
        },
    },
    example_two_handed: {
        poses: {
            // 双手长兵：显式 anchorHand: 'off'（锚副手 = 另一只手也在杆上）+ 每姿势显式角度
            ...makePoses({ gripX: 21, gripY: 21.7, flip: true, anchorHand: 'off' }),
            idle: { angle: (135 * Math.PI) / 180 },
            attack: { gripDX: 2.8, gripDY: 2.1, angle: 2.397837, handDY: 0.5 },
            hit: { gripDX: -14, gripDY: -14.7, angle: (-125 * Math.PI) / 180 },
        },
    },
    example_floating: {
        poses: {
            ...makePoses({ gripX: 9, gripY: 22 }),
            idle: { gripX: 9, gripY: 22, angle: (-37 * Math.PI) / 180 },
            buff: { gripX: 9, gripY: 22, anchorHand: 'main', angle: 0 },
        },
    },
}

void WEAPON_POSES
void weaponFileShape
