import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, artifact, action } from '.'
import { DistanceSystem } from '../../combat/distance'
import type { ActionCommand } from '../../combat/types'

const WEAPON_RANGE = 2

export const LUEYING: OpponentDef = {
    id: 'lueying',
    name: '掠影·无名',
    generate: (n) =>
        simpleGenerate(
            'lueying',
            '掠影·无名',
            'swift',
            'military_dagger',
            { strength: 6, vitality: 10, agility: 16, dexterity: 16, insight: 17, wisdom: 12 },
            [
                passive('ordinary_training'),
                artifact('poison_coating'),
                artifact('western_poison'),
                action('gash'),
                action('kick'),
                action('dart_throw'),
            ],
            [
                {
                    condition: { type: 'on_dodged' },
                    actionId: 'sand_throw',
                },
                { condition: { type: 'on_dodge' }, actionId: 'dart_throw' },
                { condition: { type: 'on_parry' }, actionId: 'kick' },
            ],
            n,
        ),
    planEvent: (self, state) => {
        const cmds: ActionCommand[] = []
        const dist = state.distance.current
        const slash = self.actions.find((a) => a.id === 'gash')
        const dart = self.actions.find((a) => a.id === 'dart_throw')
        const perAp = DistanceSystem.apToRange(self.attrs.get('agility'))

        // 远距离：能近身就打近战，否则飞镖
        if (dist > WEAPON_RANGE) {
            const moveAp = Math.ceil((dist - WEAPON_RANGE) / perAp)
            if (slash && self.ap >= moveAp + slash.apCost) {
                cmds.push({ type: 'move', bestDistance: -moveAp })
                cmds.push({ type: 'attack', actionId: 'gash' })
            } else if (dart && self.ap >= dart.apCost) {
                cmds.push({ type: 'attack', actionId: 'dart_throw' })
            }
            return cmds
        }

        // 近战：割伤
        if (slash && self.ap >= slash.apCost) {
            cmds.push({ type: 'attack', actionId: 'gash' })
        }
        return cmds
    },
}
