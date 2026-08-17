import type { EventDef } from '../../game/entities/event'
import { N2_WEAPON_CHOICES, STAGE1_MID, storyRenderWhen, storyWhen } from './layout'

// ════════════════════════════════════════
//  天生道种 — 自定义事件
// ════════════════════════════════════════

/** node 2: 选兵器（藏兵阁，固定 5 选 1） */
export const SECT_N02_WEAPON: EventDef = {
    id: 'sect_n02_weapon',
    name: '选兵器',
    description: '入山门那年你刚满五岁。掌门领你到藏兵阁，让你以炁感应。三件法器微微发光，等你伸手。',
    placement: [{ nodes: [2], when: storyWhen('sect') }],
    reward: { kind: 'fixed', choices: N2_WEAPON_CHOICES },
    rounds: [
        {
            id: 'intro',
            title: '藏兵阁',
            description: '入山门那年你刚满五岁。掌门领你到藏兵阁，让你以炁感应。三件法器微微发光，等你伸手。',
            choices: [{ id: 'reward_round', type: 'continue', label: '伸手' }],
        },
        { id: 'reward_round', title: '选择法器', choices: [] },
        {
            id: 'epilogue',
            title: '掌门的话',
            description:
                '掌门微微颔首：「法器择主，你与它有缘。从今日起它便是你的本命法器，好生待它。修行之路漫长，戒骄戒躁。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 3: 选招式（与兵器同源的 2AP 招式） */
export const SECT_N03_ACTION: EventDef = {
    id: 'sect_n03_action',
    name: '选招式',
    description: '入门后腊月师姐负责带你和师兄。她翻了翻你们的根骨记录，丢过来三门基础功法让你们挑。',
    placement: [{ nodes: [3], when: storyWhen('sect') }],
    reward: { kind: 'item', pool: 'action', apMax: 2, noPrePost: true, requireTags: true },
    rounds: [
        {
            id: 'intro',
            title: '传功',
            description: '入门后腊月师姐负责带你和师兄。她翻了翻你们的根骨记录，丢过来三门基础功法让你们挑。',
            choices: [{ id: 'reward_round', type: 'continue', label: '挑选' }],
        },
        { id: 'reward_round', title: '选择功法', choices: [] },
        {
            id: 'epilogue',
            title: '腊月的话',
            description: '腊月师姐看了看你和师兄的选择，点点头：「眼光不错。练熟了来找我，我教你们怎么用。别偷懒。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 11: 与师兄对决 → 感悟选奖励 → 师兄被假死掳走 */
export const SECT_N11_TRAGEDY: EventDef = {
    id: 'sect_n11_tragedy',
    name: '师兄弟对决',
    description: '宗门大比，你与师兄站在擂台两端。',
    placement: [{ nodes: [11], when: storyWhen('sect') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'intro',
            title: '擂台',
            description: '宗门大比，你与师兄站在擂台两端。师兄笑着说：「可别放水啊。」你握紧兵器，点了点头。',
            choices: [{ id: 'combat_round', type: 'continue', label: '出招' }],
        },
        {
            id: 'combat_round',
            title: '对决',
            enemyId: 'junshi',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '战斗中感悟',
            choices: [],
        },
        {
            id: 'aftermath',
            title: '大火',
            description:
                '你收起兵器，正要去扶师兄，四周突然燃起大火。混乱中有人趁乱将师兄的"尸体"拖走。你追出去，只看到废墟中白布下渗出的血。你跪在雨中，不明白为什么最亲的人会抛下你。你才九岁。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 16: 比武大会看到师兄 */
export const SECT_N16_REUNION: EventDef = {
    id: 'sect_n16_reunion',
    name: '重逢',
    description: '九年了。你在比武大会台下人群中看到了师兄的身影。',
    placement: [{ nodes: [16], when: storyWhen('sect') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '惊鸿一瞥',
            description:
                '九年了。你代表宗门参加比武大会，台下人群中闪过一个熟悉的身影——师兄！你追出三里地，却被一个用毒的女人拦住。待你逼退她，师兄早已不见。毒入经脉的剧痛让你清醒：他还活着，但已经不是你的师兄了。这份执念，从这一刻开始。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '执念',
            description: '你握紧拳，把这份执念咽进肚子里。',
            choices: [],
        },
    ],
}

/** node 19: 追踪陶朵 */
export const SECT_N19_TRAIL: EventDef = {
    id: 'sect_n19_trail',
    name: '追踪',
    description: '三年了。你在调查非法义体交易时意外看到了陶朵。',
    placement: [{ nodes: [19], when: storyWhen('sect') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '线索',
            description:
                '三年了。你一直在天下行走，借调查之名寻找师兄的下落。这天你在隔壁镇查一宗非法义体交易，意外看到了陶朵——三年前那个女人。你听到他们提到"斗炁大会"。你压下冲动，先完成了调查任务。师兄的事，不能急。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '沉住气',
            description: '你回到住处，把今晚看到的每一张脸都记了下来。',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  归海楼研讨会（sect 主线）：n14 抵达切磋（桑原）、n15 表演赛（一刀 vs 腊月师姐）
//  归海楼对天生道种/玄门是主线段，共享池版已为这两线让位。
// ════════════════════════════════════════

/** node 14: 主线·归海楼·切磋——与桑原切磋；斗篷人里有一个身形像师兄 */
export const SECT_GUIHAILOU_ARRIVE: EventDef = {
    id: 'sect_guihailou_arrive',
    name: '归海楼·切磋',
    description: '归海楼广发英雄帖，宗门派你前往。',
    placement: [{ nodes: [14], when: storyWhen('sect') }],
    effects: [{ kind: 'set', flag: 'guihailou_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'arrive',
            title: '抵达归海楼',
            description:
                '归海楼山门前人声鼎沸。你递上宗门名帖，小厮领你入座。台上桑原正在与人切磋，刀光剑影。观众席一角，两个身着斗篷的人正在低声交谈——其中一个的身形，让你想起师兄。你摇了摇头。师兄已经不在了。',
            choices: [{ id: 'combat_round', type: 'continue', label: '下场切磋' }],
        },
        {
            id: 'combat_round',
            title: '切磋桑原',
            enemyId: 'sangyuan',
            description: '你跃上擂台，朝桑原抱拳。他眯起眼，笑了：「有意思。来吧。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        { id: 'reward_round', title: '收获', choices: [] },
    ],
}

/** node 15: 主线·归海楼·表演赛——观看一刀 vs 腊月师姐 */
export const SECT_GUIHAILOU_SHOW: EventDef = {
    id: 'sect_guihailou_show',
    name: '归海楼·表演赛',
    description: '归海楼掌门一刀亲自下场，与腊月师姐表演。',
    placement: [{ nodes: [15], when: storyWhen('sect') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'watch',
            title: '表演赛',
            description:
                '归海楼掌门一刀亲自下场，与腊月师姐表演。剑气纵横，满座喝彩。你坐在席上，看得心头发热——那是山门之外的路数，你从没见过的走法。',
            choices: [{ id: 'reward_round', type: 'continue', label: '鼓掌' }],
        },
        {
            id: 'reward_round',
            title: '回程',
            description: '散场后腊月师姐找到你，敲了敲你的脑袋：「看傻了？回去把今天的路数默一遍，明早考你。」',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  一阶段中段（n4-7）渲染池：宗门日子
//  从 n4 起主角已 7-8 岁；渲染池 3 选 1 候选，每局各至多一次，可空缺。
// ════════════════════════════════════════

/** node 4-7 渲染池：师兄照顾（为 n11 师兄弟对决铺垫） */
export const SECT_RENDER_SHIXIONG: EventDef = {
    id: 'sect_render_shixiong',
    name: '师兄照顾',
    description: '师兄总是先你一步，把路走一遍。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('sect', 'sect_render_shixiong_done') },
    ],
    effects: [{ kind: 'set', flag: 'sect_render_shixiong_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '喂招',
            description: '师兄陪你喂招，总让着你半招，等你差一点够到他衣角的时候，再假装失手。「快了。」他说。你信了。',
            choices: [{ id: 'reward_round', type: 'continue', label: '再练' }],
        },
        {
            id: 'reward_round',
            title: '衣角',
            description: '很多年后你才知道，他从没失过手。他只是想先把那条路，自己走一遍。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：腊月师姐 */
export const SECT_RENDER_LAYUE: EventDef = {
    id: 'sect_render_layue',
    name: '腊月师姐',
    description: '腊月师姐凶得很，山门上下都怕她。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('sect', 'sect_render_layue_done') },
    ],
    effects: [{ kind: 'set', flag: 'sect_render_layue_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '罚站',
            description: '你偷懒被腊月师姐逮住，罚在殿外站了一炷香。末了她扔给你一个馒头：「站够了？站够了明天卯时，不许迟到。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '接过馒头' }],
        },
        {
            id: 'reward_round',
            title: '馒头',
            description: '馒头是热的。你后来才知道，那是她省下的晚饭。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：山门早课 */
export const SECT_RENDER_MEN: EventDef = {
    id: 'sect_render_men',
    name: '山门早课',
    description: '山门的早课，从寅时的钟声开始。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('sect', 'sect_render_men_done') },
    ],
    effects: [{ kind: 'set', flag: 'sect_render_men_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '钟声',
            description: '寅时的钟声一响，全山门的弟子都往演武场跑。你裹着单衣混在队伍里，呵出的白气混着松香——山里的日子，苦，但安稳。',
            choices: [{ id: 'reward_round', type: 'continue', label: '跟上队伍' }],
        },
        {
            id: 'reward_round',
            title: '松香',
            description: '你跟着师兄师姐们打完一套拳，天边刚泛起鱼肚白。师父站在台阶上，看了你们一眼，没说话。',
            choices: [],
        },
    ],
}
