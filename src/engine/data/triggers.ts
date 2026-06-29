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
        name: 'HP<30%',
        description: 'HP 低于 30% 时触发',
        type: 'hp_below',
        check: (ctx) => (ctx.actor.hp / ctx.actor.maxHp) * 100 < 30,
        maxUses: 1,
    },
    {
        id: 'hp_below_50',
        name: 'HP<50%',
        description: 'HP 低于 50% 时触发',
        type: 'hp_below',
        check: (ctx) => (ctx.actor.hp / ctx.actor.maxHp) * 100 < 50,
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
        id: 'on_debuff',
        name: '被减益时',
        description: '受到减益效果时触发',
        type: 'on_debuff',
    },
    {
        id: 'on_poison',
        name: '施加中毒时',
        description: '使目标中毒时触发',
        type: 'on_poison',
    },
    {
        id: 'on_burn',
        name: '施加灼烧时',
        description: '使目标灼烧时触发',
        type: 'on_burn',
    },
    {
        id: 'on_bleed',
        name: '施加流血时',
        description: '使目标流血时触发',
        type: 'on_bleed',
    },
    {
        id: 'on_stun',
        name: '施加眩晕时',
        description: '使目标眩晕时触发',
        type: 'on_stun',
    },
    {
        id: 'on_paralyze',
        name: '施加麻痹时',
        description: '使目标麻痹时触发',
        type: 'on_paralyze',
    },
    {
        id: 'on_sand_blind',
        name: '施加致盲时',
        description: '使目标致盲时触发',
        type: 'on_sand_blind',
    },
    {
        id: 'on_disarm',
        name: '缴械时',
        description: '缴械目标时触发',
        type: 'on_disarm',
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
