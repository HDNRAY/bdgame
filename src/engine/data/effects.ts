/** 效果元数据：标签 + 每层属性修正 */
export const EFFECT_META: Record<string, { tag: string; attrMods?: Record<string, number> }> = {
    stat_transfer: { tag: '汲取' },
    paralyze: { tag: '麻痹', attrMods: { agility: -2, insight: -1 } },
    stat_multiply: { tag: 'buff' },
    stun: { tag: '眩晕' },
}
