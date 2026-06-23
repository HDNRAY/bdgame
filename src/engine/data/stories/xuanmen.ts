import type { Story } from '../../entities/story'

export const XUANMEN: Story = {
    id: 'xuanmen',
    name: '玄门子弟',
    desc: '御物世家，以炁御器。你从记事起就开始修炼家传功法。',
    tags: ['imperial'],
    comment: '唯一与武器绑定的故事，只能选御物(游丝/三相珠/大剑)。一阶段Boss＝兄弟/姐妹（家族试炼·需手刃至亲）。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '你六岁那年，父亲将你叫到祖祠前。三件家族御物悬浮在炁阵中，他说："伸出手，感受哪一件与你共鸣。"',
                choices: [
                    { id: 'floating_silk', name: '七段丝', desc: '一缕以炁御动的柔丝', tags: ['imperial'] },
                    { id: 'tri_orb', name: '三相珠', desc: '三颗由炁劲驱动的法珠', tags: ['imperial'] },
                    { id: 'fei_jian', name: '一柄大剑', desc: '御剑飞行，剑气纵横', tags: ['imperial'] },
                ],
            }
        if (nodeIndex === 3)
            return {
                flavorText: '父亲检查了你的根骨后，翻出家传的三页残卷，让你从中选一式先学着。',
            }
        return undefined
    },
}
