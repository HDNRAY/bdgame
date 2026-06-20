import type { EffectDef, BuffDuration } from '../entities/action'
import type { AttrName } from '../entities/attributes'
import { ATTR_CN } from '../entities/attributes'
import { getBuff } from './buffs'

/** 格式化属性缩放为中文，如 {strength: 2, base: 5} → "力道×2 + 5" */
function fmtScaling(scaling: Partial<Record<AttrName, number>>, base?: number): string {
    const parts: string[] = []
    for (const [k, v] of Object.entries(scaling)) {
        const name = ATTR_CN[k] ?? k
        if (v === 1) parts.push(name)
        else parts.push(`${name}×${v}`)
    }
    if (base && base > 0) parts.push(`${base}`)
    return parts.join(' + ')
}

/** 格式化 buff 持续时间为中文 */
function fmtDuration(duration?: BuffDuration): string {
    if (!duration) return ''
    return `属性×${duration.multiplier}`
}

/** 将 EffectDef 解析为中文描述列表 */
export function describeEffect(eff: EffectDef): string[] {
    const effType: string = eff.type
    switch (eff.type) {
        case 'damage': {
            const s = fmtScaling(eff.scaling, eff.base)
            return [`伤害: ${s}`]
        }
        case 'fixed_damage':
            return [`固定伤害: ${eff.value}`]
        case 'heal':
            return eff.ratio ? [`回复: ${eff.value} + 最大HP×${(eff.ratio * 100).toFixed(0)}%`] : [`回复: ${eff.value}`]
        case 'add_debuff': {
            const statusCN: Record<string, string> = {
                burn: '灼烧',
                poison: '中毒',
                bleed: '流血',
                stun: '眩晕',
                paralyze: '麻痹',
            }
            const name = statusCN[eff.buffId] ?? eff.buffId
            return [`附加 ${name} ×${eff.stacks} (${(eff.chance * 100).toFixed(0)}%概率)`]
        }
        case 'stat_buff': {
            const parts = Object.entries(eff.attrs).map(([k, v]) => {
                const name = ATTR_CN[k] ?? k
                return `${name} ${v > 0 ? '+' : ''}${v}`
            })
            const dur = eff.duration ? fmtDuration(eff.duration) : eff.durationMs ? `${eff.durationMs / 1000}秒` : ''
            const suffix = dur ? ` (${dur})` : ''
            return [`属性变化: ${parts.join(', ')}${suffix}`]
        }
        case 'stat_multiply':
            return [`${eff.stat} ×${eff.multiplier}`]
        case 'restore_ap':
            return [`回复 AP: ${eff.value}`]
        case 'max_ap_mod':
            return [`最大AP ${eff.value > 0 ? '+' : ''}${eff.value}`]
        case 'max_hp_mod':
            return [`最大HP ${eff.value > 0 ? '+' : ''}${eff.value}`]
        case 'missing_hp_damage':
            return [`造成目标已损失HP×${eff.ratio} 的伤害`]
        case 'self_missing_hp_damage':
            return [`造成自身已损失HP×${eff.ratio} 的伤害`]
        case 'self_damage':
            return [`自伤: 当前HP×${eff.ratio}`]
        case 'cleanse':
            return eff.buffIds && eff.buffIds.length > 0 ? [`净化: ${eff.buffIds.join(', ')}`] : ['净化所有负面状态']
        case 'crit_chance':
            return [`暴击率 ${eff.value > 0 ? '+' : ''}${(eff.value * 100).toFixed(0)}%`]
        case 'crit_damage':
            return [`暴击伤害 ${eff.value > 0 ? '+' : ''}${(eff.value * 100).toFixed(0)}%`]
        case 'hit_chance':
            return [`命中率 ${eff.value > 0 ? '+' : ''}${(eff.value * 100).toFixed(0)}%`]
        case 'dodge_mod':
            return [`闪避率 ${eff.value > 0 ? '+' : ''}${(eff.value * 100).toFixed(0)}%`]
        case 'parry_mod':
            return [`招架率 ${eff.value > 0 ? '+' : ''}${(eff.value * 100).toFixed(0)}%`]
        case 'haste':
            return [`急速: +${eff.value}% 行动速度`]
        case 'knockback':
            return [`击退: ${eff.distance}格`]
        case 'dash':
            return [`冲刺: 移动到距离目标${eff.targetDist}格的位置`]
        case 'short_dash':
            return [`短距冲刺: 最多${eff.maxDistance ?? 3}格`]
        case 'disarm':
            return ['卸除武器']
        case 'interrupt':
            return ['打断']
        case 'ignore_parry':
            return ['无视招架']
        case 'move_efficiency':
            return [`移动效率 ${eff.value > 0 ? '+' : ''}${(eff.value * 100).toFixed(0)}%`]
        case 'trigger_slot_mod':
            return [`触发槽 ${eff.value > 0 ? '+' : ''}${eff.value}`]
        case 'weapon_range_bonus':
            return [`武器范围 +${eff.value}`]
        case 'permanent_burn':
            return [`永久灼烧: ${eff.value}层`]
        case 'last_stand':
            return [`死战: HP低于${(eff.ratio * 100).toFixed(0)}%时触发`]
        case 'attr_floor': {
            const parts = Object.entries(eff.attrs).map(([k, v]) => `${ATTR_CN[k] ?? k}≥${v}`)
            return [`属性下限: ${parts.join(', ')}`]
        }
        case 'add_buff': {
            const buff = getBuff(eff.buffId)
            const name = buff?.name ?? eff.buffId
            const stacks = eff.stacks ? ` ×${eff.stacks}` : ''
            let extra = ''
            if (buff?.attrMods) {
                const parts = Object.entries(buff.attrMods).map(([k, v]) => {
                    const cn = ATTR_CN[k] ?? k
                    return `${cn}${v > 0 ? '+' : ''}${v}`
                })
                extra = ` (${parts.join(', ')})`
            } else if (buff?.onCanParry) {
                extra = ' (允许招架)'
            } else if (buff?.tickInterval && buff.onTickHeal) {
                extra = ` (每${buff.tickInterval / 1000}秒触发)`
            } else if (buff?.onDealDamage || buff?.onTakeDamage || buff?.onTickDamage) {
                extra = buff.description && buff.description !== name ? ` — ${buff.description}` : ''
            } else if (buff?.description && buff.description !== name) {
                extra = ` — ${buff.description}`
            }
            return [`获取: ${name}${stacks}${extra}`]
        }
        case 'remove_buff':
            return [`移除: ${getBuff(eff.buffId)?.name ?? eff.buffId}`]
        case 'retrieve_weapon':
            return ['捡回脱手的武器']
        case 'switch_weapon':
            return [`切换武器: ${eff.weaponId}`]
        case 'summon_speed':
            return [`召唤速度: ${eff.value}`]
        case 'summon_damage_bonus':
            return [`召唤伤害加成: ${eff.value}`]
        case 'stat_transfer':
            return [`属性转移: ${eff.stat} → +${eff.value}`]
        case 'ciyuan_init':
            return ['次元初始化']
        case 'wisdom_stat_buff': {
            const names = eff.attrs.map((a) => ATTR_CN[a] ?? a).join('、')
            return [`悟性加成: 悟性×${eff.ratio} 加到 ${names}`]
        }
        case 'limit_uses':
            return [`使用次数上限: ${eff.max}`]
        case 'stat_parry_dodge': {
            const parts: string[] = []
            if (eff.parryScale) parts.push(`招架 ×${eff.parryScale}`)
            if (eff.dodgeScale) parts.push(`闪避 ×${eff.dodgeScale}`)
            return [`属性替代: ${parts.join(', ')}`]
        }
        case 'add_passive':
            return [`获得功法: ${eff.passiveId}`]
        case 'dex_to_str':
            return [`以巧借力: 灵巧×${eff.ratio} → 力道`]
        default:
            return [`[未知效果: ${effType}]`]
    }
}

export function describeEffects(effects: EffectDef[]): string[] {
    return effects.flatMap(describeEffect)
}
