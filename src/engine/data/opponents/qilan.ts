import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'

export const QILAN: OpponentDef = {
    id: 'qilan',
    name: '雷法·奇岚',
    generate: (n) =>
        simpleGenerate(
            'qilan',
            '雷法·奇岚',
            'swift',
            'bare_hands',
            { strength: 12, vitality: 10, agility: 14, dexterity: 14, insight: 13, wisdom: 15 },
            [
                passive('godspeed'),
                passive('thunder_art'),
                passive('zoldyck_art'),
                passive('qiti_source'),
                artifact('cinnabar_mole'),
                action('electric_yoyo'),
                action('palm_strike'),
                action('lightning_speed'),
                action('thunder_storm'),
            ],
            [],
            n,
        ),
    aiOverrides: {
        actionPriority: (candidates, self, state) => {
            const enemy = state.characters.find((c) => c.id !== self.id)
            const recentStun = enemy && state.pendingBuffs.has(`stun_track::${enemy.id}`)
            if (recentStun) return ['palm_strike', 'electric_yoyo', 'thunder_storm']
            return ['thunder_storm', 'palm_strike', 'electric_yoyo']
        },
    },
}
