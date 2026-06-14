import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, action, artifact } from '.'
import { DistanceSystem } from '../../combat/distance'
import type { ActionCommand } from '../../combat/types'

export const SANGYUAN: OpponentDef = {
    id: 'sangyuan',
    name: '灵剑·桑原',
    generate: (n) =>
        simpleGenerate(
            'sangyuan',
            '灵剑·桑原',
            'strong',
            'bare_hands',
            { strength: 15, vitality: 18, agility: 8, dexterity: 18, insight: 12, wisdom: 5 },
            [
                artifact('qi_amplifier'),
                action('slash'),
                action('heavy_slash'),
                action('ciyuan_blade'),
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
                cmds.push({ type: 'move', bestDistance: -walkClose })
                cmds.push({ type: 'attack', actionId: 'big_leap' })
                if (!tryHeavy()) trySlash()
            } else if (self.ap >= walkClose + 2) {
                const walkMid = Math.ceil((dist - 3) / perAp)
                cmds.push({ type: 'move', bestDistance: -walkMid })
                trySlash()
            }
        } else if (dist >= 4 && leapDef && self.ap >= leapDef.apCost) {
            cmds.push({ type: 'attack', actionId: 'big_leap' })
            if (!tryHeavy()) trySlash()
        } else if (dist > 3) {
            const walkAP = Math.ceil((dist - 3) / perAp)
            if (self.ap < walkAP + 2) return cmds
            cmds.push({ type: 'move', bestDistance: -walkAP })
            if (!tryHeavy()) trySlash()
        } else if (dist < 1) {
            // 太近（被贴脸）：后退到武器范围再打
            const backAp = Math.ceil((1 - dist) / perAp)
            if (self.ap >= backAp + 2) {
                cmds.push({ type: 'move', bestDistance: backAp })
                const remain = self.ap - backAp
                if (heavyDef && remain >= heavyDef.apCost) {
                    cmds.push({ type: 'attack', actionId: 'heavy_slash' })
                } else if (remain >= (slashDef?.apCost ?? 2)) {
                    cmds.push({ type: 'attack', actionId: 'slash' })
                }
            } else if (self.ap >= backAp) {
                cmds.push({ type: 'move', bestDistance: backAp })
            } else if (self.ap >= 1) {
                cmds.push({ type: 'move', bestDistance: 1 })
            }
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
