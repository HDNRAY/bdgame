/**
 * 双持（主手 + 副手各一把单手武器）与双手武器的角度规则、手部遮罩开关。
 */

/**
 * 双手武器攻击姿势的手部视觉微调（格）：
 * 主握点锚定副手（图右），主手端升 1 格、副手端降 1 格，使棍身更贴合双手。
 */
/**
 * 双持（主手 + 副手各一把单手武器）的角度规则。
 * 机制上一次只出一招：主手挥击、副手保持握持待机 —— 副手取「同向轻前倾」，
 * 招架（parry）时两把武器在身前交叉（数值为初值，可在像素查看器里看后微调）。
 */
export const DUAL_MAIN_ANGLE: Record<string, number> = {
    // 招架：主手向前上方，与副手交叉
    parry: (100 * Math.PI) / 180,
    // 受击：主手武器被打飞时的朝向（0 = 保持原角度）
    hit: (20 * Math.PI) / 180 }

export const DUAL_OFFHAND_ANGLE: Record<string, number> = {
    idle: 0,
    // 攻击：副手同向轻前倾（-12°），比待机更"备战"但不与主手抢戏
    attack: (-12 * Math.PI) / 180,
    dodge: 0,
    hit: (58 * Math.PI) / 180,
    move: 0,
    // 招架：副手向前下方，与主手交叉
    parry: (-10 * Math.PI) / 180 }


/** 双持时副手角度（锚定副手 OTHER_HAND_POINT） */
export function getDualOffhandAngle(pose: string, facingRight: boolean): number {
    const a = DUAL_OFFHAND_ANGLE[pose] ?? 0
    return facingRight ? a : -a
}

/**
 * 说明：受击（hit）时武器的"脱手"位置不再走全局位移叠加，
 * 而是直接由各武器的 hit 锚点（HAND_POINTS.hit / OTHER_HAND_POINT.hit）
 * 与该武器的 WEAPON_POSES[weaponId].hit（handX/handY/angle）决定。
 */

/** 是否绘制手部覆盖：hit 时武器脱手，不再画"握着"的皮肤盖片 */
export function shouldDrawHandCover(pose: string): boolean {
    return pose !== 'hit'
}
