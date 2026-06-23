import type { Story } from '../../entities/story'

export const WANDERER: Story = {
    id: 'wanderer',
    name: '普通散人',
    desc: '普普通通。',
    tags: [],
    comment: '简单奇遇流。一阶段Boss随机，决赛对手随机，没有特别剧情绑定。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '七岁那年你在后山玩耍，无意中发现了一个隐蔽的山洞。洞中石台上放着三件兵器，旁边石壁上刻满了招式图谱。你当时记在心里，回家后偷偷练了起来。',
            }
        if (nodeIndex === 3)
            return {
                flavorText: '山洞石壁上那些图谱在你脑海中挥之不去。你一遍遍回想、比划，渐渐悟出了其中的门道。',
            }
        return undefined
    },
}
