import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action } from '.'
import type { ActionCommand } from '../../combat/types'
import { DistanceSystem } from '../../combat/distance'

export const LIUXIGUA: OpponentDef = {
    id: 'liuxigua',
    name: '霸刀·西瓜',
    generate: (n) =>
        simpleGenerate(
            'liuxigua',
            '霸刀·西瓜',
            'strong',
            'overlord_blade',
            { strength: 14, vitality: 10, agility: 20, dexterity: 18, insight: 16, wisdom: 4 },
            [
                passive('momentum_mastery'),
                action('spinning_slash'),
                action('cyclone_slash'),
                action('little_fist'),
                action('sky_burner'),
                action('retrieve_blade'),
                action('shadow_kick'),
            ],
            [],
            n,
        ),
    planEvent: (self, state) => {
        const cmds: ActionCommand[] = []
        const dist = state.distance.current
        const hasBlade = state.pendingBuffs.has('overlord_blade::' + self.id)
        const momentum = state.pendingBuffs.get('momentum::' + self.id)?.restoreValue ?? 0
        // 实际每 AP 位移距离（与引擎 calcMovement 一致）
        const basePerAp = DistanceSystem.apToRange(self.attrs.get('agility'))
        const minMoveCost = state.pendingBuffs.has(`min_move_cost::${self.id}`)
        const effectivePerAp = minMoveCost ? 2 : basePerAp * (1 + (self.moveEfficiency ?? 0))
        const W_RANGE: [number, number] = [1, 3] // 霸刀武器范围

        const slash = self.actions.find((a) => a.id === 'spinning_slash')
        const cyclone = self.actions.find((a) => a.id === 'cyclone_slash')
        const sky = self.actions.find((a) => a.id === 'sky_burner')
        const fist = self.actions.find((a) => a.id === 'little_fist')
        const kick = self.actions.find((a) => a.id === 'shadow_kick')
        const retrieve = self.actions.find((a) => a.id === 'retrieve_blade')

        /** 选一个费用不超过 remainAP 的最佳技能 */
        function pickBestAttack(remainAP: number): string | null {
            if (cyclone && remainAP >= cyclone.apCost && dist <= 5) return 'cyclone_slash'
            if (slash && remainAP >= slash.apCost) return 'spinning_slash'
            return null
        }

        if (hasBlade) {
            // 燎天势：远距离脱手
            if (momentum >= 3 && sky && self.ap >= sky.apCost && dist > 5) {
                cmds.push({ type: 'attack', actionId: 'sky_burner' })
                return cmds
            }

            // 在武器范围内：直接攻击
            if (dist >= W_RANGE[0] && dist <= W_RANGE[1]) {
                const atk = pickBestAttack(self.ap)
                if (atk) cmds.push({ type: 'attack', actionId: atk })
                return cmds
            }

            // 太远：走位进范围 → 攻击
            if (dist > W_RANGE[1]) {
                const ideal = W_RANGE[1] - 0.5 // 走到 2.5，给 short_dash 留空间
                const needUnits = dist - ideal
                const moveAp = Math.ceil(needUnits / effectivePerAp)
                if (self.ap >= moveAp + 2) {
                    cmds.push({ type: 'move', bestDistance: -moveAp })
                    const remain = self.ap - moveAp
                    const atk = pickBestAttack(remain)
                    if (atk) cmds.push({ type: 'attack', actionId: atk })
                } else if (self.ap >= moveAp) {
                    cmds.push({ type: 'move', bestDistance: -moveAp })
                } else if (self.ap >= 1) {
                    const partialAp = Math.floor(self.ap)
                    cmds.push({ type: 'move', bestDistance: -partialAp })
                }
                return cmds
            }

            // 太近（<1）：后退拉开
            if (dist < W_RANGE[0]) {
                const backUnits = W_RANGE[0] - dist
                const backAp = Math.ceil(backUnits / effectivePerAp)
                if (self.ap >= backAp + 2) {
                    cmds.push({ type: 'move', bestDistance: backAp })
                    const atk = pickBestAttack(self.ap - backAp)
                    if (atk) cmds.push({ type: 'attack', actionId: atk })
                } else if (self.ap >= backAp) {
                    cmds.push({ type: 'move', bestDistance: backAp })
                } else if (self.ap >= 1) {
                    cmds.push({ type: 'move', bestDistance: 1 })
                }
                return cmds
            }

            return cmds
        }

        // ── 空手态（无霸刀） ──
        // 先取回霸刀
        if (retrieve && self.ap >= retrieve.apCost) {
            cmds.push({ type: 'attack', actionId: 'retrieve_blade' })
            return cmds
        }

        // 无影脚突进
        if (kick && self.ap >= kick.apCost && dist > 1 && dist <= 6) {
            cmds.push({ type: 'attack', actionId: 'shadow_kick' })
            return cmds
        }

        // 在拳范围 [0,2] 内
        if (dist <= 2) {
            if (fist && self.ap >= fist.apCost) {
                cmds.push({ type: 'attack', actionId: 'little_fist' })
                return cmds
            }
        }

        // 太远 → 走位进范围
        if (dist > 2) {
            const moveAp = Math.ceil((dist - 1) / effectivePerAp)
            if (self.ap >= moveAp + 1) {
                cmds.push({ type: 'move', bestDistance: -moveAp })
                if (fist && self.ap - moveAp >= fist.apCost) {
                    cmds.push({ type: 'attack', actionId: 'little_fist' })
                }
            } else if (self.ap >= 1) {
                cmds.push({ type: 'move', bestDistance: -Math.floor(self.ap) })
            }
            return cmds
        }

        return cmds
    },
}
