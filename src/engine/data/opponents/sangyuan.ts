import { type OpponentDef, simpleGenerate, passive, action, artifact } from './base'
import { DistanceSystem } from '../../combat/distance'
import type { ActionCommand } from '../../combat/types'

export const SANGYUAN: OpponentDef = {
    id: 's1',
    name: '断刃·桑原',
    generate: (n) =>
        simpleGenerate(
            's1',
            '断刃·桑原',
            'strong',
            'bare_hands',
            { strength: 15, vitality: 18, agility: 8, dexterity: 18, insight: 12, wisdom: 5 },
            [
                passive('ciyuan_ren'),
                passive('zuoyou_hubo'),
                passive('vitality_regen'),
                artifact('qi_amplifier'),
                action('slash'),
                action('heavy_slash'),
                action('big_leap'),
            ],
            [],
            n,
        ),
    planEvent: (self, state) => {
        const perAp = DistanceSystem.apToRange(self.attrs.get('agility'))
        const dist = state.distance.current
        const cmds: ActionCommand[] = []

        const slashDef = self.actions.find((a) => a.id === 'slash')?.def
        const heavyDef = self.actions.find((a) => a.id === 'heavy_slash')?.def
        const leapDef = self.actions.find((a) => a.id === 'big_leap')?.def

        const tryHeavy = () => {
            if (!heavyDef || self.ap < heavyDef.apCost) return false
            cmds.push({ type: 'attack', actionId: 'heavy_slash' })
            return true
        }
        const trySlash = () => {
            if (!slashDef || self.ap < slashDef.apCost) return false
            cmds.push({ type: 'attack', actionId: 'slash' })
            return true
        }

        if (dist > 8) {
            const walkClose = Math.ceil((dist - 8) / perAp)
            const leapCost = leapDef?.apCost ?? 3
            if (self.ap >= walkClose + leapCost) {
                cmds.push({ type: 'move', bestDistance: -(dist - 8) })
                cmds.push({ type: 'attack', actionId: 'big_leap' })
                if (!tryHeavy()) trySlash()
            } else if (self.ap >= walkClose + 2) {
                cmds.push({ type: 'move', bestDistance: -(dist - 3) })
                trySlash()
            }
        } else if (dist >= 4 && leapDef && self.ap >= leapDef.apCost) {
            cmds.push({ type: 'attack', actionId: 'big_leap' })
            if (!tryHeavy()) trySlash()
        } else if (dist > 3) {
            const walkAP = Math.ceil((dist - 3) / perAp)
            if (self.ap < walkAP + 2) return cmds
            cmds.push({ type: 'move', bestDistance: -(dist - 3) })
            if (!tryHeavy()) trySlash()
        } else {
            if (!tryHeavy()) trySlash()
        }
        // 左右互搏：剩余 AP 再打一次
        if (state.pendingBuffs.has(`zuoyou_hubo::${self.id}`)) {
            const apUsed = cmds.reduce((sum, c) => {
                if (c.type === 'attack') {
                    const def = self.actions.find((a) => a.id === c.actionId)?.def
                    return sum + (def?.apCost ?? 0)
                }
                return sum
            }, 0)
            const remaining = self.ap - apUsed
            if (remaining >= 2) {
                if (heavyDef && remaining >= heavyDef.apCost) {
                    cmds.push({ type: 'attack', actionId: 'heavy_slash' })
                } else if (slashDef && remaining >= slashDef.apCost) {
                    cmds.push({ type: 'attack', actionId: 'slash' })
                }
            }
        }
        return cmds
    },
}
