import type { EventDef } from '../../game/entities/event'
import { getWeapon } from '../weapons/weapons'
import { STARTING_WEAPONS } from '../weapons/starting-weapons'

import { CHRONICLE_EVENTS } from './chronicle'

export const BRANCH_PASSIVE: EventDef = {
    id: 'branch_passive',
    name: '深山发现炼炁秘籍',
    description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
    rewardType: 'passive',
    rounds: [
        {
            id: 'discover',
            title: '奇遇',
            description: '你在深山中意外发现一本古老的炼炁秘籍，若能参透，实力必将大增。',
            choices: [{ id: 'reward', type: 'continue', label: '参悟秘籍' }],
        },
        {
            id: 'reward',
            title: '参悟',
            choices: [],
        },
    ],
}

export const BRANCH_ACTION: EventDef = {
    id: 'branch_action',
    name: '在家打磨套路',
    description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
    rewardType: 'action',
    rounds: [
        {
            id: 'practice',
            title: '打磨',
            description: '你回到家中，细细打磨自己的招式套路，去芜存菁。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打磨' }],
        },
        {
            id: 'reward',
            title: '新招',
            choices: [],
        },
    ],
}

export const BRANCH_ARTIFACT: EventDef = {
    id: 'branch_artifact',
    name: '做任务获得奖励',
    description: '你完成了一项委托，雇主给予了丰厚的报酬。',
    rewardType: 'artifact',
    rounds: [
        {
            id: 'quest',
            title: '任务完成',
            description: '你完成了一项委托，雇主给予了丰厚的报酬。',
            choices: [{ id: 'reward', type: 'continue', label: '领取报酬' }],
        },
        {
            id: 'reward',
            title: '报酬',
            choices: [],
        },
    ],
}

export const BRANCH_POINTS: EventDef = {
    id: 'branch_points',
    name: '瀑布打坐',
    description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
    rewardType: 'points',
    rounds: [
        {
            id: 'meditate',
            title: '打坐',
            description: '你寻到一处瀑布，在轰鸣的水声中静心打坐，感悟天地灵气。',
            choices: [{ id: 'reward', type: 'continue', label: '继续打坐' }],
        },
        {
            id: 'reward',
            title: '感悟',
            choices: [],
        },
    ],
}

export const BRANCH_HEAL: EventDef = {
    id: 'branch_heal',
    name: '去医馆治疗',
    description: '你前往镇上医馆，请老医师为你调理伤势。',
    rewardType: 'heal',
    rounds: [
        {
            id: 'clinic',
            title: '医馆',
            description: '你前往镇上医馆，请老医师为你调理伤势。',
            choices: [{ id: 'reward', type: 'continue', label: '接受治疗' }],
        },
        {
            id: 'reward',
            title: '疗伤',
            choices: [],
        },
    ],
}

/** 去天工坊找千星打造武器 */
export const TIANGONG_WEAPON: EventDef = {
    id: 'tiangong_weapon',
    name: '天工坊',
    description: '斗炁大会即将开始，你在街上看到了天工坊的招牌。千星正靠在门口擦一把新出炉的兵器。',
    rewardType: 'weapon',
    // 天工坊只打造坊中名器：不出起始武器（街边货），不出御物（玄门血统限定，池本身已排除）
    rewardFilter: (item) => !STARTING_WEAPONS.some((w) => w.id === item.id),
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

/** 斗炁图书馆 — 龙语仙（防御功法）/ 白狐（攻击功法） */
export const LIBRARY_EVENT: EventDef = {
    id: 'douqi_library',
    name: '斗炁图书馆',
    description: '你在街角发现了一座古朴的图书馆，檐下匾额写着「斗炁图书馆」四个字。',
    rewardType: 'passive',
    rewardFilter: (item) => item.tags.includes('defense') || item.tags.includes('damage'),
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
            choices: [],
            rewardFilter: (item) => item.tags.includes('defense'),
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
            choices: [],
            rewardFilter: (item) => item.tags.includes('damage'),
        },
        {
            id: 'fox_epilogue',
            title: '白狐的赠言',
            description: '"下次来提前说一声，我给你留几本新到的。" 白狐笑眯眯地挥了挥爪子，又埋头扎进了书堆里。',
            choices: [{ id: '__end__', type: 'continue', label: '离开图书馆' }],
        },
    ],
}

