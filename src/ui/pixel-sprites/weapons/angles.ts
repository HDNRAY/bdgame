/**
 * 单/双手武器的角度入口（对 resolveWeaponMount 的薄封装，渲染器与脚本用）。
 */
import { resolveWeaponMount } from './mount'
import type { WeaponSlot } from './poses'

/**
 * 武器锚定手位置：
 * - 姿势配置显式给了 handX/handY → 直接用
 * - 否则按 anchorHand（默认：单手=主手，双手=副手）查全局手部表
 */
export function getWeaponHand(weaponId: string, pose: string, slot: WeaponSlot = 'main'): { x: number; y: number } {
    return resolveWeaponMount(weaponId, pose, { slot }).hand
}

/**
 * 计算武器在给定姿势/朝向上的旋转角度（弧度）。
 * - 姿势配置显式给了 angle → 直接用（朝左取负镜像）
 * - 单手武器（无 grip2）：idle=0，attack=±45°（按朝向倾斜），锚定主手。
 * - 双手武器（有 grip2）：主握点锚定副手（左手），旋转使棍身轴线穿过主手（右手），
 *   角度 = 副手→主手连线方向角 − 武器轴线（主握点→第二握点）方向角。
 *   朝左时人物与武器水平镜像，需用镜像后的方向重新计算。
 */
export function getWeaponAngle(
    weaponId: string,
    pose: string,
    facingRight: boolean,
    slot: WeaponSlot = 'main',
): number {
    return resolveWeaponMount(weaponId, pose, { slot, facingRight }).angle
}

/** 双持时主手角度（未覆盖的姿势沿用单手规则） */
export function getDualMainAngle(weaponId: string, pose: string, facingRight: boolean): number {
    // 双持时主手也用这把武器自己的角度（不再有全局覆盖表，保证双持/不双持一致）
    return getWeaponAngle(weaponId, pose, facingRight)
}
