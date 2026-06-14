import { type OpponentDef, passive, action, artifact } from './base'
import type { CharacterBuild } from '../../entities/character-build'
import { getBackground } from '../backgrounds'
import { cultCost } from '../../systems/cultivation'
import { STAT_NAMES } from '../rewards'

export const LUHONGTI: OpponentDef = {
    id: 'd3',
    name: '河山铁剑·陆红提',
    generate: (n) => {
        const bg = getBackground('strong')!
        const bgAttrs: Record<string, number> = {}
        for (const a of STAT_NAMES) bgAttrs[a] = bg.attrs[a] ?? 3

        const cultPoints = n * 2 - 2
        const target: Record<string, number> = {
            strength: 9,
            vitality: 8,
            agility: 9,
            dexterity: 9,
            insight: 16,
            wisdom: 20,
        }
        const prio: string[] = ['wisdom', 'insight', 'agility', 'dexterity', 'strength', 'vitality']

        const result = { ...bgAttrs }
        let remaining = cultPoints
        while (remaining > 0) {
            let improved = false
            for (const attr of prio) {
                if (result[attr] >= (target[attr] ?? 99)) continue
                const cost = cultCost(result[attr])
                if (remaining >= cost) {
                    result[attr]++
                    remaining -= cost
                    improved = true
                    break
                }
            }
            if (!improved) break
        }

        const build: CharacterBuild = {
            id: 'd3',
            name: '河山铁剑·陆红提',
            background: 'strong',
            weapon: 'heshan_sword',
            baseAttrs: result,
            rewards: [
                passive('inner_power'),
                artifact('other_mountain'),
                passive('tai_chi_mastery'),
                action('push_palm'),
                action('sword_thrust'),
                action('crushing_blow'),
            ],
            triggers: [
                { condition: { type: 'on_dodge' }, actionId: 'wrist_strike' },
                { condition: { type: 'on_dodged' }, actionId: 'slash' },
                { condition: { type: 'on_opponent_move' }, actionId: 'qi_bolt' },
                { condition: { type: 'on_debuff' }, actionId: 'break_formation' },
            ],
        }
        return build
    },
}
