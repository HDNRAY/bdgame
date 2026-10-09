import type { EventDef } from '../../game/entities/event'
import { END_EVENT } from '../../game/entities/round'
import type { Round } from '../../game/entities/round'

// ════════════════════════════════════════
//  出身事件（n1 · 你从哪里来）
//  每个故事线一个出身事件：先展示一场教学观战（该线指定的 AI vs AI），再进入出身场景。
//  选项文案 = 事件 name（场景化短句），展开叙事 = description + rounds。
//  需要扩展 n1 时，直接给对应出身事件加轮次/选项即可。
//
//  每线三段：教程故事 → 观战 → 出身场景。教程故事是它自己的一个轮次（单独显示），
//  文案各线各写，要当作紧随其后的出身场景的引子来写，并保留「看的是别人的交手」这层信息。
// ════════════════════════════════════════

/**
 * 教程故事轮（观战之前单独一轮，纯剧情推进）
 * 文案由各线自己给：接着下面的观战与出身场景写，别写成说明文。
 */
function tutorialStory(description: string): Round {
    return {
        id: 'intro',
        title: '开场',
        description,
        choices: [{ id: 'tutorial', type: 'continue', label: '继续' }],
    }
}

/**
 * 教学观战轮（该线指定的 AI vs AI n33 演示；不计玩家胜负/伤势/奖励）
 * 不挂 description：剧情由前一格的教程故事轮承担，这一格只有「观战」标题 + 面板 + UI 的教学提示条。
 */
function tutorialRound(t: Round['tutorial']): Round {
    return {
        id: 'tutorial',
        title: '观战',
        tutorial: t,
        choices: [{ id: 'scene', type: 'continue', label: '继续' }],
    }
}

/** 玄门子弟：青山镇最古老的宗门之一，血脉中流淌着以炁御物的能力 */
export const ORIGIN_XUANMEN: EventDef = {
    id: 'origin_xuanmen',
    name: '你出自玄门',
    description: '玄门在青山镇立得最久。御物只走血脉，你生下来就有。',
    rounds: [
        tutorialStory('交手的是别人，你在旁边看。炁先起，物后走，招落得干净——招式和胜负都看清楚了，才回祖祠练功。'),
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
    description: '玄青宗百年一遇的道种，一次出了两个：你和师兄。',
    rounds: [
        tutorialStory('山门外的钟响了三下。交手的是别人，起手、拆招、收势，一招没乱——你站在师兄旁边，从头看到尾。'),
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
    description: '你在军队孤儿院长大。父亲没能从战场上回来，这件事你很早就知道。',
    rounds: [
        tutorialStory('训练场边，你扒着栅栏看两个老兵对练。谁先动，谁先露破绽，胜负只在一两下——你看到最后，把这两下记住了。'),
        tutorialRound({ aId: 'hongti', bId: 'otsu', aName: '白山月', bName: '橘子真' }),
        {
            id: 'scene',
            title: '营房',
            description:
                '从记事起，你听到的就是号角和操练。号声一响，操场上的沙土就扬起来。\n\n没有家族，没有牵挂——军营的边，就是你的家。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 奇遇流：巷子里长大的孤儿，玩伴一个失踪、一个远走 */
export const ORIGIN_WANDERER: EventDef = {
    id: 'origin_wanderer',
    name: '你是巷子里长大的孤儿',
    description: '你和陶朵、奇岚在巷子里一起长大。后来一个不见了，一个走了。',
    rounds: [
        tutorialStory(
            '陶朵带着你和奇岚去看热闹。人堆最前面，两个人交手，招式快，收得也快——谁赢，你看得清楚。散了场，三个人溜回巷子。',
        ),
        tutorialRound({ aId: 'yangguo', bId: 'longnv', aName: '杨之改', bName: '龙语仙' }),
        {
            id: 'scene',
            title: '巷子',
            description:
                '陶朵失踪那天，没有人告诉你她去了哪里；奇岚进了协会。\n\n你一个人在山野间行走修炼。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 血海深仇：林家最后的血脉，一场大火烧掉了一切 */
export const ORIGIN_FEUD: EventDef = {
    id: 'origin_feud',
    name: '你是林家最后的血脉',
    description: '林家世代反对义体研究。六岁那年，你从火里被人抱出来。',
    rounds: [
        tutorialStory(
            '那场火之前，你站在人群外看过一场交手。谁先出手，谁留了后手，一招一式你都记着——那时候你还小，只记住了招式。',
        ),
        tutorialRound({ aId: 'jiran', bId: 'heiyun', aName: '姬然', bName: '玄木' }),
        {
            id: 'scene',
            title: '火',
            description:
                '火烧起来的时候，你什么都不知道。把你抱出来的人是会长姬仲——你父亲的挚友。\n\n你从此在青山镇长大。那场火是义体研究部的手笔。',
            choices: [{ id: END_EVENT, type: 'continue', label: '继续' }],
        },
    ],
}

/** 全部出身事件 */
export const ORIGIN_EVENTS: EventDef[] = [ORIGIN_XUANMEN, ORIGIN_SECT, ORIGIN_VETERAN, ORIGIN_WANDERER, ORIGIN_FEUD]
