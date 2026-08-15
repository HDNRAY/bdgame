import type { EventDef } from '../../game/entities/event'
import type { When } from '../../game/entities/condition'
import { POOL_NODES, storyWhen } from './layout'
import { WEAPON_DB } from '../weapons/weapons'
import { STARTING_WEAPONS } from '../weapons/starting-weapons'

const STARTING_WEAPON_IDS = STARTING_WEAPONS.map((w) => w.id)

/** 双持副手候选（单手非御物坊中名器）。 */
const OFFHAND_CHOICES = WEAPON_DB.filter(
    (w) => w.tags.includes('one_handed') && !w.tags.includes('imperial'),
).map((w) => ({ id: w.id, label: w.name, description: w.description, slot: 'offhand' as const }))

/** 通用支线池放置（fallback：未被故事/固定事件占据的节点槽都可出现）。 */
const POOL_PLACEMENT = [{ nodes: POOL_NODES, fallback: true, weight: 1 }]

export const BRANCH_PASSIVE: EventDef = {
    id: 'branch_passive',
    name: '深山发现炼炁秘籍',
    description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
    placement: POOL_PLACEMENT,
    reward: { kind: 'item', pool: 'passive' },
    rounds: [
        {
            id: 'discover',
            title: '奇遇',
            description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
            choices: [{ id: 'reward', type: 'continue', label: '参悟秘籍' }],
        },
        { id: 'reward', title: '参悟', choices: [] },
    ],
}

export const BRANCH_ACTION: EventDef = {
    id: 'branch_action',
    name: '在家打磨套路',
    description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
    placement: POOL_PLACEMENT,
    reward: { kind: 'item', pool: 'action' },
    rounds: [
        {
            id: 'practice',
            title: '打磨',
            description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打磨' }],
        },
        { id: 'reward', title: '新招', choices: [] },
    ],
}

export const BRANCH_ARTIFACT: EventDef = {
    id: 'branch_artifact',
    name: '做任务获得奖励',
    description: '你完成了一项委托，雇主给予了丰厚的报酬。',
    placement: POOL_PLACEMENT,
    reward: { kind: 'item', pool: 'artifact' },
    rounds: [
        {
            id: 'quest',
            title: '任务完成',
            description: '你完成了一项委托，雇主给予了丰厚的报酬。',
            choices: [{ id: 'reward', type: 'continue', label: '领取报酬' }],
        },
        { id: 'reward', title: '报酬', choices: [] },
    ],
}

export const BRANCH_POINTS: EventDef = {
    id: 'branch_points',
    name: '瀑布打坐',
    description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
    placement: POOL_PLACEMENT,
    reward: { kind: 'points' },
    rounds: [
        {
            id: 'meditate',
            title: '打坐',
            description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打坐' }],
        },
        { id: 'reward', title: '感悟', choices: [] },
    ],
}

export const BRANCH_HEAL: EventDef = {
    id: 'branch_heal',
    name: '去医馆治疗',
    description: '你前往镇上医馆，请老医师为你调理伤势。',
    placement: POOL_PLACEMENT,
    reward: { kind: 'heal' },
    rounds: [
        {
            id: 'clinic',
            title: '医馆',
            description: '你前往镇上医馆，请老医师为你调理伤势。',
            choices: [{ id: 'reward', type: 'continue', label: '接受治疗' }],
        },
        { id: 'reward', title: '疗伤', choices: [] },
    ],
}

