import type { EventDef } from '../../game/entities/event'
import { N2_WEAPON_CHOICES, SPAR_RANGE, storyRenderWhen, storyWhen } from './layout'

// ════════════════════════════════════════
//  军旅退伍 — 自定义事件
// ════════════════════════════════════════

/** node 2: 挑兵器（军械架，固定 5 选 1） */
export const VETERAN_N02_WEAPON: EventDef = {
    id: 'veteran_n02_weapon',
    name: '挑兵器',
    description: '你从小扒在训练场边偷看，老兵们操练的家伙事，你一件件都认得。',
    placement: [{ nodes: [2], when: storyWhen('veteran') }],
    reward: { kind: 'fixed', choices: N2_WEAPON_CHOICES },
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

/** node 3: 偷学把式（与兵器同源的 2AP 招式） */
export const VETERAN_N03_INTRO: EventDef = {
    id: 'veteran_n03_intro',
    name: '偷学',
    description: '你照着小校场上老兵们练的把式偷偷模仿。',
    placement: [{ nodes: [3], when: storyWhen('veteran') }],
    reward: { kind: 'item', pool: 'action', apMax: 2, noPrePost: true, requireTags: true },
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

/** node 4: 被发现（白山月指点 → 招式） */
export const VETERAN_START_TRAINING: EventDef = {
    id: 'veteran_start_training',
    name: '正式训练',
    description: '白山月注意到了栅栏边偷看的你。',
    placement: [{ nodes: [4], when: storyWhen('veteran') }],
    reward: { kind: 'item', pool: 'action' },
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

/** node 5: 正规训练 */
export const VETERAN_N05_FORMAL: EventDef = {
    id: 'veteran_n05_formal',
    name: '正规训练',
    description: '年月如梭。十四岁那年，你正式成为军营的勤杂。',
    placement: [{ nodes: [5], when: storyWhen('veteran') }],
    reward: { kind: 'points' },
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

/** node 6: 入伍 */
export const VETERAN_N06_ENLIST: EventDef = {
    id: 'veteran_n06_enlist',
    name: '入伍',
    description: '十六岁，你正式入伍。',
    placement: [{ nodes: [6], when: storyWhen('veteran') }],
    reward: { kind: 'points' },
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

/** node 8: 军旅分岔路（选择写 flag，后续事件按 flag 分支） */
export const VETERAN_N08_PATH_CHOICE: EventDef = {
    id: 'veteran_n08_path_choice',
    name: '军旅分岔路',
    description: '部队生涯也走到了岔路口。',
    placement: [{ nodes: [8], when: storyWhen('veteran') }],
    reward: { kind: 'points' },
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
                    effects: [{ kind: 'setMany', flags: { veteran_undercover: true } }],
                },
                {
                    id: 'reward_round',
                    type: 'continue',
                    label: '正常服役退伍',
                    description: '按部就班地服役，期满后退伍返乡',
                    effects: [{ kind: 'setMany', flags: { veteran_normal: true } }],
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

// ════════════════════════════════════════
//  一阶段中段渲染池：同袍（军旅 n4-6 已有主线，n7 是第一个池节点）
//  军旅节奏与其他线不同（n5 起已十四岁上下），渲染事件按军营时间线写。
// ════════════════════════════════════════

/** node 7 渲染池：老柴（伙房老兵，教你认兵器） */
export const VETERAN_RENDER_LAOCHAI: EventDef = {
    id: 'veteran_render_laochai',
    name: '同袍',
    description: '老柴是伙房的老兵，什么都知道一点。',
    placement: [
        { nodes: [7], fallback: true, weight: 2, when: storyRenderWhen('veteran', 'veteran_render_laochai_done') },
    ],
    effects: [{ kind: 'set', flag: 'veteran_render_laochai_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '伙房',
            description: '你偷学被逮住那天，是老柴替你打了圆场。他往你手里塞了块烤饼：「想学？先把身子骨养壮。晚上来伙房，我教你认兵器。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '晚上到' }],
        },
        {
            id: 'reward_round',
            title: '认兵器',
            description: '伙房油灯下，老柴把军营里的家伙事一件件摆开，教你认、教你使。末了他叹了口气：「能不上战场，就别上战场。」',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  第二阶段主线（veteran）：n16 兄弟之死（卧底/退伍两分支）→ n17 追查 → n19 李雪影
//  n8 军旅分岔路已写 veteran_undercover / veteran_normal，此处按分支渲染。
// ════════════════════════════════════════

/** node 16: 主线·兄弟之死——老柴（卧底线）/ 柴哥（退伍线）被组织清理 */
export const VETERAN_N16_BROTHER_DEATH: EventDef = {
    id: 'veteran_n16_brother_death',
    name: '兄弟之死',
    description: '碰头点，你没等到人。',
    placement: [{ nodes: [16], when: storyWhen('veteran') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '碰头点',
            description: '你按约定时间到碰头点，人没来。等了一夜，还是没来。你顺着所有能想到的地方找过去，最后在一条巷子里找到了他。',
            choices: [
                {
                    id: 'undercover',
                    type: 'continue',
                    label: '卧底线',
                    when: { '==': [{ var: 'flags.veteran_undercover' }, true] },
                    description: '老柴已经查到了组织与 2074 年林家灭门有关的间接证据，还没来得及上报，被灭口。',
                },
                {
                    id: 'normal',
                    type: 'continue',
                    label: '退伍线',
                    when: { '==': [{ var: 'flags.veteran_normal' }, true] },
                    description: '柴哥是军方卧底，被组织清理了。他跟你一样接了任务，只是没告诉你。',
                },
            ],
        },
        {
            id: 'undercover',
            title: '老柴',
            description:
                '他躺在巷子里，手还握着腰间的传讯器——没来得及发出去。他身上没有证件、没有身份标识，像一片被清理干净的垃圾。你不能收尸。不能打听。不能表现出任何异样。你是卧底。你回到住处，把自己关在厕所里，对着马桶吐了很久，然后擦干嘴，给自己加装了第一件义体——组织给的"诚意"。',
            choices: [{ id: 'reward_round', type: 'continue', label: '记下' }],
        },
        {
            id: 'normal',
            title: '柴哥',
            description:
                '你辗转打听到他失踪前经常去九朵桃花，似乎在调查什么。后来你从白山月那里得知：柴哥是军方卧底，被组织清理了。他怕你担心，想自己搞定。他没等到收网那天。',
            choices: [{ id: 'reward_round', type: 'continue', label: '记下' }],
        },
        {
            id: 'reward_round',
            title: '从那以后',
            description: '他死在巷子里的那天，你心里有什么东西也跟着死了。从那以后，你不再怕死。你只怕报不了仇。',
            choices: [],
        },
    ],
}

/** node 17: 主线·追查——无论哪条路，追查兄弟死因 */
export const VETERAN_N17_TRAIL: EventDef = {
    id: 'veteran_n17_trail',
    name: '追查',
    description: '你开始查他到底是被谁出卖的。',
    placement: [{ nodes: [17], when: storyWhen('veteran') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '线索',
            description:
                '卧底线：老柴的死让你更深入组织内部。你一面获取信任，一面暗中查他是被谁出卖的。退伍线：柴哥的死让你重新联系上军方——他们一直在查组织的活动，柴哥是他们的人。两条路的终点是一样的：你要在斗炁大会上，跟组织的人做个了断。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续查' }],
        },
        { id: 'reward_round', title: '名单', description: '你把经手过的人都记了下来。总有一个名字，会自己浮出来。', choices: [] },
    ],
}

/** node 19: 主线·李雪影——军方斥候提供线索 */
export const VETERAN_N19_LIXUEYING: EventDef = {
    id: 'veteran_n19_lixueying',
    name: '李雪影',
    description: '一个自称李雪影的人找上了你。',
    placement: [{ nodes: [19], when: storyWhen('veteran') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '斥候',
            description:
                '李雪影——军方斥候，白山月手下，你兄弟的战友。他告诉你更多关于组织渗透的线索：「组织里有军方的人，但已经叛变了。你们这些被发现的卧底，几乎都是被他出卖的。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '记下' }],
        },
        {
            id: 'reward_round',
            title: '名字',
            description: '「叛变的人是谁？」你没问出口。你知道迟早会查到的。斗炁大会见。',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  二阶段切磋池（n10-21，3 选 1，可空缺）：军营与斥候李雪影过招
// ════════════════════════════════════════

/** node 10-21 切磋池：李雪影（军方斥候，白山月手下——n19 提供线索前先交手认识） */
export const VETERAN_SPAR_LIXUEYING: EventDef = {
    id: 'veteran_spar_lixueying',
    name: '切磋·李雪影',
    description: '校场上，斥候李雪影朝你勾了勾手。',
    placement: [
        {
            range: SPAR_RANGE,
            fallback: true,
            weight: 2,
            when: storyRenderWhen('veteran', 'veteran_spar_lixueying_done'),
        },
    ],
    effects: [{ kind: 'set', flag: 'veteran_spar_lixueying_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '校场',
            description: '李雪影是白山月手下的斥候，话少，手快。他在校场上拦下你：「过两招。斥候的身手，你早晚用得上。」',
            choices: [{ id: 'combat_round', type: 'continue', label: '过招' }],
        },
        {
            id: 'combat_round',
            title: '过招',
            enemyId: 'lueying',
            description: '他的路子飘忽，专走你防不住的角度。几轮下来，你吃了不少苦头，也学了不少。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收手' }],
        },
        {
            id: 'reward_round',
            title: '领教',
            description: '李雪影点点头：「不错。以后有事，可以来找我。」你没多想这句话——直到后来你才明白它的分量。',
            choices: [],
        },
    ],
}
