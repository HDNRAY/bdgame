import type { Tag } from '../entities/tag'

/** 角色背景定义 */
export interface Background {
    id: string
    name: string
    desc: string
    /** 内部备注：隐藏机制、剧情设计（不展示给玩家） */
    comment?: string
    /** 关联标签 */
    tags?: Tag[]
}

export const BACKGROUNDS: Background[] = [
    {
        id: 'xuanmen',
        name: '玄门子弟',
        desc: '御物世家，以炁御器。你从记事起就开始修炼家传功法。',
        tags: ['imperial'],
        comment: '唯一与武器绑定的背景，只能选御物(游丝/三相珠)。一阶段Boss＝兄弟/姐妹（家族试炼·需手刃至亲）。',
    },
    {
        id: 'veteran',
        name: '军旅退伍',
        desc: '世代从军。你从小在军营边长大，看惯了操练和号角。',
        tags: [],
        comment:
            '退役后战友们调查隐藏boss和组织时被害，有些是军队排进组织的卧底。张烈也是军旅退伍，但已是组织的人。一阶段Boss＝最好的战友（被组织控制/洗脑）。',
    },
    {
        id: 'sect',
        name: '炼炁门派',
        desc: '自幼被选入山门修行。你是百年一遇的天生道种。',
        tags: [],
        comment:
            '天生道种一对，两小无猜(非爱情)。被门派逼着一直比。一阶段结尾单挑，你赢后祂被人害死。二阶段知道仇人(组织的人，用毒)要参加斗炁大会。决赛碰上仇人。',
    },
    {
        id: 'wanderer',
        name: '普通散人',
        desc: '普普通通。',
        tags: [],
        comment: '简单奇遇流。一阶段Boss随机，决赛对手随机，没有特别剧情绑定。',
    },
    {
        id: 'orphan',
        name: '普通孤儿',
        desc: '被青山镇前任会长收养，在镇里长大。',
        tags: [],
        comment:
            '被前任会长养大。会长清廉且终生未娶，但主角从小被欺负，没人真心待TA好，直到阿九。一直喜欢阿九。一阶段Boss＝阿九。二阶段最后一轮也打阿九。',
    },
    {
        id: 'blood_feud',
        name: '宗门遗孤',
        desc: '幼年宗门遇劫，你被父亲心腹保护，躲在青山镇。',
        tags: [],
        comment:
            '报仇路线，却喜欢上仇人后代。一阶段Boss＝仇人后代。想夺魁请求会长解除两家恩怨。决赛打仇人后代，TA知道自己输了会被杀，最终死在主角手上。',
    },
]

/** 按 ID 查找背景 */
export function getBackground(id: string): Background | undefined {
    return BACKGROUNDS.find((b) => b.id === id)
}
