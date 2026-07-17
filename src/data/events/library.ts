import type { EventDef } from '../../game/entities/event'

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
