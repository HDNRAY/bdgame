import type { Story } from '../../entities/story'

export const SECT: Story = {
    id: 'sect',
    name: '天生道种',
    characterName: '天骄',
    desc: '自幼与师兄被选入山门修行。你们都是百年一遇的天生道种，虽然年纪有差，但一起入门，是最亲的师兄弟。你们的修炼由同是天生道种的腊月安排。',
    tags: [],
    comment:
        'n11(9岁/师兄10岁)＝师兄假死被组织带走｜n16(9年后)＝比武大会碰到乔装师兄，朵儿断后，中毒，产生"执念"｜n19(3年后)＝调查非法义体交易时看到朵儿，得知组织要渗透斗炁大会｜n22＝随机对手（除军师/朵儿）｜最终Boss＝军师（师兄，被洗脑身居高位）。朵儿：高根骨用毒，师兄的搭档。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 1) return { cultPoints: 0 }
        if (nodeIndex === 2)
            return {
                cultPoints: 1,
                flavorText: '入山门那年你刚满五岁。掌门领你到藏兵阁，让你以炁感应。三件法器微微发光，等你伸手。',
            }
        if (nodeIndex === 3)
            return {
                flavorText: '师父说你的根骨百年难遇，便破例将三门基础功法一并传你，让你挑一门先练着。',
            }
        if (nodeIndex === 11)
            return {
                cultPoints: 0,
                flavorText:
                    '那夜宗门大火，师兄的"尸体"被从废墟中抬出。你才九岁，跪在雨中看着白布下渗出的血，不明白为什么最亲的人会抛下你。',
            }
        if (nodeIndex === 16)
            return {
                cultPoints: 1,
                flavorText:
                    '九年了。你代表宗门参加比武大会，台下人群中闪过一个熟悉的身影——师兄！你追出三里地，却被一个用毒的女人拦住。待你逼退她，师兄早已不见。毒入经脉的剧痛让你清醒：他还活着，但已经不是你的师兄了。这份执念，从这一刻开始。',
            }
        if (nodeIndex === 19)
            return {
                cultPoints: 1,
                flavorText:
                    '三年了。你一直在天下行走，借调查之名寻找师兄的下落。这天你在隔壁镇查一宗非法义体交易，意外看到了朵儿——三年前那个女人。你听到他们提到"斗炁大会"。你压下冲动，先完成了调查任务。师兄的事，不能急。',
            }
        if (nodeIndex === 22)
            return {
                cultPoints: 1,
                flavorText:
                    '斗炁大会在即，各路高手云集。你知道组织一定会派人渗透，也许师兄也在其中。你握紧拳头——是时候了断了。',
            }
        if (nodeIndex >= 2 && (nodeIndex - 2) % 4 === 0) return { cultPoints: 1 }
        return undefined
    },
}
