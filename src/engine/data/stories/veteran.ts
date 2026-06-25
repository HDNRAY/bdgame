import type { Story } from '../../entities/story'

export const VETERAN: Story = {
    id: 'veteran',
    name: '军旅退伍',
    characterName: '退役军人',
    desc: '世代从军。你从小在军营边长大，看惯了操练和号角。',
    tags: [],
    comment:
        '一阶段＝部队生活，天真烂漫｜二阶段＝退伍后遇一起退伍的好兄弟，他卧底组织被害身亡｜三阶段＝同是卧底的张烈（变节与否以后再定）。',
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
        return undefined
    },
}
