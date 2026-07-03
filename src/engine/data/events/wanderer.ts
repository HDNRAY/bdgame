import type { EventDef } from '../../entities/event'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { isBasicAction } from '../../systems/roguelite/util'

export const WANDERER_N02_INTRO: EventDef = {
    id: 'wanderer_n02_intro',
    name: '山洞奇遇',
    description: '七岁那年你在后山玩耍，偶遇一对隐世夫妇。',
    rewardType: 'weapon',
    rewardFilter: (item) => STARTING_WEAPONS.some((w) => w.id === item.id),
    rounds: [
        {
            id: 'intro',
            title: '后山',
            description:
                '七岁那年你在后山玩耍，无意中发现了一个隐蔽的山洞。洞中一对夫妇正在清点行囊——男子背负一柄大剑，女子腰悬双剑。他们见你筋骨不错，便将洞中留下的几件兵器和图谱赠予了你。你后来才知道，他们叫过儿与龙女。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收下' }],
        },
        { id: 'reward_round', title: '选择兵器', choices: [] },
        {
            id: 'epilogue',
            title: '过儿的话',
            description:
                '男子拍了拍你的头：「有缘再见。记住，兵器是死物，人才是活的。」说罢二人转身离去，很快消失在林间。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

export const WANDERER_N03_INTRO: EventDef = {
    id: 'wanderer_n03_intro',
    name: '悟道',
    description: '过儿和龙女留下的图谱在你脑海中挥之不去。',
    rewardType: 'action',
    rewardFilter: isBasicAction,
    rounds: [
        {
            id: 'intro',
            title: '领悟',
            description: '过儿和龙女留下的图谱在你脑海中挥之不去。你一遍遍回想、比划，渐渐悟出了其中的门道。',
            choices: [{ id: 'reward_round', type: 'continue', label: '演练' }],
        },
        { id: 'reward_round', title: '选择招式', choices: [] },
        {
            id: 'epilogue',
            title: '龙女的话',
            description: '你仿佛听到龙女的声音在耳边响起：「悟性不错。但记住，招式是死的，应变才是活的。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}
