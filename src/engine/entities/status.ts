/** 状态效果类型 */
export type StatusType = 'burn' | 'poison' | 'bleed' | 'stun' | 'paralyze'
// 麻痹: 降低身法和洞察，影响前后摇/移速，数值固定
// 眩晕: 大幅降低身法和洞察，数值随连续次数递减

/** 流血伤害计算 */
export function triggerBleed(stacks: number): number {
    return Math.floor(stacks * 1.5)
}
