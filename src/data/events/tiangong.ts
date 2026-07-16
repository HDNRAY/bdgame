import type { EventDef } from '../../engine/entities/event'

/** 去天工坊找千星打造武器 */
export const TIANGONG_WEAPON: EventDef = {
    id: 'tiangong_weapon',
    name: '天工坊',
    description: '斗炁大会即将开始，你在街上看到了天工坊的招牌。千星正靠在门口擦一把新出炉的兵器。',
    rewardType: 'weapon',
    rounds: [
        {
            id: 'intro',
            title: '天工坊',
            description:
                '斗炁大会即将开始，你在街上看到了天工坊的招牌。千星正靠在门口擦一把新出炉的兵器，看到你便扬了扬下巴：「哟，来了？这次进了决赛圈，要不要换件趁手的家伙？」',
            choices: [
                { id: 'reward_round', type: 'continue', label: '去天工坊看看' },
                { id: 'training', type: 'continue', label: '不去，在家修炼' },
            ],
        },
        {
            id: 'reward_round',
            title: '挑选材料',
            description: '材料柜里陈列着几件千星打造的兵器，泛着淡淡的炁光。',
            choices: [],
        },
        {
            id: 'training',
            title: '在家修炼',
            description: '你决定不去天工坊，留在住处潜心修炼，巩固修为。',
            choices: [{ id: '__end__', type: 'points', label: '潜心修炼（+4 修炼点）' }],
        },
    ],
}
