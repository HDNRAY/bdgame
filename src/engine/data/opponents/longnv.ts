import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'

export const LONGNV: OpponentDef = {
    id: 'longnv',
    name: '龙女·语嫣',
    generate: (n) =>
        simpleGenerate(
            'longnv',
            '龙女·语嫣',
            'swift',
            'dual_swords',
            { strength: 15, vitality: 10, agility: 13, dexterity: 18, insight: 14, wisdom: 4 },
            [
                passive('dark_room_catch'),
                artifact('golden_silk_gloves'),
                artifact('herb_pouch'),
                action('quanzhen_sword'),
                action('yunv_sword'),
                action('yufeng_needle'),
                action('yuxin_sword'),
            ],
            [],
            n,
        ),
    aiOverrides: {
        actionPriority: (_candidates, self) => {
            const weights: Record<string, number> = {}
            // 素心剑法条件满足时加分
            if (self.attrs.get('strength') >= 18 && self.attrs.get('agility') >= 18) {
                weights.yuxin_sword = 20
            }
            // 力道低推荐全真，身法低推荐玉女——自然平衡
            const str = self.attrs.get('strength')
            const agi = self.attrs.get('agility')
            if (str < agi) {
                weights.quanzhen_sword = 8
            } else if (agi < str) {
                weights.yunv_sword = 8
            }
            return weights
        },
    },
}