/** 药屋 — 小花指教洞察/推演 */
export const XIAOHUA_INSIGHT: EventDef = {
    id: 'xiaohua_insight',
    name: '药屋问心',
    description: '你去药屋拜访小花，想请教洞察与推演之道。',
    rewardType: 'passive',
    rewardFilter: (item) =>
        [
            'combat_instinct',
            'insight_awareness',
            'hearing_power',
            'mingjing_zhishui',
            'enhanced_vision',
            'martial_arts_archive',
        ].includes(item.id),
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
        {
            id: 'reward',
            title: '收获',
            choices: [],
        },
    ],
}

// ── 双持修习（事件条件：主手为 single_handed 且非御物） ──

/** 双持修习事件：给玩家一把副手武器 */
export const DUAL_WIELD_EVENT: EventDef = {
    id: 'dual_wield_training',
    name: '双持修习',
    description: '你在街角遇到一位双持高手，他看出你使单手兵器的底子，愿意传授双持之道。',
    rewardType: 'weapon',
    rewardFilter: (item) => item.tags.includes('one_handed'),
    available: (state) => {
        if (state.build.offhand) return false // 已有副手
        const weapon = getWeapon(state.build.weapon)
        return weapon.tags.includes('one_handed') && !weapon.tags.includes('imperial')
    },
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
    rewardType: 'action',
    rewardFilter: (item) => {
        if (!('apCost' in item)) return false
        return item.apCost >= 4 && !item.tags.includes('pre_action') && !item.tags.includes('post_action')
    },
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

// ── 回忆中的回忆（固有功法） ──

/** 固有功法三选一（inherent 被动，普通奖励池排除，仅本事件可获得） */
export const MEMORY_REWARDS = [
    {
        id: 'one_arm',
        label: '独臂',
        description: '总有断臂之人不喜义体。运劲更凝练，招式消耗降低 1AP（最低 1），无法双持。',
    },
    {
        id: 'ningqi_jue',
        label: '凝炁诀',
        description: '药屋家传呼吸法，以炁劲贯通全身，所有招式带炁，全属性 +1。',
    },
    {
        id: 'ordinary_training',
        label: '平平无奇的锻炼',
        description: '日复一日的刻苦锻炼，身法提升闪避，灵巧提升招架。',
    },
] as const

/** 第一阶段靠前节点的"回忆中的回忆"：梦中借别人的一生，醒来功法烙进记忆 */
export const MEMORY_WITHIN_MEMORY: EventDef = {
    id: 'memory_within_memory',
    name: '回忆中的回忆',
    description: '你做了一个奇怪的梦：梦里你不是你，是另一个人。',
    rewardType: 'passive',
    rounds: [
        {
            id: 'fall_asleep',
            title: '入梦',
            description: '你睡下了。先是黑，然后有了光。',
            choices: [{ id: 'dream', type: 'continue', label: '继续睡' }],
        },
        {
            id: 'dream',
            title: '别人的一段人生',
            description:
                '你借一双陌生的眼睛，活了一小段人生。看不清脸，记不住名字，只有身体记得——练过的那门功法，刻进了骨头里。',
            choices: [{ id: 'reward_round', type: 'continue', label: '跟着练' }],
        },
        {
            id: 'reward_round',
            title: '选择功法',
            description: '你抓住那道记忆。三选一，只能带走一门。',
            choices: MEMORY_REWARDS.map((r) => ({
                id: r.id,
                type: 'passive' as const,
                label: r.label,
                description: r.description,
            })),
        },
        {
            id: 'wake',
            title: '醒来',
            description: '你坐起来，天刚亮。梦已经忘了大半，但功法还在。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

export const BRANCH_EVENTS: EventDef[] = [
    BRANCH_PASSIVE,
    BRANCH_ACTION,
    BRANCH_ARTIFACT,
    BRANCH_POINTS,
    BRANCH_HEAL,
    TIANGONG_WEAPON,
    LIBRARY_EVENT,
    XIAOHUA_INSIGHT,
    DUAL_WIELD_EVENT,
    WATERFALL_EPIPHANY,
    ...CHRONICLE_EVENTS,
]
