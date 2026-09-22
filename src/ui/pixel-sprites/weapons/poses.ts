/**
 * 姿势维度的公共类型与工具：姿势名、表类型、makePoses、基底合并规则。
 *
 * 写法（**一把武器一个握点 + 个别姿势微调**）：
 *
 * ```ts
 * poses: {
 *     ...makePoses({ gripX: 24, gripY: 24 }),   // 基底：所有姿势共用（握点/翻转/锚定手…）
 *     parry: { angle: 2.6857 },                 // 姿势只写与基底不同的字段
 *     off: { ...makePoses({}), hit: { angle: (58 * Math.PI) / 180 } },
 * }
 * ```
 *
 * 语义：姿势条目与基底**合并**（`{ ...基底, ...姿势 }`），只合并 `SHARED_KEYS` 这些
 * 结构性字段；角度与挂点偏移是逐姿势字段，永远不继承（不写 = 引擎自动规则 / 0 偏移），
 * 所以**不需要**写 `handDX: 0` 这类占位。
 */
import type { WeaponPoseConfig } from '../types'

/** 全部姿势名 */
export const POSE_NAMES = ['idle', 'attack', 'dodge', 'parry', 'hit', 'buff'] as const

/** 武器槽位：主手 / 副手。同一把武器在两个槽位可以有各自的挂点与角度 */
export type WeaponSlot = 'main' | 'off'

/**
 * 姿势名（含渲染器用的 move）——用显式键而不是索引签名：索引签名会要求 `off` 也是 WeaponPoseConfig，
 * 交叉类型会自相矛盾（历史上导致带 off 的片段粘贴报错）。
 */
export type PoseKey = 'idle' | 'attack' | 'dodge' | 'parry' | 'hit' | 'buff' | 'move'

/** 基底能提供的结构性字段：这些字段在姿势间共享，写一次即可 */
export const SHARED_KEYS: (keyof WeaponPoseConfig)[] = ['gripX', 'gripY', 'flip', 'anchorHand', 'noHandCover']

/** 每姿势的配置：只需写与基底不同的字段（握点类字段可省，会从基底继承） */
export type PoseConfig = Partial<WeaponPoseConfig>

export type WeaponPoseTable = Partial<Record<PoseKey, PoseConfig>> & {
    /** makePoses 存下来的共用基底（结构性字段） */
    base?: PoseConfig
    off?: Partial<Record<PoseKey, PoseConfig>> & { base?: PoseConfig }
}

/** 只取结构性字段（合并进姿势时用） */
export function sharedOf(cfg: PoseConfig | undefined): PoseConfig {
    const out: PoseConfig = {}
    if (!cfg) return out
    for (const k of SHARED_KEYS) if (cfg[k] !== undefined) (out as Record<string, unknown>)[k] = cfg[k]
    return out
}

/** 合成一个姿势的最终配置：基底（结构性字段）+ 姿势自身 */
export function mergePoseConfig(base: PoseConfig | undefined, pose: PoseConfig | undefined): WeaponPoseConfig {
    return { ...(base ?? {}), ...(pose ?? {}) } as WeaponPoseConfig
}

/**
 * 生成所有姿势同一握持配置的便捷函数 — 特定姿势需单独调整时再覆盖该 key。
 *
 * 注意：`...makePoses(base)` 只是**构造时**铺开，某个姿势一旦写了显式条目就会把它覆盖掉，
 * 所以这里额外把基底存进 `base` 键，解析时再合并（见 getWeaponPoseConfig）。
 */
export function makePoses(base: PoseConfig): Record<PoseKey, PoseConfig> & { base: PoseConfig } {
    const out: Record<string, PoseConfig> = {}
    for (const p of POSE_NAMES) out[p] = { ...base }
    out.base = { ...base }
    return out as Record<PoseKey, PoseConfig> & { base: PoseConfig }
}
