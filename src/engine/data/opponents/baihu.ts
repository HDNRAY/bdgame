import { type OpponentDef, simpleGenerate, passive, action, artifact } from './base'
import type { ActionCommand } from '../../combat/types'

const WEAPON_RANGE = 3

export const BAIHU: OpponentDef = {
    id: 'b1',
    name: '白狐儿脸',
    generate: (n) =>
        simpleGenerate(
            'b1',
            '白狐儿脸',
            'swift',
            'frost_twin_blades',
            { strength: 16, vitality: 10, agility: 16, dexterity: 16, insight: 14, wisdom: 6 },
            [
                passive('ice_heart'),
                passive('frost_mastery'),
                artifact('frost_silk_robe'),
                action('frost_step'),
                action('guard'),
                action('slash'),
                action('heavy_slash'),
            ],
            [],
            n,
        ),
    planEvent: (self, state) => {
        const cmds: ActionCommand[] = []
        const dist = state.distance.current
        const enemy = state.characters.find((c) => c.id !== self.id)
        if (!enemy) return cmds

        const perAp = Math.max(0.5, self.attrs.get('agility') / 20)
        const slash = self.actions.find((a) => a.id === 'slash')
        const heavySlash = self.actions.find((a) => a.id === 'heavy_slash')
        const guardAction = self.actions.find((a) => a.id === 'guard')

        /** 选当前AP下最优的主攻招式 */
        const pickAttack = (ap: number): string | undefined => {
            if (heavySlash && ap >= heavySlash.apCost) return 'heavy_slash'
            if (slash && ap >= slash.apCost) return 'slash'
            return undefined
        }

        // ── 距离太远 ──
        if (dist > WEAPON_RANGE) {
            const moveAp = Math.min(self.ap, Math.ceil((dist - WEAPON_RANGE) / perAp))
            cmds.push({ type: 'move', bestDistance: -moveAp })
            const afterMove = self.ap - moveAp
            if (pickAttack(afterMove)) {
                cmds.push({ type: 'attack', actionId: pickAttack(afterMove)! })
            } else if (afterMove >= 2 && guardAction?.canUse()) {
                cmds.push({ type: 'attack', actionId: 'guard' })
            }
            return cmds
        }

        // ── 近距离 ──
        // 贴脸（<武器最小射程1）→ 先拉开
        if (dist < 1) {
            const backAp = Math.ceil((1 - dist) / perAp)
            if (self.ap >= backAp + 2) {
                cmds.push({ type: 'move', bestDistance: backAp })
                const remain = self.ap - backAp
                const atk = pickAttack(remain)
                if (atk) cmds.push({ type: 'attack', actionId: atk })
            } else if (backAp <= self.ap) {
                cmds.push({ type: 'move', bestDistance: backAp })
            } else if (guardAction?.canUse()) {
                cmds.push({ type: 'attack', actionId: 'guard' })
            } else {
                cmds.push({ type: 'attack', actionId: 'slash' })
            }
            return cmds
        }

        // 正常近战：优先蓄力斩，其次斩击
        const atk = pickAttack(self.ap)
        if (atk) cmds.push({ type: 'attack', actionId: atk })
        // 左右互搏：剩余AP可再打一次
        if (state.pendingBuffs.has(`zuoyou_hubo::${self.id}`)) {
            const used = self.actions.find((a) => a.id === atk)?.apCost ?? 0
            const remain = self.ap - used
            if (remain >= 2) {
                const second = pickAttack(remain)
                if (second) cmds.push({ type: 'attack', actionId: second })
            }
        }
        return cmds
    },
}
