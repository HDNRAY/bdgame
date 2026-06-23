import type { Story } from '../../entities/story'

export const ORPHAN: Story = {
    id: 'orphan',
    name: '普通孤儿',
    desc: '被青山镇前任会长收养，在镇里长大。',
    tags: [],
    comment:
        '被前任会长养大。会长清廉且终生未娶，但主角从小被欺负，没人真心待TA好，直到阿九。一直喜欢阿九。一阶段Boss＝阿九。二阶段最后一轮也打阿九。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '老会长从炼炁协会领了三件入门兵器回来，六岁生日那天递给你说："挑一件，明天开始我教你基础的。"',
            }
        if (nodeIndex === 3)
            return {
                flavorText: '会长教你的是炼炁协会公开的入门功法，虽然不是什么秘传，但打好基础绰绰有余。',
            }
        return undefined
    },
}
