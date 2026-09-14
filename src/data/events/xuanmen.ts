import type { EventDef } from '../../game/entities/event'
import { SPAR_RANGE, storyRenderWhen, storyWhen } from './layout'

// ════════════════════════════════════════
//  玄门 — 自定义事件
// ════════════════════════════════════════

/** node 2: 祖祠选御物 → 三件固定法器（御物血统限定，仅玄门可选） */
export const XUANMEN_N02_WEAPON: EventDef = {
    id: 'xuanmen_n02_weapon',
    name: '祖祠那天',
    description: '你六岁那年，父亲将你叫到祖祠前。三件家族御物悬浮在炁阵中。',
    placement: [{ nodes: [2], when: storyWhen('xuanmen') }],
    rounds: [
        {
            id: 'intro',
            title: '祖祠',
            description:
                '你六岁那年，父亲将你叫到祖祠前。三件家族御物悬浮在炁阵中，他说：「伸出手，感受哪一件与你共鸣。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '伸手' }],
        },
        {
            id: 'reward_round',
            title: '炁阵中的三件',
            choices: [
                {
                    id: 'floating_silk',
                    type: 'weapon',
                    label: '七根丝',
                    description: '一缕以炁御动的柔丝，可远可近，可硬可软，变幻莫测。',
                },
                { id: 'tri_orb', type: 'weapon', label: '三相珠', description: '三颗由炁劲驱动的法珠，环绕主人旋转。' },
                { id: 'fei_jian', type: 'weapon', label: '黑云剑', description: '御剑飞行，剑随人走。' },
            ],
        },
        {
            id: 'epilogue',
            title: '父亲的话',
            description:
                '父亲看着你与御物之间的共鸣，点了点头：「很好。从今日起它便是你的本命御物。御物即手足，莫要辱没了它。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 3: 库房选奇物 */
export const XUANMEN_N03_START: EventDef = {
    id: 'xuanmen_n03_start',
    name: '父亲打开库房',
    description: '父亲翻出家传库房，让你先择一件趁手的奇物傍身。',
    placement: [{ nodes: [3], when: storyWhen('xuanmen') }],
    reward: { kind: 'item', pool: 'artifact' },
    rounds: [
        {
            id: 'intro',
            title: '家传库房',
            description: '御物里的门道，父亲说要慢慢教。他打开库房，让你先挑一件趁手的奇物傍身。',
            choices: [{ id: 'reward_round', type: 'continue', label: '挑选' }],
        },
        { id: 'reward_round', title: '趁手的一件', choices: [] },
        {
            id: 'epilogue',
            title: '父亲的叮嘱',
            description: '父亲将奇物交到你手中：「玄门御物之术，重在心神合一。奇物为辅，修为为本。莫要本末倒置。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

// ════════════════════════════════════════
//  第二阶段主线（xuanmen）：n6 结识小树 → n12 取名玄久 → n13 家族内斗
//  → n17 河边修炼 → n21 决定参赛
// ════════════════════════════════════════

/** node 6: 主线·结识小树——旁系叔叔，相谈甚欢（为 n15 归海楼重逢铺垫） */
export const XUANMEN_N06_SHUSHU: EventDef = {
    id: 'xuanmen_n06_shushu',
    name: '结识小树',
    description: '族里有个旁系叔叔，大家叫他小树。',
    placement: [{ nodes: [6], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '小树',
            description:
                '族里有个旁系叔叔，辈分上是父亲的弟弟，大家叫他小树。他不常来祖宅，来了也总待在角落里喝茶。那天他看见你在练御物，难得开了口：「手别绷那么紧，御物讲究心神合一，不是使蛮劲。」你缠着他问了一下午，他讲了很多外面的事。',
            choices: [{ id: 'reward_round', type: 'continue', label: '记下' }],
        },
        { id: 'reward_round', title: '后来', description: '后来他离开了家，再没回来。你很久之后才知道他为什么走。', choices: [] },
    ],
}

/** node 12: 主线·取名玄久——用一年接受现实，纪念姐姐 */
export const XUANMEN_N12_NAMING: EventDef = {
    id: 'xuanmen_n12_naming',
    name: '取名',
    description: '你用了一年时间接受现实。',
    placement: [{ nodes: [12], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '玄久',
            description:
                '生死斗之后，你用了一年时间接受现实。然后你站在祖祠前，给自己取了一个名字：玄久。久，不是九。父亲听到这个名字时，沉默了一会儿，没有阻止。他知道你在纪念谁。',
            choices: [{ id: 'reward_round', type: 'continue', label: '记下', effects: [{ kind: 'rename', name: '玄久' }] }],
        },
        { id: 'reward_round', title: '久', description: '从此你叫玄久。父亲很少叫你的名字，偶尔叫了，会停一停。', choices: [] },
    ],
}

/** node 13: 主线·家族内斗——门主之位，暗流涌动 */
export const XUANMEN_N13_CLAN: EventDef = {
    id: 'xuanmen_n13_clan',
    name: '家族内斗',
    description: '门主那把椅子，从来不是一条命就能坐稳的。',
    placement: [{ nodes: [13], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '暗流',
            description:
                '大伯玄机是现任门主。族里明里尊他，暗里各房都盯着那把椅子——有人拉拢你，有人试探你父亲。你渐渐看清：玄门的规矩，不只是双胞胎那一条。家业越大，人心越散。',
            choices: [{ id: 'reward_round', type: 'continue', label: '留意' }],
        },
        { id: 'reward_round', title: '记下', description: '你把每一张脸都记了下来。总有一天用得上。', choices: [] },
    ],
}

/** node 17: 主线·河边修炼——远离祖宅的安静地方 */
export const XUANMEN_N17_RIVER: EventDef = {
    id: 'xuanmen_n17_river',
    name: '河边修炼',
    description: '你常在镇外的河边修炼。水声大，心静。',
    placement: [{ nodes: [17], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '河边',
            description:
                '你常在镇外的河边修炼。水声盖过杂念，御物反而更稳。你在水里放了几片叶子，以炁御动它们逆流而上——一片，两片，三片。河边的日子，是你最像自己的日子。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收功' }],
        },
        { id: 'reward_round', title: '收功', description: '你收回御物。河水继续流，像什么都没发生过。', choices: [] },
    ],
}

/** node 21: 主线·决定参赛——斗炁大会开幕，你要去 */
export const XUANMEN_N21_ENTER: EventDef = {
    id: 'xuanmen_n21_enter',
    name: '决定参赛',
    description: '斗炁大会开幕的消息传遍了青山镇。',
    placement: [{ nodes: [21], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '报名',
            description:
                '斗炁大会开幕的消息传遍了青山镇。各派都派人参赛——这是扬名立万的机会，也是各房角力的新战场。你收拾好御物，去报了名。父亲没拦你，只说了句：「别丢玄门的脸。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '报名' }],
        },
        { id: 'reward_round', title: '出发', description: '你握紧御物。这一次，你要凭自己的名字站在擂台上。', choices: [] },
    ],
}

/** node 9: 家族密辛 */
export const XUANMEN_N09_SECRET: EventDef = {
    id: 'xuanmen_n09_secret',
    name: '家传密辛',
    description: '那晚，父亲把你叫到书房，说出了埋藏多年的家族密辛。',
    placement: [{ nodes: [9], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '书房',
            description:
                '那晚，父亲把你叫到书房，沉默了许久才开口：「玄门有条规矩——双生子，不两全。你十岁那年，族里会安排一场生死之斗。你和玄九之间，只有一个能活下来。」\n\n他顿了顿：「活下来的那个，才有资格在祖祠前，为自己取一个正式的名字。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '记住' }],
        },
        {
            id: 'reward_round',
            title: '夜不能寐',
            description: '那晚你躺在床上，数着日子。十岁，原来没那么远。',
            choices: [],
        },
    ],
}

/** node 11: Boss 战 — 孪生姐姐玄九（生死斗；build 复用 junshi 的 gen(11)，仅换名） */
export const BOSS_JUNSHI: EventDef = {
    id: 'boss_junshi',
    name: '生死斗',
    description: '十岁那年，你与孪生姐姐玄九对峙于祖祠之前。',
    placement: [{ nodes: [11], when: storyWhen('xuanmen') }],
    reward: { kind: 'item', pool: 'action' },
    rounds: [
        {
            id: 'intro',
            title: '祖祠对决',
            description:
                '十岁那年，你与孪生姐姐玄九对峙于祖祠之前。玄门有一条历代传下的规矩——双胞胎，只能留一个。谁都没有退路。',
            choices: [{ id: 'combat_round', type: 'continue', label: '迎战' }],
        },
        {
            id: 'combat_round',
            title: '生死斗',
            enemyId: 'junshi',
            bossName: '玄九',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '战后',
            choices: [],
        },
    ],
}

/** node 15: 归海楼 — 小树 */
export const XUANMEN_N15_HEISHU: EventDef = {
    id: 'xuanmen_n15_heishu',
    name: '小树',
    description: '归海楼比武大会上，你又见到了那位早已从家中消失的旁系叔叔。',
    placement: [{ nodes: [15], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '重逢',
            description:
                '归海楼比武大会上，你又见到了那位早已从家中消失的旁系叔叔——小树。他看见你，愣了一下，随即笑了笑：「你长这么大了。」\n\n他像是知道你要问什么，没有接话，只看着远处说了一句：「玄门的规矩，是编出来拿捏人的。我们都被骗了。」\n\n你愣住了，还想再问，他已经转身，走进了人群。「想知道为什么，回去问你父亲。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '追上去' }],
        },
        {
            id: 'reward_round',
            title: '追不上的背影',
            description: '你追了两步，又停住了。有些答案，只能回家问。',
            choices: [],
        },
    ],
}

/** node 16: 质问父亲 */
export const XUANMEN_N16_CONFRONT: EventDef = {
    id: 'xuanmen_n16_confront',
    name: '质问',
    description: '你连夜赶回家中，质问父亲关于小树所说的一切。',
    placement: [{ nodes: [16], when: storyWhen('xuanmen') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '对质',
            description:
                '你连夜赶回家中，质问父亲。他沉默了很久，才开口：「小树没说错——规矩是玄门历代传下来的。可传下来的规矩，不一定就是真相。」他顿住，像在掂量字句：「有些话，现在还不是说给你听的时候。先证明你自己。等你有了说话的份量，我们再谈。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '实力',
            description: '你不再追问。你只是练得更狠了。',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  归海楼研讨会（xuanmen 主线）：n14 代表家族赴归海楼切磋交流
//  （n15 小树重逢即在归海楼比武大会上）；共享池版已为玄门让位。
// ════════════════════════════════════════

/** node 14: 主线·归海楼·参会——玄门弟子代表家族赴归海楼切磋交流 */
export const XUANMEN_GUIHAILOU: EventDef = {
    id: 'xuanmen_guihailou',
    name: '归海楼·参会',
    description: '归海楼广发英雄帖，各派齐聚。玄门也在受邀之列。',
    placement: [{ nodes: [14], when: storyWhen('xuanmen') }],
    effects: [{ kind: 'set', flag: 'guihailou_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'arrive',
            title: '归海楼',
            description:
                '父亲让你代表玄门赴归海楼之约。山门前人声鼎沸，各派弟子都在。你依礼入场，与几派弟子切磋了几场，不落下风。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收手' }],
        },
        {
            id: 'reward_round',
            title: '留意',
            description: '满场大多是生面孔。你扫了一圈，把各派的路数记在心里。归海楼此行，你记下了很多人。',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  一阶段中段（n4-7）渲染池：玄门的日子
//  从 n4 起主角已 7-8 岁；渲染池 3 选 1 候选，每局各至多一次，可空缺。
// ════════════════════════════════════════

/** node 4-7 渲染池：与玄九一起长大（为 n11 生死斗铺垫） */
export const XUANMEN_RENDER_TWINS: EventDef = {
    id: 'xuanmen_render_twins',
    name: '一起长大',
    description: '你和玄九，生来就是两个人。',
    placement: [
        { nodes: [4], when: storyRenderWhen('xuanmen', 'xuanmen_render_twins_done') },
    ],
    effects: [{ kind: 'set', flag: 'xuanmen_render_twins_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '双子',
            description: '你和玄九一起练功，一起挨罚。她总比你早半刻钟睁开眼，比你多练半炷香。父亲从不让你们同台——「各有各的路。」他说。',
            choices: [{ id: 'reward_round', type: 'continue', label: '并肩' }],
        },
        {
            id: 'reward_round',
            title: '背影',
            description: '你走在她身后，踩着她踩过的路。那时候你觉得，日子长得像永远过不完。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：御物初习（呼应 n2 所选御物） */
export const XUANMEN_RENDER_YUWU: EventDef = {
    id: 'xuanmen_render_yuwu',
    name: '御物初习',
    description: '御物认主，父亲说，靠的是心。',
    placement: [
        { nodes: [5], when: storyRenderWhen('xuanmen', 'xuanmen_render_yuwu_done') },
    ],
    effects: [{ kind: 'set', flag: 'xuanmen_render_yuwu_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '祖祠',
            description: '夜里没人了，你偷偷取出本命御物，试着以炁唤动它。它离了手，浮在你面前，一动不动。你屏住呼吸——它晃了晃，稳住了。',
            choices: [{ id: 'reward_round', type: 'continue', label: '触碰' }],
        },
        {
            id: 'reward_round',
            title: '认主',
            description: '指尖触到御物的那一刻，你心里忽然静了。父亲不知何时站在门边，看了一眼，没说话。第二天起，他每天多教你一炷香。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：祖训阴影 */
export const XUANMEN_RENDER_ZUXUN: EventDef = {
    id: 'xuanmen_render_zuxun',
    name: '祖训',
    description: '那条祖训，你小时候只当它是句怪话。',
    placement: [
        { nodes: [7], when: storyRenderWhen('xuanmen', 'xuanmen_render_zuxun_done') },
    ],
    effects: [{ kind: 'set', flag: 'xuanmen_render_zuxun_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '怪话',
            description: '祠堂里的规矩一条条刻在墙上。有一条被磨得看不清了，像是有人故意抹掉的。你问父亲那上面原来写着什么，他没答，只是看了你一眼。那一眼，你记了很多年。',
            choices: [{ id: 'reward_round', type: 'continue', label: '没再问' }],
        },
        {
            id: 'reward_round',
            title: '那一眼',
            description: '你后来懂了那一眼的意思。懂了之后，你更想装作不懂。',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  二阶段切磋池（n10-21，3 选 1，可空缺）：堂兄玄七试探（御物比斗）
// ════════════════════════════════════════

/** node 10-21 切磋池：玄七（堂兄，家族内斗背景下试探你的深浅；御物） */
export const XUANMEN_SPAR_XUANQI: EventDef = {
    id: 'xuanmen_spar_xuanqi',
    name: '切磋·玄七',
    description: '堂兄玄七拦下你：「族里都在传你的事。让我看看，是不是真的。」',
    placement: [
        {
            range: SPAR_RANGE,
            fallback: true,
            weight: 2,
            when: storyRenderWhen('xuanmen', 'xuanmen_spar_xuanqi_done'),
        },
    ],
    effects: [{ kind: 'set', flag: 'xuanmen_spar_xuanqi_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '拦路',
            description: '玄七是堂兄，嫡系一脉的子弟，御物使得比你熟。他拦下你，语气里带着试探：「族里都在传你的事。手底下见真章吧。」',
            choices: [{ id: 'combat_round', type: 'continue', label: '比一场' }],
        },
        {
            id: 'combat_round',
            title: '御物比斗',
            enemyId: 'heiyun',
            bossName: '玄七',
            description: '两件御物在祖宅外的空地上交缠碰撞。玄七出手毫不留情。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收招' }],
        },
        {
            id: 'reward_round',
            title: '试探',
            description:
                '玄七收手，眯起眼：「有点意思。族里那些人，你小心。」\n\n这一场比试下来，你明白了什么叫树大招风。家族内斗的刀，迟早会架到你脖子上。',
            choices: [],
        },
    ],
}
