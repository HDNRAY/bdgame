import type { Story } from '../../entities/story'

export const BLOOD_FEUD: Story = {
    id: 'blood_feud',
    name: '血海深仇',
    characterName: '遗孤',
    desc: '幼年家族被隐藏boss的组织灭门，会长（父亲挚友）恰好救了你，从此在青山镇长大。',
    tags: [],
    comment:
        '一阶段＝一个身负重伤的组织成员｜二阶段＝阿九来照顾会长，你喜欢上了TA；二阶段末发现阿九也是组织的人，错手杀死TA｜三阶段＝打军师和隐藏boss，复仇却填不满心灵缺失，最终选择"回到过去"。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '那年你六岁。会长从家里找出你父亲遗留的三件兵器，递给你说："这是你父亲留下的。你从中挑一件，我来教你怎么用。"',
            }
        if (nodeIndex === 3)
            return {
                flavorText:
                    '会长教你的是炼炁协会的基础功法，循序渐进，很是耐心。但你修炼时眼神总是很凶，好像要把仇恨都煅进骨子里。',
            }
        return undefined
    },
}