/** 去天工坊找千星打造武器（只出坊中名器，不出起始武器/御物；天生道种线固定 n25） */
export const TIANGONG_WEAPON: EventDef = {
    id: 'tiangong_weapon',
    name: '天工坊',
    description: '斗炁大会即将开始，你在街上看到了天工坊的招牌。千星正靠在门口擦一把新出炉的兵器。',
    placement: [{ nodes: [25], when: storyWhen('sect') }, ...POOL_PLACEMENT],
    reward: { kind: 'item', pool: 'weapon', excludeIds: STARTING_WEAPON_IDS },
    rounds: [
        {
            id: 'intro',
            title: '天工坊',
            description:
                '斗炁大会即将开始，你在街上看到了天工坊的招牌。千星正靠在门口擦一把新出炉的兵器，看到你便扬了扬下巴：「哟，来了？这次进了决赛圈，要不要换件趁手的家伙？」',
            choices: [
                { id: 'reward_round', type: 'continue', label: '去天工坊看看' },
                { id: 'training', type: 'continue', label: '不去，在家修炼' },
            ],
        },
        {
            id: 'reward_round',
            title: '挑选材料',
            description: '材料柜里陈列着几件千星打造的兵器，泛着淡淡的炁光。',
            choices: [],
        },
        {
            id: 'training',
            title: '在家修炼',
            description: '你决定不去天工坊，留在住处潜心修炼，巩固修为。',
            choices: [{ id: '__end__', type: 'points', label: '潜心修炼（+4 修炼点）' }],
        },
    ],
}

/** 斗炁图书馆（所有故事固定 n24）：龙语仙（防御）/ 白狐（攻击） */
export const LIBRARY_EVENT: EventDef = {
    id: 'douqi_library',
    name: '斗炁图书馆',
    description: '你在街角发现了一座古朴的图书馆，檐下匾额写着「斗炁图书馆」四个字。',
    placement: [{ nodes: [24] }],
    rounds: [
        {
            id: 'intro',
            title: '斗炁图书馆',
            description:
                '你推开木门，一股书卷气扑面而来。柜台后一名龙角少女正悠闲地翻着书，见你进来便抬眼一笑："新面孔嘛，随便看。"\n\n角落的蒲团上，一只白狐蜷着尾巴，专心致志地盯着一本泛黄的古籍，尾巴尖时不时抖一下，完全没注意到你。',
            choices: [
                { id: 'dragon_reward', type: 'continue', label: '找龙语仙请教防御功法' },
                { id: 'fox_reward', type: 'continue', label: '找白狐请教攻击功法' },
                { id: '__end__', type: 'continue', label: '随便翻翻就走' },
            ],
        },
        {
            id: 'dragon_reward',
            title: '龙语仙的推荐',
            description:
                '"防御功法是吧？" 龙语仙放下书，走到一排书架前，指尖划过书脊，"这几本适合你——好好练，别出去让人揍得鼻青脸肿，丢我的人。"',
            reward: { kind: 'item', pool: 'passive', includeTags: ['defense'] },
            choices: [],
        },
        {
            id: 'dragon_epilogue',
            title: '龙语仙的赠言',
            description:
                '龙语仙把功法抄本塞到你手里："练熟了再来，我这还有更好的。" 她摆摆手，又窝回柜台后面看书去了。',
            choices: [{ id: '__end__', type: 'continue', label: '离开图书馆' }],
        },
        {
            id: 'fox_reward',
            title: '白狐的珍藏',
            description:
                '你走近时，白狐才从书页间抬起头，琥珀色的眼睛眨了眨。"你也喜欢看这个？" 她兴奋地翻开另一本书，"这本的记载更完整，你看看——包教包会！"',
            reward: { kind: 'item', pool: 'passive', includeTags: ['damage'] },
            choices: [],
        },
        {
            id: 'fox_epilogue',
            title: '白狐的赠言',
            description: '"下次来提前说一声，我给你留几本新到的。" 白狐笑眯眯地挥了挥爪子，又埋头扎进了书堆里。',
            choices: [{ id: '__end__', type: 'continue', label: '离开图书馆' }],
        },
    ],
}

