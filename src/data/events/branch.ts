import type { EventDef } from '../../game/entities/event'

import { CHRONICLE_EVENTS } from './chronicle'

export const BRANCH_PASSIVE: EventDef = {
    id: 'branch_passive',
    name: '深山发现炼炁秘籍',
    description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
    rewardType: 'passive',
    rounds: [
        {
            id: 'discover',
            title: '奇遇',
            description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
            choices: [{ id: 'reward', type: 'continue', label: '参悟秘籍' }],
        },
        {
            id: 'reward',
            title: '参悟',
            choices: [],
        },
    ],
}

export const BRANCH_ACTION: EventDef = {
    id: 'branch_action',
    name: '在家打磨套路',
    description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
    rewardType: 'action',
    rounds: [
        {
            id: 'practice',
            title: '打磨',
            description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打磨' }],
        },
        {
            id: 'reward',
            title: '新招',
            choices: [],
        },
    ],
}

export const BRANCH_ARTIFACT: EventDef = {
    id: 'branch_artifact',
    name: '做任务获得奖励',
    description: '你完成了一项委托，雇主给予了丰厚的报酬。',
    rewardType: 'artifact',
    rounds: [
        {
            id: 'quest',
            title: '任务完成',
            description: '你完成了一项委托，雇主给予了丰厚的报酬。',
            choices: [{ id: 'reward', type: 'continue', label: '领取报酬' }],
        },
        {
            id: 'reward',
            title: '报酬',
            choices: [],
        },
    ],
}

export const BRANCH_POINTS: EventDef = {
    id: 'branch_points',
    name: '瀑布打坐',
    description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
    rewardType: 'points',
    rounds: [
        {
            id: 'meditate',
            title: '打坐',
            description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打坐' }],
        },
        {
            id: 'reward',
            title: '感悟',
            choices: [],
        },
    ],
}

export const BRANCH_HEAL: EventDef = {
    id: 'branch_heal',
    name: '去医馆治疗',
    description: '你前往镇上医馆，请老医师为你调理伤势。',
    rewardType: 'heal',
    rounds: [
        {
            id: 'clinic',
            title: '医馆',
            description: '你前往镇上医馆，请老医师为你调理伤势。',
            choices: [{ id: 'reward', type: 'continue', label: '接受治疗' }],
        },
        {
            id: 'reward',
            title: '疗伤',
            choices: [],
        },
    ],
}

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

/** 斗炁图书馆 — 龙语仙（防御功法）/ 白狐（攻击功法） */
export const LIBRARY_EVENT: EventDef = {
    id: 'douqi_library',
    name: '斗炁图书馆',
    description: '你在街角发现了一座古朴的图书馆，檐下匾额写着「斗炁图书馆」四个字。',
    rewardType: 'passive',
    rewardFilter: (item) => item.tags.includes('defense') || item.tags.includes('damage'),
    rounds: [
        {
            id: 'intro',
            title: '斗炁图书馆',
            description:
                '你推开木门，一股书卷气扑面而来。柜台后一名龙角少女正悠闲地翻着书，见你进来便抬眼一笑："新面孔嘛，随便看。"\n\n角落的蒲团上，一只白狐蜷着尾巴，专心致志地盯着一本泛黄的古籍，尾巴尖时不时抖一下，完全没注意到你。',
            choices: [
                { id: 'dragon_reward', type: 'continue', label: '找龙语仙请教防御功法' },
                { id: 'fox_reward', type: 'continue', label: '找白狐请教攻击功法' },
                { id: '__end__', type: 'continue', label: '随便翻翻就走' },
            ],
        },
        {
            id: 'dragon_reward',
            title: '龙语仙的推荐',
            description:
                '"防御功法是吧？" 龙语仙放下书，走到一排书架前，指尖划过书脊，"这几本适合你——好好练，别出去让人揍得鼻青脸肿，丢我的人。"',
            choices: [],
            rewardFilter: (item) => item.tags.includes('defense'),
        },
        {
            id: 'dragon_epilogue',
            title: '龙语仙的赠言',
            description:
                '龙语仙把功法抄本塞到你手里："练熟了再来，我这还有更好的。" 她摆摆手，又窝回柜台后面看书去了。',
            choices: [{ id: '__end__', type: 'continue', label: '离开图书馆' }],
        },
        {
            id: 'fox_reward',
            title: '白狐的珍藏',
            description:
                '你走近时，白狐才从书页间抬起头，琥珀色的眼睛眨了眨。"你也喜欢看这个？" 她兴奋地翻开另一本书，"这本的记载更完整，你看看——包教包会！"',
            choices: [],
            rewardFilter: (item) => item.tags.includes('damage'),
        },
        {
            id: 'fox_epilogue',
            title: '白狐的赠言',
            description: '"下次来提前说一声，我给你留几本新到的。" 白狐笑眯眯地挥了挥爪子，又埋头扎进了书堆里。',
            choices: [{ id: '__end__', type: 'continue', label: '离开图书馆' }],
        },
    ],
}

export const BRANCH_EVENTS: EventDef[] = [
    BRANCH_PASSIVE,
    BRANCH_ACTION,
    BRANCH_ARTIFACT,
    BRANCH_POINTS,
    BRANCH_HEAL,
    TIANGONG_WEAPON,
    LIBRARY_EVENT,
    ...CHRONICLE_EVENTS,
]
