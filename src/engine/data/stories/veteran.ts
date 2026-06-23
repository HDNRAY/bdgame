import type { Story } from '../../entities/story'

export const VETERAN: Story = {
    id: 'veteran',
    name: '军旅退伍',
    desc: '世代从军。你从小在军营边长大，看惯了操练和号角。',
    tags: [],
    comment:
        '退役后战友们调查隐藏boss和组织时被害，有些是军队排进组织的卧底。张烈也是军旅退伍，但已是组织的人。一阶段Boss＝最好的战友（被组织控制/洗脑）。',
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
