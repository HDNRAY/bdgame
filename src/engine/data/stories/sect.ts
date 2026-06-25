import type { Story } from '../../entities/story'

export const SECT: Story = {
    id: 'sect',
    name: '天生道种',
    characterName: '天骄',
    desc: '自幼与师兄被选入山门修行。你们都是百年一遇的天生道种，虽然年纪有差，但一起入门，是最亲的师兄弟。',
    tags: [],
    comment:
        '一阶段末＝与师兄单挑，赢后TA被人害死（实为假死，被组织秘密带走）｜二阶段＝知道仇人组织者（高根骨+毒）要参加斗炁大会｜三阶段＝决赛碰上仇人。军师是组织中推演最强者，是你师兄的首领。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 1) return { cultPoints: 0 }
        if (nodeIndex === 2)
            return {
                cultPoints: 1,
                flavorText: '入山门那年你刚满七岁。掌门领你到藏兵阁，让你以炁感应。三件法器微微发光，等你伸手。',
            }
        if (nodeIndex === 3)
            return {
                flavorText: '师父说你的根骨百年难遇，便破例将三门基础功法一并传你，让你挑一门先练着。',
            }
        if (nodeIndex >= 2 && (nodeIndex - 2) % 4 === 0) return { cultPoints: 1 }
        return undefined
    },
}
