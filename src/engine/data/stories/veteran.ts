import type { Story } from '../../entities/story'

export const VETERAN: Story = {
    id: 'veteran',
    name: '军旅退伍',
    characterName: '退役军人',
    desc: '世代从军。你从小在军营边长大，看惯了操练和号角。',
    tags: [],
    comment:
        '一阶段＝部队生活，天真烂漫，教官陆红提（铁剑·红提）｜二阶段＝退伍后遇一起退伍的好兄弟（军中斥候掠影的战友），他卧底组织被害身亡｜三阶段＝同是卧底的张烈（变节与否以后再定）。陆红提：组织卧底行动联系人，掠影上级。掠影：军方斥候，短发素衣，普通长相，未参与卧底。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '你天天扒在军营训练场的栅栏边偷看，晚上趁没人时捡根木棍自己比划。时间长了，居然也让你学了个七七八八。',
            }
        if (nodeIndex === 3)
            return {
                flavorText: '你照着小校场上老兵们练的把式偷偷模仿，一来二去，竟也摸索出了几招自己的路数。',
            }
        if (nodeIndex === 4)
            return {
                flavorText: '一位老班长察觉到你的天赋，悉心指点。在他的教导下，你开始系统地学习正统的功法。',
                forceRewardType: 'passive',
            }
        if (nodeIndex === 5)
            return {
                flavorText: '年月如梭。十四岁那年，你正式成为军营的勤杂，开始接受正规训练。',
            }
        if (nodeIndex === 6)
            return {
                flavorText: '十六岁，你正式入伍。多年的苦练终于派上用场，你在新兵训练中脱颖而出。',
            }
        return undefined
    },
}
