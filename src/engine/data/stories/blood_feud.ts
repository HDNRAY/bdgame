import type { Story } from '../../entities/story'

export const BLOOD_FEUD: Story = {
    id: 'blood_feud',
    name: '宗门遗孤',
    characterName: '遗孤',
    desc: '幼年宗门遇劫，你被父亲心腹保护，躲在青山镇。',
    tags: [],
    comment:
        '报仇路线，却喜欢上仇人后代。一阶段Boss＝仇人后代。想夺魁请求会长解除两家恩怨。决赛打仇人后代，TA知道自己输了会被杀，最终死在主角手上。',
    getNodeOverride: (nodeIndex) => {
        if (nodeIndex === 2)
            return {
                flavorText:
                    '父亲的心腹问你："想报仇吗？"你点头。他拿出三件普通兵器，说这些都是他会的，让你挑一件，他教你。',
            }
        if (nodeIndex === 3)
            return {
                flavorText: '他把自己练的几招基础功夫一一使给你看，让你挑一式先学着。你年纪虽小，却练得格外拼命。',
            }
        return undefined
    },
}
