import type { EventDef } from '../../game/entities/event'
import { N2_WEAPON_CHOICES, STAGE1_MID, storyRenderWhen, storyWhen } from './layout'

// ════════════════════════════════════════
//  奇遇流 — 自定义事件
// ════════════════════════════════════════

/** node 2: 遇险获救，隐世夫妇赠器（固定 5 选 1；御物血统限定不出） */
export const WANDERER_N02_INTRO: EventDef = {
    id: 'wanderer_n02_intro',
    name: '遇险获救',
    description: '七岁那年你和奇岚在青山边缘遇险，被一对隐世夫妇所救。',
    placement: [{ nodes: [2], when: storyWhen('wanderer') }],
    reward: { kind: 'fixed', choices: N2_WEAPON_CHOICES },
    rounds: [
        {
            id: 'intro',
            title: '遇险',
            description:
                '七岁那年你和奇岚在青山边缘的林地玩耍，一时贪玩跑进了深山，撞上一头不知从哪来的凶兽。眼看就要没命，一道剑光破空而至——你被拎着甩到安全处，抬头才看清那对夫妇：男子背负一柄大剑，女子腰悬双剑。他们见你二人筋骨不错，便将随身几件兵器和图谱赠予了你。你后来才知道，他们叫杨之改与龙语仙。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收下' }],
        },
        { id: 'reward_round', title: '选择兵器', choices: [] },
        {
            id: 'epilogue',
            title: '杨之改的话',
            description:
                '男子拍了拍你的头：「有缘再见。记住，兵器是死物，人才是活的。」说罢二人转身离去，很快消失在林间。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 3: 悟道（与兵器同源的 2AP 招式） */
export const WANDERER_N03_INTRO: EventDef = {
    id: 'wanderer_n03_intro',
    name: '悟道',
    description: '杨之改和龙语仙留下的图谱在你脑海中挥之不去。',
    placement: [{ nodes: [3], when: storyWhen('wanderer') }],
    reward: { kind: 'item', pool: 'action', apMax: 2, noPrePost: true, requireTags: true },
    rounds: [
        {
            id: 'intro',
            title: '领悟',
            description: '杨之改和龙语仙留下的图谱在你脑海中挥之不去。你一遍遍回想、比划，渐渐悟出了其中的门道。',
            choices: [{ id: 'reward_round', type: 'continue', label: '演练' }],
        },
        { id: 'reward_round', title: '选择招式', choices: [] },
        {
            id: 'epilogue',
            title: '龙语仙的话',
            description: '你仿佛听到龙语仙的声音在耳边响起：「悟性不错。但记住，招式是死的，应变才是活的。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

// ════════════════════════════════════════
//  奇遇流主线链（第二阶段必遇，flag 门控）
//  酒逢知己（必遇来风结拜）→ 青山之巅·六绝（与陶朵重逢同往观战）
//  → 九朵桃花之夜（后门找陶朵→蛛丝马迹→方烈赶走）→ 恩师问话（杨之改/龙语仙）→ 来风报信
//  青山论剑排在酒吧杀人之前：重逢的笔墨在前，发现黑暗面在后。
//  与共享四支线链写同样的 done flag：共享版偶遇/结拜/青山论剑/酒吧杀人不会再出现。
// ════════════════════════════════════════

/** node 12: 主线·酒逢知己——必遇来风，结拜（写 got_wine/sworn_done，得酒功） */
export const WANDERER_SWORD: EventDef = {
    id: 'wanderer_sworn',
    name: '酒逢知己',
    description: '九朵桃花酒吧。你独酌，酒过三巡，门帘一掀，进来一个人。',
    placement: [
        {
            nodes: [12],
            when: { and: [storyWhen('wanderer'), { '!': { var: 'flags.sworn_done' } }] },
        },
    ],
    effects: [{ kind: 'setMany', flags: { got_wine: true, sworn_done: true } }],
    reward: { kind: 'item', pool: 'passive', includeTags: ['jiu'] },
    rounds: [
        {
            id: 'scene',
            title: '九朵桃花',
            description: '你独酌。酒过三巡，门帘一掀，进来一个人——来风。他认得你，咧嘴一笑：「哟，一个人喝闷酒？来，凑一桌。」',
            choices: [{ id: 'drink', type: 'continue', label: '举杯' }],
        },
        {
            id: 'drink',
            title: '结拜',
            description: '你们喝到兴起，轮番表演轻功助兴。你也露了一手，赢得一片叫好。最后两个人醉醺醺地拜了把子，约好有难同当。',
            choices: [{ id: 'reward_round', type: 'continue', label: '散场' }],
        },
        {
            id: 'reward_round',
            title: '结拜之礼',
            description: '来风把一部酒功谱子塞进你怀里：「兄弟，拿去练。这镇上认得的人不多，你算一个。」',
            choices: [],
        },
    ],
}

/** node 14: 主线·青山之巅·六绝——与陶朵重逢同往观战（六绝含恩师杨之改/龙语仙） */
export const WANDERER_SIX: EventDef = {
    id: 'wanderer_six_duel',
    name: '青山之巅·六绝',
    description: '青山绝顶，六位高手比武。陶朵说，一起去看看。',
    placement: [
        {
            nodes: [14],
            when: {
                and: [
                    storyWhen('wanderer'),
                    { '==': [{ var: 'flags.sworn_done' }, true] },
                    { '!': { var: 'flags.six_done' } },
                ],
            },
        },
    ],
    effects: [{ kind: 'set', flag: 'six_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '重逢',
            description:
                '陶朵找到你的时候，你正一个人在巷口看云。她站在你身后，像小时候那样喊你：「叶寻！走，去看热闹。」你回头，她冲你笑——跟小时候一模一样的笑。你差点以为这些年什么都没变。',
            choices: [{ id: 'summit', type: 'continue', label: '同去' }],
        },
        {
            id: 'summit',
            title: '绝顶观战',
            description:
                '青山绝顶，六道人影分立各方。你远远望着，大气都不敢出。你认出了其中两人——杨之改、龙语仙，当年在青山边缘救过你的恩师，如今是六绝里的「观」与「逸」。陶朵在旁边看得入神，你偷偷看了她一眼。',
            choices: [{ id: 'reward_round', type: 'continue', label: '屏息观战' }],
        },
        {
            id: 'reward_round',
            title: '散场',
            description:
                '比武散了。陶朵拍了拍你的肩：「我先回店里了，改天请你喝酒。」她走远了，你站在原地，忽然觉得今天很好。好到你想不起，那些年她到底去了哪里。',
            choices: [],
        },
    ],
}

/** node 16: 主线·九朵桃花之夜——备礼去后门找陶朵，看到蛛丝马迹但不愿相信，被方烈赶走 */
export const WANDERER_BAR: EventDef = {
    id: 'wanderer_bar',
    name: '九朵桃花之夜',
    description: '你备了礼物，想从后门溜进去给陶朵一个惊喜。',
    placement: [
        {
            nodes: [16],
            when: { and: [storyWhen('wanderer'), { '==': [{ var: 'flags.six_done' }, true] }] },
        },
    ],
    effects: [{ kind: 'set', flag: 'bar_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '后门',
            description: '九朵桃花的后门虚掩着。你翻过院墙，无声落地——轻功是你最拿手的。礼物还握在手里。',
            choices: [{ id: 'clues', type: 'continue', label: '往里走' }],
        },
        {
            id: 'clues',
            title: '蛛丝马迹',
            description: '后院地上有一大片水渍，边缘掺着一点没冲干净的红。墙角搁着几只空药瓶，瓶口的泥还是新的。你认得那些瓶子——是宝字堂的跌打酒瓶。可里面的味道，不对。',
            choices: [{ id: 'fanglie', type: 'continue', label: '再走近些' }],
        },
        {
            id: 'fanglie',
            title: '方烈',
            description: '一只手按上你的肩。方烈不知在你身后站了多久：「小子，这不是你该来的地方。」他没动手，只是把你往外推。你被推出巷口时回头看了一眼——后门已经关上了。',
            choices: [{ id: 'reward_round', type: 'continue', label: '离开' }],
        },
        {
            id: 'reward_round',
            title: '不愿相信',
            description: '你站在巷口，礼物还在手里。你想告诉自己看错了。但那些药瓶、那道水渍，在你脑子里转了一夜。',
            choices: [],
        },
    ],
}

/** node 18: 主线·恩师问话——杨之改/龙语仙问参不参加斗炁大会，你还没想好 */
export const WANDERER_YANGLONG: EventDef = {
    id: 'wanderer_yanglong',
    name: '恩师问话',
    description: '你在山道上碰到两个人——杨之改与龙语仙。',
    placement: [
        {
            nodes: [18],
            when: { and: [storyWhen('wanderer'), { '==': [{ var: 'flags.bar_done' }, true] }] },
        },
    ],
    effects: [{ kind: 'set', flag: 'yanglong_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '山道',
            description: '杨之改负着大剑，龙语仙腰悬双剑，就站在你下山的路口，像专门在等你。龙语仙先开口：「叶寻。斗炁大会要开了，去不去？」',
            choices: [{ id: 'hesitate', type: 'continue', label: '沉默' }],
        },
        {
            id: 'hesitate',
            title: '没想好',
            description: '你还没想好。陶朵的事压在心里，你连奇岚都没敢说。杨之改看了你一眼：「不急。想好了，自己去报名便是。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '点头' }],
        },
        {
            id: 'reward_round',
            title: '送别',
            description: '二人转身离去。龙语仙头也不回地扔下一句：「记住，招式是死的，应变才是活的。」',
            choices: [],
        },
    ],
}

/** node 20: 主线·来风报信——陶朵在报名榜上，你决定报名 */
export const WANDERER_LAIFENG: EventDef = {
    id: 'wanderer_register',
    name: '来风报信',
    description: '来风拿着一张告示找你，一脸兴奋。',
    placement: [
        {
            nodes: [20],
            when: { and: [storyWhen('wanderer'), { '==': [{ var: 'flags.yanglong_done' }, true] }] },
        },
    ],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '榜单',
            description: '「看这个看这个！」来风把告示拍在桌上——斗炁大会的报名榜。他的手指点在一行名字上：「陶朵！她也报名了！」',
            choices: [{ id: 'decide', type: 'continue', label: '凑近看' }],
        },
        {
            id: 'decide',
            title: '决定',
            description: '陶朵两个字印在纸上，墨迹还没干透。你盯着那两个字，忽然觉得心里没那么乱了。你抬起头：「帮我报个名。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '报名' }],
        },
        {
            id: 'reward_round',
            title: '报名',
            description: '来风笑着捶了你一拳：「这才是我兄弟！」你看着榜单上那两个字，心里第一次有了要去的地方。',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  一阶段中段（n4-7）渲染池：童年日常
//  从 n4 起主角已 7-8 岁；渲染池 3 选 1 候选，每局各至多一次，可空缺。
// ════════════════════════════════════════

/** node 4-7 渲染池：巷子童年（售货机裂纹、陶朵替人扛错） */
export const WANDERER_RENDER_LANE: EventDef = {
    id: 'wanderer_render_lane',
    name: '巷子',
    description: '你路过镇口那台自动售货机，脚步慢了下来。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('wanderer', 'wanderer_render_lane_done') },
    ],
    effects: [{ kind: 'set', flag: 'wanderer_render_lane_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '售货机',
            description: '玻璃上的裂纹还在——是他们俩拿石头砸的，陶朵说想看看里面的饮料能不能掉出来。被大人抓住后，陶朵一个人扛了所有的错。「我是姐姐嘛。」她说。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续走' }],
        },
        {
            id: 'reward_round',
            title: '后来',
            description: '后来陶朵失踪了。奇岚进了协会。你一个人，总是一个人路过这台售货机。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：陶朵失踪那天（7-8 岁前后） */
export const WANDERER_RENDER_GONE: EventDef = {
    id: 'wanderer_render_gone',
    name: '陶朵失踪',
    description: '陶朵失踪那天，是个晴天。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('wanderer', 'wanderer_render_gone_done') },
    ],
    effects: [{ kind: 'set', flag: 'wanderer_render_gone_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '晴天',
            description: '她头天晚上还隔着墙喊你第二天一起去镇口。第二天一早，她家就空了。亲戚说她被接走了，谁也没看见接她的人。',
            choices: [{ id: 'reward_round', type: 'continue', label: '后来' }],
        },
        {
            id: 'reward_round',
            title: '后来',
            description: '你和奇岚在巷口站了一上午。售货机还立在那儿，玻璃上的裂纹还在。陶朵再没回来。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：与奇岚切磋、分别 */
export const WANDERER_RENDER_QILAN: EventDef = {
    id: 'wanderer_render_qilan',
    name: '奇岚',
    description: '奇岚的雷法，你从小就没赢过。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('wanderer', 'wanderer_render_qilan_done') },
    ],
    effects: [{ kind: 'set', flag: 'wanderer_render_qilan_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '切磋',
            description: '你和奇岚在巷子后的空地上比试。他家的雷法让他的拳快得不像话，你总被他放倒。「再来。」他说。你就爬起来再来。',
            choices: [{ id: 'reward_round', type: 'continue', label: '再来' }],
        },
        {
            id: 'reward_round',
            title: '后来',
            description: '后来他被调查部部长相中，进了协会。走的那天他拍了拍你的肩：「照顾好自己。陶朵的事，我迟早查清楚。」',
            choices: [],
        },
    ],
}
