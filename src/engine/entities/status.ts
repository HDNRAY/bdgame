/** 状态效果类型 */
export type StatusType = 'burn' | 'poison' | 'bleed' | 'stun' | 'paralyze'
// 麻痹: 降低身法和洞察，影响前后摇/移速
// 眩晕: 停止走表

/** 状态效果实例 */
export interface StatusInstance {
    type: StatusType
    stacks: number
    source: string // 施加者名称

    /** 标志：此状态是否跳过行动（如眩晕停止走表） */
    skipTurn?: boolean
    /** 跳过行动后的重调度延迟(ms)，0=正常走时间轴 */
    rescheduleDelay?: number

    // 灼烧: 初始伤害快照
    burnBaseDamage?: number

    // 中毒: 当前 tick 间隔 (ms)，每次 tick 后递减
    poisonInterval?: number

    // 流血: 每次行动触发伤害（非 tick）
    bleedDamagePerStack?: number

    // 通用
    remainingTicks?: number

    /** 每层独立计时用的应用ID（如麻痹独立层） */
    _appId?: string
}

/** 创建灼烧 */
export function createBurn(stacks: number, baseDamage: number, source: string): StatusInstance {
    return { type: 'burn', stacks, source, burnBaseDamage: baseDamage, remainingTicks: stacks }
}

/** 创建中毒 */
export function createPoison(stacks: number, source: string, startInterval = 2000): StatusInstance {
    return { type: 'poison', stacks, source, poisonInterval: startInterval }
}

/** 创建流血 */
export function createBleed(stacks: number, damagePerStack: number, source: string): StatusInstance {
    return { type: 'bleed', stacks, source, bleedDamagePerStack: damagePerStack }
}

/** 灼烧 tick: 伤害递减 */
export function tickBurn(s: StatusInstance): number {
    if (s.type !== 'burn' || !s.burnBaseDamage || !s.remainingTicks) return 0
    const dmg = Math.round(s.burnBaseDamage * (s.stacks / (s.stacks + s.remainingTicks)))
    s.remainingTicks--
    s.stacks = Math.max(0, s.stacks - 1)
    return dmg
}

/** 中毒 tick: 间隔递减 */
export function tickPoison(s: StatusInstance): { damage: number; nextInterval: number } {
    if (s.type !== 'poison') return { damage: 0, nextInterval: 0 }
    const dmg = s.stacks * 2
    s.poisonInterval = Math.max(500, (s.poisonInterval ?? 2000) - 150)
    return { damage: dmg, nextInterval: s.poisonInterval }
}

/** 流血触发: 每次行动/受击 */
export function triggerBleed(s: StatusInstance): number {
    if (s.type !== 'bleed' || !s.bleedDamagePerStack) return 0
    return s.stacks * s.bleedDamagePerStack
}
