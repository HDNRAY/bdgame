/**
 * 编译期守卫：编辑器「武器挂点」导出的片段必须能原样粘进 `weapons.ts`。
 *
 * 这个文件没有运行时作用（不被任何模块 import，不进包），只用来让 `tsc` 每次检查
 * 导出片段的形状：`off` 子表、相对偏移（handDX/handDY、targetDX/targetDY）、
 * 角度、翻转、anchorHand 字符串、第二握点……
 *
 * 历史坑：`WeaponPoseTable` 曾写成 `Record<string, WeaponPoseConfig> & { off?: ... }`，
 * 交叉类型自相矛盾 —— 只要片段里带 `off` 块，粘贴就报类型错（而库里当时没有一把武器
 * 带 off，所以 tsc 一直是绿的）。现在类型改成显式姿势键，并由本文件钉死。
 */
import { WEAPON_POSES, type WeaponPoseTable } from './weapons'
import type { WeaponPoseConfig } from './types'

// 与 weapons.ts 里的 makePoses 同签名
function makePoses(base: WeaponPoseConfig): Record<string, WeaponPoseConfig> {
    return { idle: { ...base }, attack: { ...base } }
}

/** 形如编辑器导出的片段：基底 + 逐姿势覆盖 + 副手槽 off 块 */
export const poseSnippetShape: Record<string, WeaponPoseTable> = {
    example_single_hand: {
        ...makePoses({ gripX: 24, gripY: 24, handDX: 0.5, handDY: -0.5 }),
        idle: { gripX: 24, gripY: 24, handDX: 0.5, handDY: -0.5 },
        attack: { gripX: 24, gripY: 24, handDX: 0, handDY: -1 },
        parry: { gripX: 24, gripY: 24, angle: 2.6857, handDX: 0, handDY: 0 },
        off: {
            ...makePoses({ gripX: 24, gripY: 24 }),
            attack: { gripX: 24, gripY: 24, angle: (-12 * Math.PI) / 180, handDX: 2, handDY: 1 },
        },
    },
    example_two_handed: {
        ...makePoses({ gripX: 21.3, gripY: 22, grip2X: 38.3, grip2Y: 39, flip: true }),
        idle: { gripX: 21.3, gripY: 22, grip2X: 38.3, grip2Y: 39, flip: true, handDY: 1, targetDY: 1 },
        hit: { gripX: 7, gripY: 7, grip2X: 24, grip2Y: 24, angle: (-125 * Math.PI) / 180, handDX: -19.5 },
    },
    example_floating: {
        ...makePoses({ gripX: 9, gripY: 22, noHandCover: true }),
        idle: { gripX: 9, gripY: 22, noHandCover: true, angle: (-37 * Math.PI) / 180 },
        buff: { gripX: 9, gripY: 22, noHandCover: true, anchorHand: 'main', angle: 0 },
    },
}

void WEAPON_POSES
void poseSnippetShape
