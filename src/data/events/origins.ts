import type { EventDef } from '../../game/entities/event'
import { END_EVENT } from '../../game/entities/round'
import type { Round } from '../../game/entities/round'

// ════════════════════════════════════════
//  出身事件（n1 · 你从哪里来）
//  每个故事线一个出身事件：先展示一场教学观战（该线指定的 AI vs AI），再进入出身场景。
//  选项文案 = 事件 name（场景化短句），展开叙事 = description + rounds。
//  需要扩展 n1 时，直接给对应出身事件加轮次/选项即可。
// ════════════════════════════════════════

/** 教学观战轮（该线指定的 AI vs AI n33 演示；不计玩家胜负/伤势/奖励） */
function tutorialRound(t: Round['tutorial']): Round {
    return {
        id: 'tutorial',
        title: '观战',
        description: '在开始之前，先看看一场巅峰对决。',
        tutorial: t,
        choices: [{ id: 'scene', type: 'continue', label: '继续' }],
    }
}

/** 玄门子弟：青山镇最古老的宗门之一，血脉中流淌着以炁御物的能力 */
export const ORIGIN_XUANMEN: EventDef = {
    id: 'origin_xuanmen',
    name: '你出自玄门',
    description: '玄门，青山镇最古老的宗门之一，血脉中拥有以炁御物的能力。',
    rounds: [
        tutorialRound({ aId: 'xuanji', bId: 'wukong', aName: '玄机', bName: '孙悟' }),
        {
            id: 'scene',
            title: '祖祠',
            description:
                '你从记事起就在修炼家传功法，御物即手足。你有一个双胞胎姐姐，一起练功，一起挨罚。\n\n只是家里有件事，大人们从不提起——你问过，没人答你。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 天生道种：百年一遇的根骨，自幼与师兄同入玄青宗山门 */
export const ORIGIN_SECT: EventDef = {
    id: 'origin_sect',
    name: '你是玄青宗的道种',
    description: '百年一遇的根骨，自幼与师兄一同入玄青宗山门修行。',
    rounds: [
        tutorialRound({ aId: 'layue', bId: 'fengshui', aName: '赵越', bName: '风似水' }),
        {
            id: 'scene',
            title: '山门',
            description:
                '你记事起就在山上。玄青宗的钟声、腊月师姐的鞭子、师兄总走在你前面半步的影子。你们年纪有差，但一起入门，是最亲近的同门。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 军旅退伍：军营边长大的孤儿，父亲是战死的军人 */
export const ORIGIN_VETERAN: EventDef = {
    id: 'origin_veteran',
    name: '你生在军营边',
    description: '父亲是军人，战死了。',
    rounds: [
        tutorialRound({ aId: 'hongti', bId: 'otsu', aName: '白山月', bName: '橘子真' }),
        {
            id: 'scene',
            title: '营房',
            description:
                '你在军队孤儿院长大，从记事起，听到的就是号角和操练。父亲是军人，没能从战场上回来。没有家族，没有牵挂——军营的边，就是你的家。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 奇遇流：巷子里长大的孤儿，玩伴一个失踪、一个远走 */
export const ORIGIN_WANDERER: EventDef = {
    id: 'origin_wanderer',
    name: '你是巷子里长大的孤儿',
    description: '你和陶朵、奇岚都是孤儿，一起在镇子的巷子里长大。',
    rounds: [
        tutorialRound({ aId: 'yangguo', bId: 'longnv', aName: '杨之改', bName: '龙语仙' }),
        {
            id: 'scene',
            title: '巷子',
            description:
                '陶朵、奇岚和你，都是孤儿，一块儿在巷子里长大。陶朵失踪那天，没有人告诉你她去了哪里；奇岚后来进了协会。你一个人在山野间行走修炼。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 血海深仇：林家最后的血脉，一场大火烧掉了一切 */
export const ORIGIN_FEUD: EventDef = {
    id: 'origin_feud',
    name: '你是林家最后的血脉',
    description: '林家世代反对义体研究。',
    rounds: [
        tutorialRound({ aId: 'jiran', bId: 'heiyun', aName: '姬然', bName: '玄木' }),
        {
            id: 'scene',
            title: '火',
            description:
                '那年你六岁。大火烧起来的时候，你什么都不知道，只知道有人把你从火里抱了出来——会长姬仲，你父亲挚友。你从此在青山镇长大，只知道那场火是义体研究部的手笔。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 全部出身事件 */
export const ORIGIN_EVENTS: EventDef[] = [ORIGIN_XUANMEN, ORIGIN_SECT, ORIGIN_VETERAN, ORIGIN_WANDERER, ORIGIN_FEUD]
