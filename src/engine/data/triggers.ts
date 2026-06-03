import type { TriggerDefinition } from '../entities/trigger'

export const MVP_TRIGGERS: TriggerDefinition[] = [
    {
        id: 'counter',
        name: '反击',
        description: '招架后立即反击，造成 50% 伤害',
        event: 'on_parry',
        effects: [{ type: 'counter_attack', damageRatio: 0.5 }],
        slotCost: 1, apCost: 1, tags: ['counter', 'defensive'],
    },
    {
        id: 'insight',
        name: '洞察',
        description: '对手未命中时，下回合 AP +2',
        event: 'on_dodged',
        condition: { enemyDistance: 3 },
        effects: [{ type: 'buff', stat: 'ap', value: 2, duration: 'turn' }],
        slotCost: 1, tags: ['utility', 'mobility'],
    },
    {
        id: 'burn_feedback',
        name: '灼烧反馈',
        description: '每次造成灼烧伤害时，回复 3 HP',
        event: 'on_hit',
        effects: [{ type: 'heal', value: 3 }],
        slotCost: 1, tags: ['recovery'],
    },
    {
        id: 'last_stand',
        name: '背水一战',
        description: 'HP 首次低于 30% 时，力道+4 持续整场',
        event: 'hp_below',
        condition: { hpBelow: 30 },
        effects: [{ type: 'buff', stat: 'strength', value: 4, duration: 'battle' }],
        slotCost: 1, maxUses: 1, tags: ['offensive', 'utility'],
    },
    {
        id: 'nimble',
        name: '灵巧身形',
        description: '闪避后下回合间隔 -200ms',
        event: 'on_dodge',
        effects: [{ type: 'modify_turn', deltaMs: -200 }],
        slotCost: 1, tags: ['mobility'],
    },
    {
        id: 'iron_bone',
        name: '钢筋铁骨',
        description: '被眩晕/减速时立即解除',
        event: 'turn_start',
        condition: { hasStatus: 'stun' },
        effects: [{ type: 'cleanse' }],
        slotCost: 1, apCost: 1, maxUses: 1, tags: ['defensive', 'control'],
    },
    {
        id: 'bloodthirst',
        name: '嗜血',
        description: '击败对手时回复 20% HP',
        event: 'on_kill',
        effects: [{ type: 'heal', value: 0, ratio: 0.2 }],
        slotCost: 1, maxUses: 1, tags: ['recovery'],
    },
    {
        id: 'precise_strike',
        name: '精准打击',
        description: '攻击未命中时，下次命中率 +15%',
        event: 'on_dodged',
        effects: [{ type: 'buff', stat: 'hitRate', value: 15, duration: 'turn' }],
        slotCost: 1, tags: ['offensive', 'utility'],
    },
]

export function getTrigger(id: string): TriggerDefinition | undefined {
    return MVP_TRIGGERS.find(t => t.id === id)
}
