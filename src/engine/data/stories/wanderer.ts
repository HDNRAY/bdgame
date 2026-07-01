import type { Story } from '../../entities/story'

export const WANDERER: Story = {
    id: 'wanderer',
    name: '奇遇流',
    characterName: '浪迹者',
    desc: '小时候有个很好的玩伴，是个孤儿。后来听说她被招入了**学校修习，就没再见过。七岁那年你在后山玩耍，偶遇一对隐世夫妇——过儿与龙女。他们见你筋骨不错，便赠你兵器、教你功法。',
    tags: [],
    comment:
        '二阶段＝与玩伴重逢，共处一段时日｜二阶段末＝玩伴被派任务杀卧底，你目睹了她的另一面，天塌了｜三阶段＝你遇到喝酒的来风，打抱不平后切磋结拜。来风报名斗炁大会，邀你同去，你本不想去，他说报名名单上有朵儿的名字，你才决定去。决赛最后boss＝打朵儿。过儿+龙女：后山相遇的隐世夫妇，赠兵器教功法。来风：结拜兄弟。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '七岁那年你在后山玩耍，无意中发现了一个隐蔽的山洞。洞中一对夫妇正在清点行囊——男子背负一柄大剑，女子腰悬双剑。他们见你筋骨不错，便将洞中留下的几件兵器和图谱赠予了你。你后来才知道，他们叫过儿与龙女。',
            }
        if (nodeIndex === 3)
            return {
                flavorText: '过儿和龙女留下的图谱在你脑海中挥之不去。你一遍遍回想、比划，渐渐悟出了其中的门道。',
            }
        return undefined
    },
}
