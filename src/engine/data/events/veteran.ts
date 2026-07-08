import type { EventDef } from '../../entities/event'

export const VETERAN_N02_INTRO: EventDef = {
    id: 'veteran_n02_intro',
    name: '偷看训练',
    description: '你天天扒在军营训练场的栅栏边偷看。',
    rewardType: 'points',
    rounds: [
        {
            id: 'scene',
            title: '栅栏边',
            description:
                '你天天扒在军营训练场的栅栏边偷看，晚上趁没人时捡根木棍自己比划。时间长了，居然也让你学了个七七八八。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

export const VETERAN_N03_INTRO: EventDef = {
    id: 'veteran_n03_intro',
    name: '偷学',
    description: '你照着小校场上老兵们练的把式偷偷模仿。',
    rewardType: 'points',
    rounds: [
        {
            id: 'scene',
            title: '学艺',
            description: '你照着小校场上老兵们练的把式偷偷模仿，一来二去，竟也摸索出了几招自己的路数。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

export const VETERAN_START_TRAINING: EventDef = {
    id: 'veteran_start_training',
    name: '正式训练',
    description: '陆红提注意到了栅栏边偷看的你。',
    rewardType: 'action',
    rounds: [
        {
            id: 'intro',
            title: '被发现',
            description:
                '你被陆红提抓了个正着。她上下打量了你一番，笑了：「小子，有毅力。想学？明天早上卯时，训练场上见。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '卯时到' }],
        },
        { id: 'reward_round', title: '第一课', choices: [] },
        {
            id: 'epilogue',
            title: '陆红提的话',
            description: '陆红提拍了拍你的肩：「底子虽然野，根骨不错。从今天起我就是你的教官。」',
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
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
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
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
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
                    id: 'undercover',
                    type: 'continue',
                    label: '接受秘密任务',
                    description: '被选入特别行动组，以卧底身份渗透可疑组织',
                    setFlags: { veteran_undercover: true },
                },
                {
                    id: 'normal',
                    type: 'continue',
                    label: '正常服役退伍',
                    description: '按部就班地服役，期满后退伍返乡',
                    setFlags: { veteran_normal: true },
                },
            ],
        },
    ],
}