/** 药屋 — 小花指教洞察/推演（固定几个功法里选） */
export const XIAOHUA_INSIGHT: EventDef = {
    id: 'xiaohua_insight',
    name: '药屋问心',
    description: '你去药屋拜访小花，想请教洞察与推演之道。',
    placement: POOL_PLACEMENT,
    reward: {
        kind: 'item',
        pool: 'passive',
        ids: [
            'combat_instinct',
            'insight_awareness',
            'hearing_power',
            'mingjing_zhishui',
            'enhanced_vision',
        ],
    },
    rounds: [
        {
            id: 'intro',
            title: '药屋',
            description:
                '你推门走进药屋，小花正背对着你碾药。她没有回头，只是安静地说了一句：「来了？」\n\n你说明来意——想请教洞察与推演的心法。小花停下手中的活，沉默了片刻。\n\n「洞察和推演……」她转过身来，明明双目失明，你却感到她"看"了你一眼。「想学可以，先让我看看你的底子。」',
            choices: [
                { id: 'fight_xiaohua', type: 'continue', label: '请小花亲自指点' },
                { id: 'fight_orange', type: 'continue', label: '请橘子会代为切磋' },
            ],
        },
        {
            id: 'fight_xiaohua',
            title: '小花亲自下场',
            enemyId: 'xiaohua',
            description:
                '小花缓缓起身：「好，我亲自来会会你。」\n\n她每一步都精准地踏在你的气机之上。你意识到——这不是普通的切磋，这是她用「无明之明」在"看"你。',
            choices: [{ id: 'aftermath', type: 'continue', label: '聆听指点' }],
        },
        {
            id: 'fight_orange',
            title: '橘子会迎战',
            enemyId: 'orange',
            description:
                '小花轻轻一笑：「那让橘子会陪你走几招。」\n\n橘子会从里屋走出，朝你抱拳一礼。小花退到一旁，侧耳倾听——她要通过橘子会的交手来"看"你的路数。',
            choices: [{ id: 'aftermath', type: 'continue', label: '聆听指点' }],
        },
        {
            id: 'aftermath',
            title: '小花的指点',
            description:
                '（战斗过后）小花沉默了一会儿，然后缓缓开口，从你最基础的感知方式讲起——如何区分"看"和"察"、如何用推演补洞察之不足、如何在混沌中抓住那一线先机。\n\n橘子会在旁认真听着，不时点头。你感觉到，这番指点让你的感知之道豁然开朗。',
            choices: [{ id: 'reward', type: 'continue', label: '细细体会' }],
        },
        { id: 'reward', title: '收获', choices: [] },
    ],
}

// ── 双持修习（条件：单手武器且未获副手；效果：获得副手） ──

/** 双持修习事件：给玩家一把副手武器 */
export const DUAL_WIELD_EVENT: EventDef = {
    id: 'dual_wield_training',
    name: '双持修习',
    description: '你在街角遇到一位双持高手，他看出你使单手兵器的底子，愿意传授双持之道。',
    placement: [
        {
            nodes: POOL_NODES,
            fallback: true,
            when: {
                and: [
                    { '==': [{ var: 'flags.weapon_one_handed' }, true] },
                    { '!': { var: 'flags.has_offhand' } },
                ],
            },
        },
    ],
    rounds: [
        {
            id: 'intro',
            title: '双持修习',
            description:
                '「单手兵刃使得不错，但若双持，可更进退自如。」\n\n高手从腰间解下一柄短刃，递到你面前：「试试这个。」',
            choices: [
                { id: 'accept', type: 'continue', label: '接过短刃' },
                { id: '__end__', type: 'continue', label: '婉拒，单手更适合我' },
            ],
        },
        {
            id: 'accept',
            title: '获得副手',
            description:
                '你接过短刃，试着双手各持一刃挥舞了几下。虽然还不熟练，但确实感到攻守之间多了许多变化。\n\n高手点点头：「慢慢练，双持的关键在于分心错手——让两只手各打各的。」',
            reward: { kind: 'fixed', choices: OFFHAND_CHOICES },
            choices: [],
        },
        {
            id: 'accept_epilogue',
            title: '分心错手',
            description: '你收起短刃，向高手道谢。从今往后，你也是一名双持武者了。',
            choices: [{ id: '__end__', type: 'continue', label: '继续上路' }],
        },
    ],
}

// ── 漱玉峰瀑布顿悟（4/5AP 绝技） ──

