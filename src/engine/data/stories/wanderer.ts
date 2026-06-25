import type { Story } from '../../entities/story'

export const WANDERER: Story = {
    id: 'wanderer',
    name: '奇遇流',
    characterName: '浪迹者',
    desc: '小时候有个很好的玩伴，是个孤儿。后来听说她被招入了**学校修习，就没再见过。',
    tags: [],
    comment:
        '二阶段＝与玩伴重逢，共处一段时日｜二阶段末＝玩伴被派任务杀卧底，你目睹了她的另一面，天塌了｜三阶段＝你发现玩伴（朵儿）报名斗炁大会，也随之报名；决赛最后boss＝打朵儿。四天王之一，高根骨+类似陈朵的毒。',
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
