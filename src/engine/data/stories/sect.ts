import type { Story } from '../../entities/story'

export const SECT: Story = {
    id: 'sect',
    name: '炼炁门派',
    characterName: '天骄',
    desc: '自幼被选入山门修行。你是百年一遇的天生道种。',
    tags: [],
    comment:
        '天生道种一对，两小无猜(非爱情)。被门派逼着一直比。一阶段结尾单挑，你赢后祂被人害死。二阶段知道仇人(组织的人，用毒)要参加斗炁大会。决赛碰上仇人。',
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
