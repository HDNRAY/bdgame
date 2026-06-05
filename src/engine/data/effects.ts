/** 效果元数据 */
export interface EffectMeta {
    /** 日志显示标签 */
    label: string
    /** 效果说明 */
    desc?: string
    /** 每层属性修正（status 效果用） */
    attrMods?: Record<string, number>
    /** 持续伤害类效果的 tick 间隔（ms） */
    tickInterval?: number
    /** 持续伤害类效果的单次伤害量 */
    damage?: number
}

/** 效果元数据注册表 */
export const EFFECT_META: Record<string, EffectMeta> = {
    stat_transfer: { label: '汲取', desc: '吸取目标属性到自身' },
    paralyze: { label: '麻痹', desc: '降低身法和洞察', attrMods: { agility: -2, insight: -1 } },
    stat_multiply: { label: '超越', desc: '属性超越' },
    stun: { label: '眩晕', desc: '大幅降低身法和洞察' },
    stat_buff: { label: '内劲', desc: '属性变化' },
    max_ap_mod: { label: '失能', desc: '最大AP变化' },
    max_hp_mod: { label: '失血', desc: '最大HP变化' },
    fumble_chance: { label: '失心', desc: '动作失败率' },
    permanent_burn: { label: '过热', desc: '持续灼烧伤害', tickInterval: 3000, damage: 1 },
}
