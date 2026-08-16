import type { EventDef } from '../../game/entities/event'
import { STAGE3_POOL } from './layout'

// ════════════════════════════════════════
//  多林寺问禅（第三阶段战前池，每局至多一次）
//  禅子：多林寺修禅者，与来风、竹子为同届师兄弟；历代禅子镇守孤峰"东西"。
//  对话随身份变化，奖励随结拜与否变化：
//    - 与来风结拜过（sworn_done）→ 禅子以故人相待 → 静心功法（明镜止水）
//    - 血海深仇线（林晚风，竹子同事）→ 禅子借竹子说起 → 招式
//    - 其余 → 普通问禅 → 招式
// ════════════════════════════════════════

export const CHANZI_MEDITATION: EventDef = {
    id: 'chanzi_meditation',
    name: '多林寺问禅',
    description: '青山脚下的多林寺，檐角挂着铜铃。',
    placement: [
        {
            nodes: STAGE3_POOL,
            fallback: true,
            weight: 1,
            when: { '!': { var: 'flags.chanzi_done' } },
        },
    ],
    effects: [{ kind: 'set', flag: 'chanzi_done', to: true }],
    rounds: [
        {
            id: 'scene',
            title: '多林寺',
            description:
                '青山脚下，多林寺的檐角挂着铜铃，风一吹就响。门前一个僧人正在扫地，扫得很慢，很稳。他抬起头，目光落在你身上：「施主，进寺喝碗茶吧。」',
            choices: [{ id: 'branch', type: 'continue', label: '入寺' }],
        },
        {
            id: 'branch',
            title: '问禅',
            description: '茶是山茶，苦后回甘。僧人放下茶碗：「贫僧法号禅子。施主一路走来，心不静。」',
            choices: [
                {
                    id: 'sworn_reward',
                    type: 'continue',
                    label: '听他提起来风',
                    when: { '==': [{ var: 'flags.sworn_done' }, true] },
                    description: '禅子笑了：「来风是我同门师兄。他提起过你——说交了个好兄弟。」',
                },
                {
                    id: 'feud_reward',
                    type: 'continue',
                    label: '听他提起竹子',
                    when: {
                        and: [
                            { '==': [{ var: 'flags.story' }, 'feud'] },
                            { '!': { var: 'flags.sworn_done' } },
                        ],
                    },
                    description: '禅子看了一眼你腰间的腰牌：「竹子师兄的同事？他行医济世，你办案查人，都是替人讨公道的人。」',
                },
                {
                    id: 'default_reward',
                    type: 'continue',
                    label: '听禅',
                    when: {
                        and: [
                            { '!': { var: 'flags.sworn_done' } },
                            { '!': { '==': [{ var: 'flags.story' }, 'feud'] } },
                        ],
                    },
                    description: '禅子垂目：「心不定，则招不纯。且坐下，听一段禅。」',
                },
            ],
        },
        {
            id: 'sworn_reward',
            title: '禅子的话',
            description:
                '「来风的兄弟，便也是贫僧的故人。」禅子从袖中取出一卷经书：「这是贫僧多年参的静心之法，赠你。酒喝多了伤身，这个管用。」',
            reward: { kind: 'item', pool: 'passive', ids: ['mingjing_zhishui'] },
            choices: [],
        },
        {
            id: 'feud_reward',
            title: '禅子的话',
            description:
                '禅子讲了一段竹子师兄当年在寺里学医的事，末了说：「看人如看病，望闻问切。施主心里的事，不妨也这样，慢慢拆。」',
            reward: { kind: 'item', pool: 'action', apMax: 3 },
            choices: [],
        },
        {
            id: 'default_reward',
            title: '禅定',
            description:
                '你坐下听禅。山风过檐，铜铃不响，你心里那些乱糟糟的念头，渐渐落了下来。等睁开眼，天已经黑了。',
            reward: { kind: 'item', pool: 'action', apMax: 3 },
            choices: [],
        },
    ],
}
