import type { TriggerCondition } from '../entities/trigger'

/** 玩家可选的所有触发条件 */
export const TRIGGER_CONDITIONS: TriggerCondition[] = [
    {
        id: 'on_parry',
        name: '招架时',
        description: '招架对手攻击时触发',
        type: 'on_parry',
    },
    {
        id: 'on_dodged',
        name: '被闪避时',
        description: '攻击被对手闪避时触发',
        type: 'on_dodged',
    },
    {
        id: 'on_hit',
        name: '命中时',
        description: '攻击命中时触发',
        type: 'on_hit',
    },
    {
        id: 'hp_below_30',
        name: '残血',
        description: 'HP 低于 30% 时触发',
        type: 'hp_below',
        check: (ctx) => (ctx.actor.hp / ctx.actor.maxHp) * 100 < 30,
        maxUses: 1,
    },
    {
        id: 'on_dodge',
        name: '闪避时',
        description: '闪避对手攻击时触发',
        type: 'on_dodge',
    },
    {
        id: 'turn_start',
        name: '回合开始',
        description: '每回合开始时触发',
        type: 'turn_start',
    },
    {
        id: 'on_attack',
        name: '攻击时',
        description: '攻击时触发',
        type: 'on_attack',
    },
    {
        id: 'on_dealt_damage',
        name: '造成伤害时',
        description: '造成伤害时触发',
        type: 'on_dealt_damage',
    },
    {
        id: 'on_was_hit',
        name: '被命中时',
        description: '被攻击命中时触发',
        type: 'on_was_hit',
    },
    {
        id: 'on_took_damage',
        name: '受到伤害时',
        description: '受到伤害时触发',
        type: 'on_took_damage',
    },
    {
        id: 'on_parried',
        name: '被招架时',
        description: '攻击被对手招架时触发',
        type: 'on_parried',
    },
    {
        id: 'on_buff',
        name: '获得增益时',
        description: '获得增益效果时触发',
        type: 'on_buff',
    },
    {
        id: 'on_debuff',
        name: '获得减益时',
        description: '获得减益效果时触发',
        type: 'on_debuff',
    },
    {
        id: 'on_poison',
        name: '中毒时',
        description: '中毒时触发',
        type: 'on_poison',
    },
    {
        id: 'on_move',
        name: '移动时',
        description: '移动时触发',
        type: 'on_move',
    },
    {
        id: 'on_opponent_move',
        name: '对手移动时',
        description: '对手移动时触发',
        type: 'on_opponent_move',
    },
    {
        id: 'on_crit',
        name: '暴击时',
        description: '暴击时触发',
        type: 'on_crit',
    },
    {
        id: 'on_pre_action',
        name: '行动前',
        description: '行动之前触发',
        type: 'on_pre_action',
    },
    {
        id: 'before_main',
        name: '主行动前',
        description: '主行动之前触发',
        type: 'before_main',
    },
    {
        id: 'after_main',
        name: '主行动后',
        description: '主行动之后触发',
        type: 'after_main',
    },
    {
        id: 'before_turn_end',
        name: '回合结束前',
        description: '回合结束之前触发',
        type: 'before_turn_end',
    },
    {
        id: 'turn_end',
        name: '回合结束时',
        description: '每回合结束时触发',
        type: 'turn_end',
    },
    {
        id: 'battle_start',
        name: '战斗开始时',
        description: '战斗开始时触发',
        type: 'battle_start',
    },
]

/** 根据触发条件类型获取中文名 */
export function getTriggerName(type: string): string {
    return TRIGGER_CONDITIONS.find((tc) => tc.type === type)?.name ?? type
}

/** 根据触发条件类型获取描述 */
export function getTriggerDesc(type: string): string {
    return TRIGGER_CONDITIONS.find((tc) => tc.type === type)?.description ?? ''
}
