/** 效果元数据 */
export interface EffectMeta {
    /** 日志显示标签 */
    label: string
    /** 效果说明 */
    desc?: string
    /** 每层属性修正（status 效果用） */
    attrMods?: Record<string, number>
}

/** 效果元数据注册表 */
export const EFFECT_META: Partial<Record<string, EffectMeta>> = {
    stat_transfer: { label: '汲取', desc: '吸取目标属性到自身' },
    paralyze: { label: '麻痹', desc: '降低身法和洞察', attrMods: { agility: -2, insight: -1 } },
    stat_multiply: { label: 'buff', desc: '属性翻倍' },
    stun: { label: '眩晕', desc: '大幅降低身法和洞察' },
    stat_buff: { label: '内劲', desc: '属性变化' },
}
