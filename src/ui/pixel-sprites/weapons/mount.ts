/**
 * 挂点解析：`resolveWeaponMount` 是渲染器 / 像素预览 / 编辑器共用的唯一入口。
 *
 * 优先级：手位 = 绝对 handX/handY → 相对 handDX/handDY → 基准（主手 HAND_POINTS / 副手 OTHER_HAND_POINT）；
 * 角度 = 显式 angle → 双手两手连线 → 单手规则（0°，attack ∓45°）。
 *
 * `flip`（数据键名保留）的语义是**左右镜像**：把**画出来的**武器沿「过握点的竖轴」做 x 反射（手性颠倒），
 * 姿势角度配置**不变**。画的一方按恒等式 `M·R(a) = R(−a)·M` 落地（旋转角取负 + 美术 x 取负），
 * 也就是「先按 angle 旋转、再把画面左右翻」——见 `WeaponMount.mirror`。
 */
import type { WeaponPoseConfig } from '../types'
import { HAND_COVER, HAND_POINTS, LEFT_HAND_COVER, OTHER_HAND_POINT } from './hands'
import { mergePoseConfig, sharedOf, type PoseKey, type WeaponSlot } from './poses'
import { WEAPON_POSES } from './entries/index'

/** 未登记武器的兜底配置 */
const DEFAULT_POSE: WeaponPoseConfig = { gripX: 0, gripY: 0 }

/** 获取武器在某姿势的握持配置（该姿势未定义时回落 idle；武器未登记时兜底 grip 0,0） */
/**
 * 查表取握持配置（不含编辑器临时覆盖）。
 * 注意：**临时覆盖只能通过 `resolveWeaponMount({ slot, config })` 传入** —— 这里刻意不收 override，
 * 就是为了从类型上杜绝"传了覆盖却忘了带槽位"（副手槽按主手基准算 → 武器与握点相对位置跳）。
 */
/** 表里按姿势名取配置（姿势名来自引擎是 string，这里统一收窄到 PoseKey） */
export function poseConfigIn<T>(table: Partial<Record<PoseKey, T>> | undefined, pose: string): T | undefined {
    return table?.[pose as PoseKey]
}

export function getWeaponPoseConfig(weaponId: string, pose: string, slot: WeaponSlot = 'main'): WeaponPoseConfig {
    const set = WEAPON_POSES[weaponId]
    if (!set) return DEFAULT_POSE
    // 基底（结构性字段：握点/镜像/锚定手/不遮手）与姿势条目**合并**；
    // 角度与挂点偏移不继承，因此「一把武器一个握点 + 个别姿势微调」是最自然的写法。
    const base = { ...sharedOf(set.base ?? set.idle) }
    if (slot === 'off') {
        return mergePoseConfig(
            { ...DEFAULT_POSE, ...base, ...sharedOf(set.off?.base) },
            poseConfigIn(set.off, pose),
        )
    }
    return mergePoseConfig({ ...DEFAULT_POSE, ...base }, poseConfigIn(set, pose))
}

/**
 * 手部遮罩表的选择——"哪个槽位盖哪只手"只有这一处判断（渲染器与像素预览共用）。
 * 主手槽：主手遮罩为主、双手武器再盖副手；副手槽：反过来。
 */
export function handCoverTables(slot: WeaponSlot): {
    primary: Record<string, [number, number][]>
    secondary: Record<string, [number, number][]>
} {
    return slot === 'off'
        ? { primary: LEFT_HAND_COVER, secondary: HAND_COVER }
        : { primary: HAND_COVER, secondary: LEFT_HAND_COVER }
}

/** 姿势配置里"锚定哪只手"的判定（只有显式 anchorHand: 'off' 才锚副手；默认主手） */
function anchorIsOff(cfg: Partial<WeaponPoseConfig>): boolean {
    return cfg.anchorHand === 'off'
}

/**
 * 基准锚定手（不含 handX/handY、handDX/handDY 覆盖）——全局手位表 + anchorHand/双手规则。
 * 解析器与导出（相对偏移）共用这一处，保证"导出的相对值"和"引擎实际用的基准"永远一致。
 */
export function baseAnchorHand(
    cfg: Partial<WeaponPoseConfig>,
    pose: string,
    slot: WeaponSlot = 'main',
): { x: number; y: number } {
    // 副手槽：基准 = 全局副手手位；主手槽：anchorHand === 'off' → 副手手位，否则主手手位。
    if (slot === 'off') return OTHER_HAND_POINT[pose] ?? OTHER_HAND_POINT.idle
    return anchorIsOff(cfg) ? (OTHER_HAND_POINT[pose] ?? OTHER_HAND_POINT.idle) : (HAND_POINTS[pose] ?? HAND_POINTS.idle)
}


