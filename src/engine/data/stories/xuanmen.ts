import type { Story } from '../../entities/story'

export const XUANMEN: Story = {
    id: 'xuanmen',
    name: '玄门子弟',
    characterName: '弟子',
    desc: '御物世家，以炁御器。你从记事起就开始修炼家传功法。',
    tags: ['imperial'],
    comment:
        '唯一与武器绑定。一阶段Boss＝兄弟（化名"一个兄弟"，沿用军师build，死）｜二阶段Boss＝守门人姐妹（不死）｜三阶段Boss＝玄机兄弟（家族内斗争夺家主，反目成仇）。n6-8黑云·小树/n15揭秘/n17-20酒鬼·无志为叙事支线，详见 docs/character-relations.md。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '你六岁那年，父亲将你叫到祖祠前。三件家族御物悬浮在炁阵中，他说："伸出手，感受哪一件与你共鸣。"',
                forceEventIds: ['xuanmen_weapon'],
            }
        if (nodeIndex === 3)
            return {
                flavorText: '招式已随御物附赠，父亲翻出家传库房，让你先择一件趁手的奇物傍身。',
                forceEventIds: ['xuanmen_start_action'],
            }
        if (nodeIndex === 9)
            return {
                flavorText:
                    '那晚，父亲把你叫到书房，说出了埋藏多年的家族密辛："我族之人，唯有亲手斩断一缕血亲之情，方能真正驭使御物。你十岁那年，会有一场生死之斗——好好准备。"',
            }
        if (nodeIndex === 11)
            return {
                bossId: 'junshi',
                bossName: '一个兄弟',
                flavorText: '十岁那年，你与「一个兄弟」对峙于祖祠之前。谁都没有退路。',
            }
        if (nodeIndex === 15)
            return {
                flavorText:
                    '扶桑门比武大会上，你又见到了那位早已从家中消失的旁系叔叔——黑云·小树。他看着你，忽然笑了："其实，你根本不需要杀他。手刃血亲，不过是玄门为了更好地拿捏后代编出来的说辞。我知道了这秘密，才离开的。"话音未落，他转身再次远去。',
            }
        if (nodeIndex === 16)
            return {
                flavorText:
                    '你连夜赶回家中，质问父亲。他沉默良久，终于承认："此事……属实。但你若真想改变什么，眼下先证明你的实力。有了实力，我们再谈。"',
            }
        return undefined
    },
}
