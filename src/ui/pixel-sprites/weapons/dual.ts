/**
 * 双持（主手 + 副手各一把单手武器）与双手武器的角度规则、手部遮罩开关。
 */

import type { WeaponPoseConfig } from '../types'

/**
 * 双手武器攻击姿势的手部视觉微调（格）：
 * 主握点锚定副手（图右），主手端升 1 格、副手端降 1 格，使棍身更贴合双手。
 */

/**
 * 说明：受击（hit）时武器的"脱手"位置不再走全局位移叠加，
 * 而是直接由各武器的 hit 锚点（HAND_POINTS.hit / OTHER_HAND_POINT.hit）
 * 与该武器的 WEAPON_POSES[weaponId].hit（handX/handY/angle）决定。
 */

/**
 * 是否绘制手部覆盖（"握着"的皮肤盖片）——渲染器 / 像素预览 / 编辑器共用的唯一判定。
 *
 * 两条规则合在这里，调用方只传**已经解析好的**该姿势配置（`resolveWeaponMount` 的
 * `config`），不要再各自复制一份判断：
 * 1. hit 一律不画：武器被打飞脱手；
 * 2. `handCover: false` 不画：给"甲片本身就是手"的武器（拳套/护手类）用，
 *    那种武器的手由美术自己负责。不填 = true。
 *
 * @param pose - 当前姿势名。
 * @param cfg - 该姿势的最终配置（含 poses 基底）；缺省时按"要画"处理。
 * @returns true 表示应当在武器之上盖皮肤色手部像素。
 */
export function shouldDrawHandCover(pose: string, cfg?: Partial<WeaponPoseConfig>): boolean {
    return pose !== 'hit' && cfg?.handCover !== false
}
