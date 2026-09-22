/**
 * 双持（主手 + 副手各一把单手武器）与双手武器的角度规则、手部遮罩开关。
 */

/**
 * 双手武器攻击姿势的手部视觉微调（格）：
 * 主握点锚定副手（图右），主手端升 1 格、副手端降 1 格，使棍身更贴合双手。
 */

/**
 * 说明：受击（hit）时武器的"脱手"位置不再走全局位移叠加，
 * 而是直接由各武器的 hit 锚点（HAND_POINTS.hit / OTHER_HAND_POINT.hit）
 * 与该武器的 WEAPON_POSES[weaponId].hit（handX/handY/angle）决定。
 */

/** 是否绘制手部覆盖：hit 时武器脱手，不再画"握着"的皮肤盖片 */
export function shouldDrawHandCover(pose: string): boolean {
    return pose !== 'hit'
}
