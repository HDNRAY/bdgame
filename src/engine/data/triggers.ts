import type { TriggerDefinition } from '../entities/trigger'

export const MVP_TRIGGERS: TriggerDefinition[] = [
    {
        id: 'counter',
        name: '反击',
        description: '招架后立即反击',
        event: 'on_parry',
        slotCost: 1,
        apCost: 1,
        tags: ['counter', 'defensive'],
    },
    {
        id: 'insight',
        name: '洞察',
        description: '对手未命中时下回合AP+2',
        event: 'on_dodged',
        condition: { enemyDistance: 3 },
        slotCost: 1,
        tags: ['utility', 'mobility'],
    },
    {
        id: 'burn_feedback',
        name: '灼烧反馈',
        description: '每次造成灼烧伤害时回复3HP',
        event: 'on_hit',
        slotCost: 1,
        tags: ['recovery'],
    },
    {
        id: 'last_stand',
        name: '背水一战',
        description: 'HP首次低于30%时力道+4整场',
        event: 'hp_below',
        condition: { hpBelow: 30 },
        slotCost: 1,
        maxUses: 1,
        tags: ['offensive', 'utility'],
    },
    {
        id: 'nimble',
        name: '灵巧身形',
        description: '闪避后下回合间隔-200ms',
        event: 'on_dodge',
        slotCost: 1,
        tags: ['mobility'],
    },
    {
        id: 'iron_bone',
        name: '钢筋铁骨',
        description: '被眩晕/减速时立即解除',
        event: 'turn_start',
        condition: { hasStatus: 'stun' },
        slotCost: 1,
        apCost: 1,
        maxUses: 1,
        tags: ['defensive', 'control'],
    },
    {
        id: 'precise_strike',
        name: '精准打击',
        description: '攻击未命中时下次命中率+15%',
        event: 'on_dodged',
        slotCost: 1,
        tags: ['offensive', 'utility'],
    },
]

export function getTrigger(id: string): TriggerDefinition | undefined {
    return MVP_TRIGGERS.find((t) => t.id === id)
}