/**
 * 解析「这把武器挂在某个槽位的某个姿势」的最终落点 —— 渲染层 / 预览 / 编辑器统一走这一处。
 *
 * 主手：手位 = handX/handY → anchorHand('main'/'off'，默认单手 main、双手 off) → 全局手位表；
 *       角度 = angle → 双手两手连线 → 单手规则(0°，attack ∓45°)。
 * 副手（未登记 off 子表时的默认）：
 *       单手武器 = 握柄与角度沿用主手表 + 手位取全局副手 OTHER_HAND_POINT；
 *       双手武器 = 直接沿用主手配置（双手武器本来就锚副手）。
 */
export interface WeaponMount {
    config: WeaponPoseConfig
    /** true = 用的是「副手默认」，而不是武器自己登记的 off 配置 */
    usingOffhandDefault: boolean
    gripX: number
    gripY: number
    /** 锚定手（精灵坐标） */
    hand: { x: number; y: number }
    /** 最终旋转角（**不含镜像**：镜像与角度是两件事，角度只由 angle / 默认规则决定） */
    angle: number
    /**
     * 是否左右镜像 —— 来自配置里的 `flip`（数据键名保留，历史原因：它以前是「角度 +180°」）。
     * 语义：把**画出来的**武器沿「过握点的竖轴」左右翻（手性颠倒），姿势角度不变。
     * 画的一方按 `M·R(angle) = R(−angle)·M` 落地：美术/位图 x 取负 + 实际旋转角取负。
     */
    mirror: boolean
}

export function resolveWeaponMount(
    weaponId: string,
    pose: string,
    opts: { slot?: WeaponSlot; config?: Partial<WeaponPoseConfig>; facingRight?: boolean } = {},
): WeaponMount {
    const slot: WeaponSlot = opts.slot ?? 'main'
    const facingRight = opts.facingRight ?? true
    // opts.config 可能是「局部覆盖」（编辑器只存改过的字段）：握点类字段缺失时回落到登记值，
    // 否则「武器握点写在基底、姿势只写偏移」的模型会因为缺少 gripX 而崩掉。
    const registered = opts.config
        ? (() => {
              const base = getWeaponPoseConfig(weaponId, pose, slot)
              const cfg = opts.config as Partial<WeaponPoseConfig>
              return {
                  ...base,
                  ...cfg,
                  gripX: cfg.gripX ?? base.gripX,
                  gripY: cfg.gripY ?? base.gripY,
              } as WeaponPoseConfig
          })()
        : getWeaponPoseConfig(weaponId, pose, slot)

    let cfg = registered
    let usingOffhandDefault = false
    if (slot === 'off' && !opts.config) {
        const offTable = WEAPON_POSES[weaponId]?.off
        const hasOffTable = Boolean(poseConfigIn(offTable, pose) ?? offTable?.idle)
        if (!hasOffTable) {
            // 副手没登记：直接用这把武器自己的配置（握点/角度都跟随主手）——副手角度不再有全局默认
            cfg = getWeaponPoseConfig(weaponId, pose, 'main')
            usingOffhandDefault = true
        }
    }

    // 手位：绝对 handX/handY > 相对偏移 handDX/handDY > 基准（全局表 + anchorHand/双手规则）
    const handBase = baseAnchorHand(cfg, pose, slot)
    const hand: { x: number; y: number } =
        cfg.handX !== undefined && cfg.handY !== undefined
            ? { x: cfg.handX, y: cfg.handY }
            : { x: handBase.x + (cfg.handDX ?? 0), y: handBase.y + (cfg.handDY ?? 0) }

    // 武器端握点 = 基底握点（全武器一个）+ 逐姿势偏移（gripDX/gripDY）
    const effGripX = cfg.gripX + (cfg.gripDX ?? 0)
    const effGripY = cfg.gripY + (cfg.gripDY ?? 0)

    // 角度：`flip` 不参与 —— 它是左右镜像（见 WeaponMount.mirror），不是"再转半圈"
    let angle: number
    if (cfg.angle !== undefined) {
        angle = facingRight ? cfg.angle : -cfg.angle
    } else {
        angle = pose === 'attack' ? (facingRight ? -Math.PI / 4 : Math.PI / 4) : 0
    }

    return {
        config: cfg,
        usingOffhandDefault,
        gripX: effGripX,
        gripY: effGripY,
        hand,
        angle,
        mirror: cfg.flip === true,
    }
}