/** 去青山漱玉峰的瀑布下观水悟招，获得 4AP/5AP 绝技 */
export const WATERFALL_EPIPHANY: EventDef = {
    id: 'waterfall_epiphany',
    name: '漱玉峰瀑布',
    description: '青山偏南有一座小峰，峰腰悬着一道瀑布。传说曾有人在瀑布下悟出绝技。',
    placement: POOL_PLACEMENT,
    reward: { kind: 'item', pool: 'action', apMin: 4, noPrePost: true },
    rounds: [
        {
            id: 'climb',
            title: '上山',
            description:
                '你沿着山溪往上走。水声由远及近，等它大到整座山都在响的时候，瀑布到了——漱玉峰，峰腰一道白练，常年水雾弥漫。',
            choices: [{ id: 'watch', type: 'continue', label: '走近瀑布' }],
        },
        {
            id: 'watch',
            title: '观水',
            description:
                '你盘坐在瀑布下的青石上。水势千年不变，又每一刻都不同。你盯着那道水幕，渐渐忘了时间——忘了自己是在看水，还是在看招。',
            choices: [{ id: 'reward_round', type: 'continue', label: '静心观悟' }],
        },
        {
            id: 'reward_round',
            title: '顿悟',
            description: '一道明悟落进心里。你站起身，浑身湿透，却觉得通体轻快。',
            choices: [],
        },
        {
            id: 'descend',
            title: '下山',
            description: '你沿原路下山。那道水幕还在落，像什么都没发生过。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

// ── 回忆中的回忆（旧回忆：忽然想起自己的身世） ──
//  第一阶段（旧回忆）靠后位置（n12-21）的普通三选一池事件：非必出，出了也只是池中一个候选。
//  不是梦——是回忆自己真实的身世：独臂（年少被狼咬断手臂）/ 药屋旁支·凝炁诀（玄门不出现）/ 周家后人·周氏秘法。
//  每局至多出现一次（memory_done 门控）。

/** 固有功法三选一（inherent 被动，普通奖励池排除，仅本事件可获得） */
export const MEMORY_REWARDS: { id: string; label: string; description: string; when?: When }[] = [
    {
        id: 'one_arm',
        label: '独臂',
        description:
            '你想起那年青山边缘的狼群。你五岁，被它们拖进了林子——命捡回来了，左手没了。从那时起，你只用一只手练武。招式消耗降低 1AP（最低 1），无法双持。',
    },
    {
        id: 'ningqi_jue',
        label: '药屋旁支',
        description:
            '你想起药屋的规矩。你家的分支早已搬出主宅，但血脉没断——凝炁诀代代相传，外人学不去。所有招式带炁，全属性 +1。',
        when: { '!': { '==': [{ var: 'flags.story' }, 'xuanmen'] } },
    },
    {
        id: 'zoldyck_art',
        label: '周家后人',
        description:
            '你想起周家的雷。你身上流的血，和奇岚一样，天生亲近雷电——这是血脉，不是学的。免疫麻痹并减免雷系伤害。',
    },
]

/** 第一阶段靠后位置的"回忆中的回忆"：忽然想起一段被遗忘的身世 */
export const MEMORY_WITHIN_MEMORY: EventDef = {
    id: 'memory_within_memory',
    name: '回忆中的回忆',
    description: '你忽然想起一段被遗忘的身世。',
    placement: [
        { nodes: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21], fallback: true, when: { '!': { var: 'flags.memory_done' } } },
    ],
    effects: [{ kind: 'set', flag: 'memory_done', to: true }],
    rounds: [
        {
            id: 'old_memory',
            title: '旧忆',
            description:
                '你坐在树下歇脚，风一吹，脑子里忽然浮起一段小时候的事。那段记忆被压在底下很久了，今天不知怎么，自己浮了上来。',
            choices: [{ id: 'heritage', type: 'continue', label: '顺着往下想' }],
        },
        {
            id: 'heritage',
            title: '身世',
            description:
                '你顺着那段记忆往下想。有些事你小时候忘了，现在想起来了——有些事，不是别人，就是你自己的。',
            choices: [{ id: 'reward_round', type: 'continue', label: '记起来' }],
        },
        {
            id: 'reward_round',
            title: '记起',
            description: '你记起自己的身世。',
            choices: MEMORY_REWARDS.map((r) => ({
                id: r.id,
                type: 'passive' as const,
                label: r.label,
                description: r.description,
                when: r.when,
            })),
        },
        {
            id: 'settle',
            title: '记起来了',
            description: '你想起来了。这段身世从此不再压着——它跟着你，一直走到今天。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}
// ── 打工（特殊事件：固有功法由打工获得，每局至多一次） ──

/** 图书馆打工：帮龙语仙整理书卷 → 活武学宝典 */
export const LIBRARY_JOB: EventDef = {
    id: 'library_job',
    name: '图书馆打工',
    description: '龙语仙抱着一摞比你人还高的书，正发愁。',
    placement: [
        { nodes: POOL_NODES, fallback: true, weight: 1, when: { '!': { var: 'flags.library_job_done' } } },
    ],
    effects: [{ kind: 'set', flag: 'library_job_done', to: true }],
    rounds: [
        {
            id: 'intro',
            title: '图书馆打工',
            description:
                '龙语仙抱着一摞比你人还高的书，正发愁。看见你，眼睛一亮：「来得正好——帮我把这些武学残卷按谱系归类，晚上请你吃饭。」',
            choices: [{ id: 'work', type: 'continue', label: '帮她分类整理' }],
        },
        {
            id: 'work',
            title: '分类整理',
            description:
                '你搬来梯子，从早忙到傍晚。书卷上的字迹新旧不一——你一本本辨认谱系，一页页翻过摘要。整理完，那些武学路数也在你脑子里过了个遍。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收工' }],
        },
        {
            id: 'reward_round',
            title: '报酬',
            description:
                '「整理得不错。」龙语仙把最后一摞放回架上，回头看你，「……你该不会全记住了吧？」\n\n你没说话。你确实记住了——不是哪一招，是天下武学的路数。',
            choices: [
                {
                    id: 'martial_arts_archive',
                    type: 'passive',
                    label: '活武学宝典',
                    description: '通晓天下武学，以推演预判对手。闪/招→叠暴击；暴击→叠闪/招。',
                },
            ],
        },
    ],
}

/** 天工坊打工：帮千星拉风箱打下手 → 千锤百炼 */
export const TIANGONG_JOB: EventDef = {
    id: 'tiangong_job',
    name: '天工坊打工',
    description: '千星正抡着电磁锤，炉火把半个铺子映得通红。',
    placement: [
        { nodes: POOL_NODES, fallback: true, weight: 1, when: { '!': { var: 'flags.tiangong_job_done' } } },
    ],
    effects: [{ kind: 'set', flag: 'tiangong_job_done', to: true }],
    rounds: [
        {
            id: 'intro',
            title: '天工坊打工',
            description:
                '千星正抡着电磁锤，炉火把半个铺子映得通红。他瞥你一眼，下巴朝风箱一努：「闲着？过来拉风箱，管饭。」',
            choices: [{ id: 'work', type: 'continue', label: '上手帮忙' }],
        },
        {
            id: 'work',
            title: '打铁',
            description:
                '你拉了一下午风箱，抡了几百下锤。火星溅到手上、烫出疤，你咬着牙没吭声——千星看在眼里，末了扔给你一块烤红薯。',
            choices: [{ id: 'reward_round', type: 'continue', label: '收工' }],
        },
        {
            id: 'reward_round',
            title: '千星的指点',
            description:
                '「铁要千锤百炼，人也是。」千星难得正经地看了你一眼，「你这身板，耐得住捶打——这本锻体的路数拿去，练成了再来找我。」',
            choices: [
                {
                    id: 'qian_chui_bai_lian',
                    type: 'passive',
                    label: '千锤百炼',
                    description: '千锤百炼，水火不侵。所受灼烧伤害-30%；以根骨化力道（根骨每4点力道+1）。',
                },
            ],
        },
    ],
}

