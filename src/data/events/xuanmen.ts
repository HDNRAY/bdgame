import type { EventDef } from '../../game/entities/event'
import { storyWhen } from './layout'

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

/** node 11: Boss 战 — 一个兄弟 */
export const BOSS_JUNSHI: EventDef = {
    id: 'boss_junshi',
    name: '一个兄弟',
    description: '十岁那年，你与「一个兄弟」对峙于祖祠之前。',
    placement: [{ nodes: [11], when: storyWhen('xuanmen') }],
    reward: { kind: 'item', pool: 'action' },
    rounds: [
        {
            id: 'intro',
            title: '祖祠对决',
            description: '十岁那年，你与「一个兄弟」对峙于祖祠之前。谁都没有退路。',
            choices: [{ id: 'combat_round', type: 'continue', label: '迎战' }],
        },
        {
            id: 'combat_round',
            title: '生死斗',
            enemyId: 'junshi',
            bossName: '一个兄弟',
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
