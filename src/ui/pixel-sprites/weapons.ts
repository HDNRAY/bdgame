/**
 * 武器数据与挂点解析（barrel）。
 *
 * 拆分后的结构：
 * - `weapons/hands.ts`   手部锚点 + 遮罩表（全局，按姿势）
 * - `weapons/poses.ts`   姿势名 / 表类型 / makePoses
 * - `weapons/mount.ts`   挂点解析（resolveWeaponMount 等）
 * - `weapons/dual.ts`    双持与双手角度规则
 * - `weapons/overlay.ts` 武器美术查询
 * - `weapons/entries/`   **一个武器一个文件**（美术 + 挂点配置），由 entries/index.ts 汇总成两张表
 *
 * 这里的导出名与拆分前完全一致，外部（渲染器/编辑器/脚本/测试）无需改动。
 */
export { HAND_POINTS, OTHER_HAND_POINT, HAND_COVER, LEFT_HAND_COVER } from './weapons/hands'
export { POSE_NAMES, makePoses, mergePoseConfig, sharedOf, SHARED_KEYS } from './weapons/poses'
export type { PoseKey, WeaponPoseTable, WeaponSlot } from './weapons/poses'
export { WEAPON_ENTRIES, WEAPON_OVERLAYS, WEAPON_POSES } from './weapons/entries/index'
export {
    poseConfigIn,
    getWeaponPoseConfig,
    handCoverTables,
    baseAnchorHand,
    resolveWeaponMount,
} from './weapons/mount'
export type { WeaponMount } from './weapons/mount'
export { getWeaponOverlay, getWeaponPixelColor, resolveWeaponPixels } from './weapons/overlay'
export { shouldDrawHandCover } from './weapons/dual'
export { getWeaponHand, getWeaponAngle } from './weapons/angles'
