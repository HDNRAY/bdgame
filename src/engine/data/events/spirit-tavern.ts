import type { EventDef } from '../../entities/event'

/**
 * 诡异的酒馆 - 复杂的多层交互事件
 *
 * 玩家在酒馆中遇到三个神秘人物（老板、醉鬼、蒙面人）
 * 每个人物都提供不同的选择路径和效果
 */
export const spiritTavernEvent: EventDef = {
    id: 'spirit_tavern',
    name: '诡异的酒馆',
    type: 'story',
    description: '你走进一家昏暗的酒馆，老板是一个神秘的人物。',
    steps: {
        start: {
            id: 'start',
            type: 'narrative',
            text: '酒馆里只有三个人：一个老板，一个醉鬼，一个蒙面人。老板冷冷地看着你。\n"要喝点什么？"',
            next: 'talk_choice',
        },
        talk_choice: {
            id: 'talk_choice',
            type: 'choice',
            prompt: '你决定和谁交谈？',
            choices: [
                {
                    label: '和老板交谈',
                    description: '打听一些信息',
                    next: 'bartender_talk',
                },
                {
                    label: '和醉鬼交谈',
                    description: '可能得到奇怪的建议',
                    next: 'drunk_talk',
                },
                {
                    label: '和蒙面人交谈',
                    description: '神秘且危险',
                    next: 'masked_talk',
                },
            ],
        },
        bartender_talk: {
            id: 'bartender_talk',
            type: 'narrative',
            text: '"你看起来要参加什么大赛。"老板拿出一个古老的酒杯。\n"喝了这个，你会变得更强——也会失去一些东西。你决定吗？"',
            next: 'bartender_choice',
        },
        bartender_choice: {
            id: 'bartender_choice',
            type: 'choice',
            prompt: '你的选择：',
            choices: [
                {
                    label: '喝下去',
                    description: '获得力量但失去智慧',
                    success: [],
                    next: 'bartender_end',
                },
                {
                    label: '拒绝',
                    description: '离开酒馆',
                    next: 'end',
                },
            ],
        },
        bartender_end: {
            id: 'bartender_end',
            type: 'narrative',
            text: '你感到浑身发热，肌肉变得强壮，但脑子变得混沌。老板点了点头。\n"去吧，战士。"',
            next: 'end',
        },
        drunk_talk: {
            id: 'drunk_talk',
            type: 'narrative',
            text: '"哈哈哈！"醉鬼突然跳起来。\n"你想赢？关键是速度！我告诉你一个秘密！"',
            next: 'drunk_choice',
        },
        drunk_choice: {
            id: 'drunk_choice',
            type: 'choice',
            prompt: '听他继续说？',
            choices: [
                {
                    label: '仔细听他的建议',
                    description: '他醉酒的话可能真有道理',
                    chance: 0.7,
                    success: [],
                    failure: [],
                    next: 'drunk_end',
                },
                {
                    label: '走开',
                    description: '他的话不可信',
                    next: 'end',
                },
            ],
        },
        drunk_end: {
            id: 'drunk_end',
            type: 'narrative',
            text: '醉鬼喝完酒后睡着了。你不确定他说的是否真的有用，但你感到身体轻盈了一些。',
            next: 'end',
        },
        masked_talk: {
            id: 'masked_talk',
            type: 'narrative',
            text: '"...你好像很强。"蒙面人用低沉的声音说。\n"我喜欢强者。要不要和我做一笔交易？"',
            next: 'masked_choice',
        },
        masked_choice: {
            id: 'masked_choice',
            type: 'choice',
            prompt: '你想听听他的提议吗？',
            choices: [
                {
                    label: '同意听他的提议',
                    description: '冒险但可能收益大',
                    next: 'masked_deal',
                },
                {
                    label: '拒绝并离开',
                    description: '不要和陌生人打交道',
                    next: 'end',
                },
            ],
        },
        masked_deal: {
            id: 'masked_deal',
            type: 'narrative',
            text: '"我需要一个人赢得比赛。如果你赢了，我会给你一件东西——来自另一个世界的宝物。"',
            next: 'masked_accept',
        },
        masked_accept: {
            id: 'masked_accept',
            type: 'choice',
            prompt: '你同意了吗？',
            choices: [
                {
                    label: '同意',
                    description: '为神秘人效力',
                    success: [{ type: 'grant_reward', rewardType: 'artifact' }],
                    next: 'end',
                },
                {
                    label: '拒绝',
                    description: '坚守自己的原则',
                    next: 'end',
                },
            ],
        },
        end: {
            id: 'end',
            type: 'narrative',
            text: '你离开了酒馆，继续前进。',
            next: undefined,
        },
    },
    firstStep: 'start',
    maxCount: 1,
    minNode: 6,
    rewardType: 'artifact',
}
