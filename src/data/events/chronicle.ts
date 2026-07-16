import type { EventDef } from '../../game/entities/event'

/** 归海楼比武大会（支线版 — 非玄门线玩家） */
export const CHRONICLE_GUIHAILOU: EventDef = {
    id: 'chronicle_guihailou',
    name: '归海楼比武大会',
    description: '归海楼广发英雄帖，各派齐聚切磋。你以散人身份受邀观战。',
    rewardType: 'action',
    rounds: [
        {
            id: 'arrive',
            title: '抵达归海楼',
            description:
                '归海楼山门前人声鼎沸。你递上请帖，小厮领你入座。台上桑原正在与人切磋，刀光剑影。观众席一角，两个身着斗篷的人正在低声交谈——后来你才听说，那是军师和博士，以"观摩"为名收集战斗数据。',
            choices: [{ id: 'watch', type: 'continue', label: '观战' }],
        },
        {
            id: 'watch',
            title: '观战切磋',
            description:
                '几轮切磋下来，你对各家路数有了新的理解。归海楼掌门一刀亲自下场与一位老道表演，剑气纵横，满座喝彩。',
            choices: [{ id: 'reward', type: 'continue', label: '有所感悟' }],
        },
        {
            id: 'reward',
            title: '收获',
            choices: [],
        },
    ],
}

/** 九朵桃花酒吧杀人事件（支线版 — 目击/听闻） */
export const CHRONICLE_BAR_KILLING: EventDef = {
    id: 'chronicle_bar_killing',
    name: '九朵桃花之夜',
    description: '杏花街的九朵桃花酒吧出了事——有人死了。',
    rewardType: 'points',
    rounds: [
        {
            id: 'heard',
            title: '传闻',
            description:
                '你在街上听说九朵桃花酒吧昨晚出了事。有人被杀，凶手消失得无影无踪。酒吧照常营业，但吧台后面那排药酒瓶少了几瓶——有人说是飞虎·竹子送的跌打酒，也有人说是别的什么东西。你路过宝字堂药铺时，看见里面碾药的姑娘神情有些恍惚。',
            choices: [{ id: 'investigate', type: 'continue', label: '打听详情' }],
        },
        {
            id: 'investigate',
            title: '线索',
            description:
                '街坊们议论纷纷，但没有人说得清真相。你只打听到死者是个外来人，平时不怎么露面。据说朵儿那晚在店里，但第二天照常开门，像什么都没发生过。',
            choices: [{ id: 'reward', type: 'continue', label: '记在心里' }],
        },
        {
            id: 'reward',
            title: '警觉',
            choices: [],
        },
    ],
}

/** 青山之巅·六绝比武 */
export const CHRONICLE_SIX_DUEL: EventDef = {
    id: 'chronicle_six_duel',
    name: '青山之巅·六绝',
    description: '青山绝顶，六位绝世高手约定比武。你有幸旁观了这一盛事。',
    rewardType: 'action',
    rounds: [
        {
            id: 'summit',
            title: '绝顶观战',
            description:
                '青山绝顶上，六道人影分立各方。逸（龙女）、破（孙悟）、闪（西瓜）、观（过儿）、悟（寻香）、韧（酒鬼·无志）。你远远望着，大气都不敢出。观众席另一侧，军师、朵儿、博士三人也在。他们说是来收集数据的，但你总觉得他们的眼神不太对。',
            choices: [{ id: 'watch', type: 'continue', label: '屏息观战' }],
        },
        {
            id: 'watch',
            title: '绝世之战',
            description:
                '六人交手，每一招都让你心头一震。你拼命记住那些身法与轨迹。战斗结束后，寻香朝你这边看了一眼，微微点头，然后转身离去。',
            choices: [{ id: 'reward', type: 'continue', label: '有所领悟' }],
        },
        {
            id: 'reward',
            title: '领悟',
            choices: [],
        },
    ],
}

/** 喝酒结拜 */
export const CHRONICLE_SWORD_BROTHERS: EventDef = {
    id: 'chronicle_sworn_brothers',
    name: '酒逢知己',
    description: '你在九朵桃花酒吧遇到一群豪爽之人，喝到兴起，结为兄弟。',
    rewardType: 'passive',
    rounds: [
        {
            id: 'tavern',
            title: '九朵桃花',
            description:
                '你在九朵桃花酒吧独酌。隔壁桌坐着几个人——一个老人、一个中年人和几个看起来也是江湖中人的男女。中年人刚才在街口打抱不平，被这几人拉进来喝酒。他们聊得热闹，见你一个人，便招呼你过去坐。酒过三巡，有人提议结拜。',
            choices: [{ id: 'drink', type: 'continue', label: '举杯' }],
        },
        {
            id: 'drink',
            title: '结拜',
            description:
                '大家喝到兴起，轮番表演轻功助兴。你也露了一手，赢得一片叫好。最后几个人醉醺醺地拜了把子，约好以后有难同当。',
            choices: [{ id: 'reward', type: 'continue', label: '散场' }],
        },
        {
            id: 'reward',
            title: '结拜之礼',
            choices: [],
        },
    ],
}

/** 编年史事件池 */
export const CHRONICLE_EVENTS: EventDef[] = [
    CHRONICLE_GUIHAILOU,
    CHRONICLE_BAR_KILLING,
    CHRONICLE_SIX_DUEL,
    CHRONICLE_SWORD_BROTHERS,
]
