import type { EventDef } from '../../game/entities/event'
import { N2_WEAPON_CHOICES, storyWhen } from './layout'

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
