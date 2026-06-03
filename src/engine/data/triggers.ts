import type { TriggerCondition } from '../entities/trigger'

/** 玩家可选的所有触发条件 */
export const TRIGGER_CONDITIONS: TriggerCondition[] = [
    {
        id: 'on_parry',
        name: '招架时',
        description: '招架对手攻击时触发',
        type: 'on_parry',
        value: 0,
        tags: ['defensive'],
    },
    {
        id: 'on_dodged',
        name: '被闪避时',
        description: '攻击被对手闪避时触发',
        type: 'on_dodged',
        value: 0,
        tags: ['utility'],
    },
    {
        id: 'on_hit',
        name: '命中时',
        description: '攻击命中时触发',
        type: 'on_hit',
        value: 0,
        tags: ['offensive'],
    },
    {
        id: 'hp_below_30',
        name: '残血',
        description: 'HP 低于 30% 时触发',
        type: 'hp_below',
        value: 30,
        maxUses: 1,
        tags: ['offensive'],
    },
    {
        id: 'on_dodge',
        name: '闪避时',
        description: '闪避对手攻击时触发',
        type: 'on_dodge',
        value: 0,
        tags: ['mobility'],
    },
    {
        id: 'turn_start',
        name: '回合开始',
        description: '每回合开始时触发',
        type: 'turn_start',
        value: 0,
        tags: ['utility'],
    },
]
