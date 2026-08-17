import type { EventDef } from '../../game/entities/event'
import { N2_WEAPON_CHOICES, STAGE1_MID, storyRenderWhen, storyWhen } from './layout'

// ════════════════════════════════════════
//  血海深仇 — 自定义事件
// ════════════════════════════════════════

/** node 2: 选兵器（父亲遗物，固定 5 选 1；空手 → 修炼点） */
export const FEUD_N02_WEAPON: EventDef = {
    id: 'feud_n02_weapon',
    name: '选兵器',
    description:
        '那年你六岁。会长姬仲从家里找出你父亲遗留的兵器，递给你说：「这是你父亲留下的。你从中挑一件，我来教你怎么用。」',
    placement: [{ nodes: [2], when: storyWhen('feud') }],
    reward: { kind: 'fixed', choices: N2_WEAPON_CHOICES },
    rounds: [
        {
            id: 'intro',
            title: '父亲的遗物',
            description:
                '那年你六岁。会长姬仲从家里找出你父亲遗留的兵器，递给你说：「这是你父亲留下的。你从中挑一件，我来教你怎么用。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '挑选' }],
        },
        { id: 'reward_round', title: '选择兵器', choices: [] },
        {
            id: 'epilogue',
            title: '父亲的叮嘱',
            description:
                '会长看着你手中的兵器，点了点头：「好眼力。这把兵器跟了你，就别让它蒙尘。好好修炼，莫要辜负了你父亲的期望。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 3: 选招式（与兵器同源的 2AP 招式） */
export const FEUD_N03_ACTION: EventDef = {
    id: 'feud_n03_action',
    name: '选招式',
    description:
        '会长教你的是炼炁协会的基础功法，循序渐进，很是耐心。但你修炼时眼神总是很凶，好像要把仇恨都煅进骨子里。',
    placement: [{ nodes: [3], when: storyWhen('feud') }],
    reward: { kind: 'item', pool: 'action', apMax: 2, noPrePost: true, requireTags: true },
    rounds: [
        {
            id: 'intro',
            title: '修炼',
            description:
                '会长教你的是炼炁协会的基础功法，循序渐进，很是耐心。但你修炼时眼神总是很凶，好像要把仇恨都煅进骨子里。',
            choices: [{ id: 'reward_round', type: 'continue', label: '练功' }],
        },
        { id: 'reward_round', title: '选择功法', choices: [] },
        {
            id: 'epilogue',
            title: '会长的告诫',
            description:
                '会长拍了拍你的肩：「仇恨是一把双刃剑。让它驱动你变强，但别让它吞噬你。去吧，今天的修炼就到这。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 12: 主线·加入调查科——林晚风进特殊事件调查科；首次任务=青山之巅监视六绝比武 */
export const FEUD_JOIN_DETECTIVES: EventDef = {
    id: 'feud_join_detectives',
    name: '加入调查科',
    description: '黛玄科长亲自来会长府要人。',
    placement: [{ nodes: [12], when: storyWhen('feud') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '调查科',
            description:
                '黛玄科长亲自来会长府走了一趟，跟姬仲在书房谈了很久。出来时她看了你一眼：「这小子，我要了。」姬仲没说话。第二天一早，你站进了调查科的院子。',
            choices: [{ id: 'meet', type: 'continue', label: '报到' }],
        },
        {
            id: 'meet',
            title: '同期',
            description: '院子里一个年轻人朝你点头——奇岚，同期生，据说是部长亲手相中。法医竹子抱着一箱检材路过，看了你一眼：「新来的？会验伤吗？」',
            choices: [{ id: 'task', type: 'continue', label: '摇头' }],
        },
        {
            id: 'task',
            title: '首次任务',
            description:
                '「青山之巅有人比武，六位高手。」黛玄把任务扔给你，「和奇岚去盯着，别让场面波及老街。」你蹲在对面楼的阴影里，远远看着那几道人影在月光下交手——后来你才知道，那叫六绝。',
            choices: [{ id: 'reward_round', type: 'continue', label: '盯了一夜' }],
        },
        {
            id: 'reward_round',
            title: '收队',
            description:
                '收队时奇岚拍了拍你的肩：「习惯就好。大部分任务都是盯着，不是动手。」竹子的话还在耳边：「看人如看病，望闻问切——这个道理，调查科人人得懂。」',
            choices: [],
        },
    ],
}

/** node 22: Boss 战 — 阿九（守门人） */
export const BOSS_AJIU: EventDef = {
    id: 'boss_ajiu',
    name: '阿九',
    description: '阿九站在巷口，等你。她知道你会来。',
    placement: [{ nodes: [22], when: storyWhen('feud') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'intro',
            title: '守门人',
            description:
                '阿九站在巷口，月光落在她脸上。她没有躲，也没有逃。她看见你手中的兵器，轻轻笑了笑：「我知道你会来。」\n\n你看见她的右手——义体手臂在月光下泛着冰冷的金属光泽。那是组织成员的标记。',
            choices: [{ id: 'combat_round', type: 'continue', label: '拔剑' }],
        },
        {
            id: 'combat_round',
            title: '赴死',
            enemyId: 'ajiu',
            description:
                '你拔出兵器。阿九没有动。她只是站在那里，看着你——眼神里没有恐惧，没有抵抗，只有一种说不清的平静。她缓缓抬起义体手臂，让你看清它。',
            choices: [{ id: 'reward_round', type: 'continue', label: '继续' }],
        },
        {
            id: 'reward_round',
            title: '阿九',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

// ════════════════════════════════════════
//  第二阶段主线（feud · 阿九弧线，为 n22 守门人铺垫）：
//  n13 阿九到来 → n14 九朵桃花现场勘查（写 bar_done）→ n15 与阿九相处
//  → n18 发现真相（义体手/学校）→ n21 内心挣扎 → n31 白山月
// ════════════════════════════════════════

/** node 13: 主线·阿九到来——会长身边多了个新来的姑娘 */
export const FEUD_N13_AJIU_ARRIVE: EventDef = {
    id: 'feud_n13_ajiu_arrive',
    name: '阿九到来',
    description: '会长身边多了个新来的姑娘，叫阿九。',
    placement: [{ nodes: [13], when: storyWhen('feud') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '新来的',
            description:
                '会长身边多了个新来的姑娘，叫阿九。做事稳当，话不多，笑起来很温柔。据说她以前在寄宿学校，毕业没多久，被安排来负责会长的起居。',
            choices: [{ id: 'reward_round', type: 'continue', label: '没在意' }],
        },
        { id: 'reward_round', title: '后来', description: '你没太在意。特殊事件调查科的事够多了。', choices: [] },
    ],
}

/** node 14: 主线·九朵桃花现场勘查——奇岚到场、竹子验尸、纸屑残片（写 bar_done） */
export const FEUD_N14_CRIME_SCENE: EventDef = {
    id: 'feud_n14_crime_scene',
    name: '九朵桃花·现场',
    description: '你接到消息赶到九朵桃花时，奇岚已经到了。',
    placement: [{ nodes: [14], when: storyWhen('feud') }],
    effects: [{ kind: 'set', flag: 'bar_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '后院',
            description: '「后院。死者是军方的人。」奇岚朝你点了点头。竹子蹲在尸体旁边，翻了翻伤口，站起来说：「心脏暴毙。」但你看他的眼神——他不信。',
            choices: [{ id: 'evidence', type: 'continue', label: '检查衣物' }],
        },
        {
            id: 'evidence',
            title: '纸屑',
            description:
                '你检查了死者的衣物。内衬夹层里有一叠被烧过的纸屑——据奇岚说，他翻进后院时陶朵正在烧东西，被他吓了一跳，剩下的碎纸掉在地上。你拼了拼，勉强认出几个零散的字："2074"……半个"木"字偏旁……"义"……"火"。',
            choices: [{ id: 'question', type: 'continue', label: '收好' }],
        },
        {
            id: 'question',
            title: '盘问',
            description:
                '你把纸屑收好，没有声张。你盘问了现场的人。陶朵说她什么也没看见。方烈说他一直在门口没进来。来风说他路过。证物已经碳化了，上不了台面。但你已经不需要更多了。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收队' }],
        },
        { id: 'reward_round', title: '锁定', description: '你锁定了嫌疑人。剩下的，只是时间问题。', choices: [] },
    ],
}

/** node 15: 主线·与阿九相处——日久生情 */
export const FEUD_N15_AJIU_TIME: EventDef = {
    id: 'feud_n15_ajiu_time',
    name: '与阿九相处',
    description: '阿九在会长府的院子等你。',
    placement: [{ nodes: [15], when: storyWhen('feud') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '院子',
            description:
                '你在会长府的院子里练功，阿九端着茶站在廊下看。日子久了，她会在你练完功的时候递上帕子，会记住你不吃辣，会把你随口说过的一句话记在心里。你开始习惯她的存在。',
            choices: [{ id: 'reward_round', type: 'continue', label: '接过茶' }],
        },
        { id: 'reward_round', title: '习惯', description: '习惯，是件危险的事。你后来才明白。', choices: [] },
    ],
}

/** node 18: 主线·发现真相——阿九与组织有关联（学校+义体手） */
export const FEUD_N18_TRUTH: EventDef = {
    id: 'feud_n18_truth',
    name: '发现真相',
    description: '你无意中看到了阿九的右手。',
    placement: [{ nodes: [18], when: storyWhen('feud') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '义体手',
            description:
                '阿九帮你倒茶时，袖口滑落，露出右手——金属的关节，义体。你见过这种义体，是组织研发部的制式。还有，你查过她的档案：寄宿学校，青山第二寄宿学校——组织招揽孤儿的那所。',
            choices: [{ id: 'reward_round', type: 'continue', label: '没问' }],
        },
        {
            id: 'reward_round',
            title: '压着',
            description: '你什么都没问。但你知道，会长身边这个姑娘，和组织脱不开干系。',
            choices: [],
        },
    ],
}

/** node 21: 主线·内心挣扎——告诉会长，还是不告诉 */
export const FEUD_N21_STRUGGLE: EventDef = {
    id: 'feud_n21_struggle',
    name: '内心挣扎',
    description: '你坐在调查科的院子里，一坐就是一夜。',
    placement: [{ nodes: [21], when: storyWhen('feud') }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '一夜',
            description:
                '告诉会长？他是你的养父，是他把你从废墟里抱出来的。阿九是组织的人——可阿九把会长照顾得那么好，她笑起来那么真。你手里的证据，一封匿名信就能交出去。你坐了一夜，信写了又撕，撕了又写。',
            choices: [{ id: 'reward_round', type: 'continue', label: '先放着' }],
        },
        { id: 'reward_round', title: '先放着', description: '你决定再等等。有些答案，你会亲自去要。', choices: [] },
    ],
}

/** node 32: 主线·白山月——决赛前，父亲军中旧友拦路试炼，赠功法 */
export const FEUD_N32_BAISHAN: EventDef = {
    id: 'feud_n32_baishan',
    name: '白山月',
    description: '一名腰悬唐刀的女子拦住你的去路。',
    placement: [{ nodes: [32], when: storyWhen('feud') }],
    reward: { kind: 'item', pool: 'passive' },
    rounds: [
        {
            id: 'greeting',
            title: '旧友',
            description:
                '一名腰悬唐刀的女子拦住你的去路。她上下打量了你一番，笑道：「你就是老陆的儿子？我叫白山月，曾与你父亲并肩作战。让我看看他教了你些什么。」',
            choices: [{ id: 'combat_round', type: 'continue', label: '迎战' }],
        },
        {
            id: 'combat_round',
            title: '切磋',
            enemyId: 'hongti',
            description: '唐刀出鞘，快如闪电。你全力以赴，仍被她的气势压了一头——但你接住了。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收招' }],
        },
        {
            id: 'reward_round',
            title: '见面礼',
            description:
                '白山月收回唐刀，满意地点了点头：「底子不错，有你父亲当年的风范。这门功法你拿去练，算是我的见面礼。若有事，随时可来找我。」说罢她转身离去，身影很快消失在街角。',
            choices: [],
        },
    ],
}

// ════════════════════════════════════════
//  一阶段中段（n4-7）渲染池：会长府的日子
//  从 n4 起主角已 7-8 岁；渲染池 3 选 1 候选，每局各至多一次，可空缺。
// ════════════════════════════════════════

/** node 4-7 渲染池：会长府（姬仲养育、多一副碗筷） */
export const FEUD_RENDER_MANOR: EventDef = {
    id: 'feud_render_manor',
    name: '会长府',
    description: '会长府的灯，总是留到很晚。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('feud', 'feud_render_manor_done') },
    ],
    effects: [{ kind: 'set', flag: 'feud_render_manor_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '灯下',
            description: '灭门之后，是姬仲把你带回会长府的。他教你认字，教你握剑，晚饭总多备一副碗筷。「多吃点，长身体。」他说。',
            choices: [{ id: 'reward_round', type: 'continue', label: '吃饭' }],
        },
        {
            id: 'reward_round',
            title: '碗筷',
            description: '你慢慢长大，会长府的灯也慢慢习惯为你留到很晚。你后来才知道，那些年他查了很多东西，都没有告诉你。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：会长教你轻功 */
export const FEUD_RENDER_QINGGONG: EventDef = {
    id: 'feud_render_qinggong',
    name: '学轻功',
    description: '姬仲说，轻功是保命的本事。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('feud', 'feud_render_qinggong_done') },
    ],
    effects: [{ kind: 'set', flag: 'feud_render_qinggong_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '房梁',
            description: '姬仲站在房梁上，朝你伸手：「上来。」你不敢。他笑了：「摔下来我接着。轻功不是天生的，是摔出来的。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '跳' }],
        },
        {
            id: 'reward_round',
            title: '檐上',
            description: '你从房梁跳到檐上，又跳到院墙。风从耳边过，你第一次觉得，自己能追上什么了。',
            choices: [],
        },
    ],
}

/** node 4-7 渲染池：白山月来访（父亲军中旧友，隔三差五来看你；n12 已改为加入调查科，此处纯渲染） */
export const FEUD_RENDER_BAISHAN: EventDef = {
    id: 'feud_render_baishan',
    name: '白山月来访',
    description: '白山月腰悬唐刀，进门先打量了你一圈。',
    placement: [
        { nodes: STAGE1_MID, fallback: true, weight: 2, when: storyRenderWhen('feud', 'feud_render_baishan_done') },
    ],
    effects: [{ kind: 'set', flag: 'feud_render_baishan_done', to: true }],
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'scene',
            title: '故人',
            description: '白山月是父亲军中的旧友，隔三差五来会长府看你。她总先跟你过几招，再指点几句。「你爹的底子没丢，就是火候还差得远。」',
            choices: [{ id: 'reward_round', type: 'continue', label: '接着练' }],
        },
        {
            id: 'reward_round',
            title: '唐刀',
            description: '她腰间的唐刀从来不拔给你看。临走她拍拍你的头：「练好了，哪天我考考你。」',
            choices: [],
        },
    ],
}
