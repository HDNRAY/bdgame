import { type OpponentDef, simpleGenerate, passive, action } from './base'
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
        const hasHubo = state.pendingBuffs.has('zuoyou_hubo::' + self.id)
        const cmds: ActionCommand[] = []

        const slashDef = self.actions.find((a) => a.id === 'slash')?.def
        const heavyDef = self.actions.find((a) => a.id === 'heavy_slash')?.def
        const leapDef = self.actions.find((a) => a.id === 'big_leap')?.def
        const canDouble = hasHubo && !!slashDef

        const tryDoubleSlash = () => {
            if (!canDouble || !slashDef || self.ap < slashDef.apCost * 2) return false
            cmds.push({ type: 'attack', actionId: 'slash' })
            cmds.push({ type: 'attack', actionId: 'slash' })
            return true
        }
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
            // 太远：走 + 大跳，剩余AP再放技能
            const walkClose = Math.ceil((dist - 8) / perAp)
            const leapCost = leapDef?.apCost ?? 3
            if (self.ap >= walkClose + leapCost) {
                cmds.push({ type: 'move', bestDistance: -(dist - 8) })
                cmds.push({ type: 'attack', actionId: 'big_leap' })
                if (!tryDoubleSlash() && !tryHeavy()) trySlash()
            } else if (self.ap >= walkClose + 2) {
                cmds.push({ type: 'move', bestDistance: -(dist - 3) })
                trySlash()
            }
        } else if (dist >= 4 && leapDef && self.ap >= leapDef.apCost) {
            // 大跳
            cmds.push({ type: 'attack', actionId: 'big_leap' })
            if (!tryDoubleSlash() && !tryHeavy()) trySlash()
        } else if (dist > 3) {
            // 走过去
            const walkAP = Math.ceil((dist - 3) / perAp)
            if (self.ap < walkAP + 2) return cmds
            cmds.push({ type: 'move', bestDistance: -(dist - 3) })
            if (!tryDoubleSlash() && !tryHeavy()) trySlash()
        } else {
            // 已进入范围
            if (!tryDoubleSlash() && !tryHeavy()) trySlash()
        }
        return cmds
    },
}
