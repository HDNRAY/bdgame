import type { EventDef } from '../../game/entities/event'
import { STAGE1_MID, storyRenderWhen, storyWhen } from './layout'

// ════════════════════════════════════════
//  玄门 — 自定义事件
// ════════════════════════════════════════

/** node 2: 祖祠选御物 → 三件固定法器（御物血统限定，仅玄门可选） */
export const XUANMEN_N02_WEAPON: EventDef = {
    id: 'xuanmen_n02_weapon',
    name: '选兵器',
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
            title: '选择御物',
            choices: [
                {
                    id: 'floating_silk',
                    type: 'weapon',
                    label: '七根丝',
                    description: '一缕以炁御动的柔丝，可远可近，可硬可软，变幻莫测。',
                },
                { id: 'tri_orb', type: 'weapon', label: '三相珠', description: '三颗由炁劲驱动的法珠，环绕主人旋转。' },
                { id: 'fei_jian', type: 'weapon', label: '黑云剑', description: '御剑飞行，剑气纵横。' },
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
    name: '选奇物',
    description: '招式已随御物附赠，父亲翻出家传库房，让你先择一件趁手的奇物傍身。',
    placement: [{ nodes: [3], when: storyWhen('xuanmen') }],
    reward: { kind: 'item', pool: 'artifact' },
    rounds: [
        {
            id: 'intro',
            title: '家传库房',
            description: '招式已随御物附赠，父亲翻出家传库房，让你先择一件趁手的奇物傍身。',
            choices: [{ id: 'reward_round', type: 'continue', label: '挑选' }],
        },
        { id: 'reward_round', title: '选择奇物', choices: [] },
        {
            id: 'epilogue',
            title: '父亲的叮嘱',
            description: '父亲将奇物交到你手中：「玄门御物之术，重在心神合一。奇物为辅，修为为本。莫要本末倒置。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
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
                '那晚，父亲把你叫到书房，说出了埋藏多年的家族密辛：「我族之人，唯有亲手斩断一缕血亲之情，方能真正驭使御物。你十岁那年，会有一场生死之斗——好好准备。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '记住' }],
        },
        {
            id: 'reward_round',
            title: '夜不能寐',
            description: '那晚你第一次知道，有些路，从出生那天就注定了。',
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
                '归海楼比武大会上，你又见到了那位早已从家中消失的旁系叔叔——小树。他看着你，忽然笑了：「其实，你根本不需要杀他。手刃血亲，不过是玄门为了更好地拿捏后代编出来的说辞。我知道了这秘密，才离开的。」话音未落，他转身再次远去。',
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
                '你连夜赶回家中，质问父亲。他沉默良久，终于承认：「此事……属实。但你若真想改变什么，眼下先证明你的实力。有了实力，我们再谈。」',
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
//  一阶段中段（n4-7）渲染池：玄门的日子
//  从 n4 起主角已 7-8 岁；渲染池 3 选 1 候选，每局各至多一次，可空缺。
// ════════════════════════════════════════

/** node 4-7 渲染池：与玄九一起长大（为 n11 生死斗铺垫） */
export const XUANMEN_RENDER_TWINS: EventDef = {
    id: 'xuanmen_render_twins',
    name: '一起长大',
    description: '你和玄九，生来就是两个人。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('xuanmen', 'xuanmen_render_twins_done') },
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
            description: '你走在她身后，看着她的背影。你从没想过，有一天你们只能留一个。',
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
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('xuanmen', 'xuanmen_render_yuwu_done') },
    ],
    effects: [{ kind: 'set', flag: 'xuanmen_render_yuwu_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '祖祠',
            description: '父亲带你到祖祠，让你以炁感应。三件御物悬在炁阵里，你伸出手，其中一件微微一亮——它认得你。',
            choices: [{ id: 'reward_round', type: 'continue', label: '触碰' }],
        },
        {
            id: 'reward_round',
            title: '认主',
            description: '指尖触到御物的那一刻，你心里忽然静了。父亲在身后说：「御物即手足。莫要辱没了它。」',
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
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('xuanmen', 'xuanmen_render_zuxun_done') },
    ],
    effects: [{ kind: 'set', flag: 'xuanmen_render_zuxun_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '怪话',
            description: '祠堂里的规矩一条条刻在墙上。你小时候识字不全，指着其中一条问父亲：「双胞胎只能留一个，是什么意思？」父亲没答，只是看了你一眼。那一眼，你记了很多年。',
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
