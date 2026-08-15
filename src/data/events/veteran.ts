import type { EventDef } from '../../game/entities/event'
import { isNonImperialStartingWeapon, isWeaponLinkedAction } from '../../game/roguelite/util'

/** node 2: 挑兵器 → 叙事 → 选兵器 → 收好 → 继续 */
export const VETERAN_N02_WEAPON: EventDef = {
    id: 'veteran_n02_weapon',
    name: '挑兵器',
    description: '你从小扒在训练场边偷看，老兵们操练的家伙事，你一件件都认得。',
    rewardType: 'weapon',
    // 军械堆里的家伙事皆为寻常兵刃，不含御物（玄门血统限定）
    rewardFilter: isNonImperialStartingWeapon,
    rounds: [
        {
            id: 'intro',
            title: '兵器架',
            description:
                '训练场的兵器架就摆在墙根，夜里没人收。你趁黑摸进去，借着月光一件件摸过去——老兵们说，兵器认人，摸到哪件，哪件就是你的。',
            choices: [{ id: 'reward_round', type: 'continue', label: '挑一件' }],
        },
        { id: 'reward_round', title: '选择兵器', choices: [] },
        {
            id: 'epilogue',
            title: '收好',
            description: '你把兵器裹进破布里藏好。从那天起，栅栏缝里多了一双偷偷比划的眼睛。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

export const VETERAN_N03_INTRO: EventDef = {
    id: 'veteran_n03_intro',
    name: '偷学',
    description: '你照着小校场上老兵们练的把式偷偷模仿。',
    rewardType: 'action',
    // 摸索出的路数必与 n2 所选兵器同源（2AP，requiredTags 与兵器 tags 匹配）
    rewardFilter: isWeaponLinkedAction,
    rounds: [
        {
            id: 'scene',
            title: '学艺',
            description: '你照着小校场上老兵们练的把式偷偷模仿，一来二去，竟也摸索出了几招自己的路数。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续练' }],
        },
        {
            id: 'reward_round',
            title: '小有所成',
            description: '你把那几招比划给墙角的木桩看。木桩没说话，但你知道，成了。',
            choices: [],
        },
    ],
}

export const VETERAN_START_TRAINING: EventDef = {
    id: 'veteran_start_training',
    name: '正式训练',
    description: '白山月注意到了栅栏边偷看的你。',
    rewardType: 'action',
    rounds: [
        {
            id: 'intro',
            title: '被发现',
            description:
                '你被白山月抓了个正着。她上下打量了你一番，笑了：「小子，有毅力。想学？明天早上卯时，训练场上见。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '卯时到' }],
        },
        { id: 'reward_round', title: '第一课', choices: [] },
        {
            id: 'epilogue',
            title: '白山月的话',
            description: '白山月拍了拍你的肩：「底子虽然野，根骨不错。从今天起我就是你的教官。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

export const VETERAN_N05_FORMAL: EventDef = {
    id: 'veteran_n05_formal',
    name: '正规训练',
    description: '年月如梭。十四岁那年，你正式成为军营的勤杂。',
    rewardType: 'points',
    rounds: [
        {
            id: 'scene',
            title: '成长',
            description: '年月如梭。十四岁那年，你正式成为军营的勤杂，开始接受正规训练。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '第一次操练',
            description: '你站进队伍里，第一次没人把你当小孩。',
            choices: [],
        },
    ],
}

export const VETERAN_N06_ENLIST: EventDef = {
    id: 'veteran_n06_enlist',
    name: '入伍',
    description: '十六岁，你正式入伍。',
    rewardType: 'points',
    rounds: [
        {
            id: 'scene',
            title: '新兵',
            description: '十六岁，你正式入伍。多年的苦练终于派上用场，你在新兵训练中脱颖而出。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '授衔',
            description: '班长把军衔别上你衣领的时候，你想起了死在战场上的父亲。',
            choices: [],
        },
    ],
}

export const VETERAN_N08_PATH_CHOICE: EventDef = {
    id: 'veteran_n08_path_choice',
    name: '军旅分岔路',
    description: '部队生涯也走到了岔路口。',
    rewardType: 'points',
    rounds: [
        {
            id: 'choice',
            title: '抉择',
            description: '经过多年军营打磨，你已经成为一名出色的士兵。但接下来怎么走，需要你自己决定。',
            choices: [
                {
                    id: 'reward_round',
                    type: 'continue',
                    label: '接受秘密任务',
                    description: '被选入特别行动组，以卧底身份渗透可疑组织',
                    setFlags: { veteran_undercover: true },
                },
                {
                    id: 'reward_round',
                    type: 'continue',
                    label: '正常服役退伍',
                    description: '按部就班地服役，期满后退伍返乡',
                    setFlags: { veteran_normal: true },
                },
            ],
        },
        {
            id: 'reward_round',
            title: '新路',
            description: '无论哪条路，你都不会回头。',
            choices: [],
        },
    ],
}
