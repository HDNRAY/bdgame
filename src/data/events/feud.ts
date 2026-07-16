import type { EventDef } from '../../entities/event'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { isBasicAction } from '../../systems/roguelite/util'

// ════════════════════════════════════════
//  血海深仇 — 自定义事件
// ════════════════════════════════════════

/** node 2: 选兵器 → 叙事 → 选奖励 → 告诫 → 继续 */
export const FEUD_N02_WEAPON: EventDef = {
    id: 'feud_n02_weapon',
    name: '选兵器',
    description:
        '那年你六岁。会长从家里找出你父亲遗留的三件兵器，递给你说：「这是你父亲留下的。你从中挑一件，我来教你怎么用。」',
    rewardType: 'weapon',
    rewardFilter: (item) => STARTING_WEAPONS.some((w) => w.id === item.id),
    rounds: [
        {
            id: 'intro',
            title: '父亲的遗物',
            description:
                '那年你六岁。会长从家里找出你父亲遗留的三件兵器，递给你说：「这是你父亲留下的。你从中挑一件，我来教你怎么用。」',
            choices: [],
        },
        {
            id: 'epilogue',
            title: '父亲的叮嘱',
            description:
                '会长看着你手中的兵器，点了点头：「好眼力。这把兵器跟了你，就别让它蒙尘。好好修炼，莫要辜负了你父亲的期望。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 3: 选招式 → 叙事 → 选奖励 → 告诫 → 继续 */
export const FEUD_N03_ACTION: EventDef = {
    id: 'feud_n03_action',
    name: '选招式',
    description:
        '会长教你的是炼炁协会的基础功法，循序渐进，很是耐心。但你修炼时眼神总是很凶，好像要把仇恨都煅进骨子里。',
    rewardType: 'action',
    rewardFilter: isBasicAction,
    rounds: [
        {
            id: 'intro',
            title: '修炼',
            description:
                '会长教你的是炼炁协会的基础功法，循序渐进，很是耐心。但你修炼时眼神总是很凶，好像要把仇恨都煅进骨子里。',
            choices: [],
        },
        {
            id: 'epilogue',
            title: '会长的告诫',
            description:
                '会长拍了拍你的肩：「仇恨是一把双刃剑。让它驱动你变强，但别让它吞噬你。去吧，今天的修炼就到这。」',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** 二阶段：陆红提示切磋 — 寒暄 → 战斗 → 选功法 → 结束 → 继续 */
export const FEUD_LUHONGTI_SPAR: EventDef = {
    id: 'feud_luhongti_spar',
    name: '陆红提的试炼',
    description: '父亲军中旧友陆红提找到你，说要试试你的身手。',
    rewardType: 'passive',
    rounds: [
        {
            id: 'greeting',
            title: '旧友来访',
            description:
                '一名腰悬唐刀的女子拦住你的去路。她上下打量了你一番，笑道：「你就是老陆的儿子？我叫陆红提，曾与你父亲并肩作战。让我看看他教了你些什么。」',
            choices: [{ id: 'combat_round', type: 'continue', label: '迎战' }],
        },
        {
            id: 'combat_round',
            title: '切磋',
            enemyId: 'luhongti',
            choices: [],
        },
        {
            id: 'epilogue',
            title: '陆红提的评价',
            description:
                '陆红提收回唐刀，满意地点了点头：「底子不错，有你父亲当年的风范。这门功法你拿去练，算是我的见面礼。若有事，随时可来找我。」说罢她转身离去，身影很快消失在街角。',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}

/** node 22: Boss 战 — 阿九 — 叙事 → 战斗 → 修炼点 → 结束 */
export const BOSS_AJIU: EventDef = {
    id: 'boss_ajiu',
    name: '阿九',
    description: '一个身负重伤的组织成员。你认出了他——他就是当年灭门的参与者之一。',
    rewardType: 'points',
    rounds: [
        {
            id: 'intro',
            title: '仇人见面',
            description:
                '一个身负重伤的组织成员倒在巷口。你认出了他——他就是当年灭门的参与者之一。他看见你，咧嘴一笑：「你是……那家的孩子？哈哈哈，你长大了啊。」',
            choices: [{ id: 'combat_round', type: 'continue', label: '拔剑' }],
        },
        {
            id: 'combat_round',
            title: '复仇',
            enemyId: 'ajiu',
            description: '你拔出兵器，一步步向他走去。他挣扎着站起身，从腰间抽出一把短刀。',
            choices: [],
        },
        {
            id: 'reward_round',
            title: '复仇之后',
            choices: [{ id: '__end__', type: 'continue', label: '继续' }],
        },
    ],
}
