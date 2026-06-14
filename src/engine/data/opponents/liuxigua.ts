import { type OpponentDef, passive, action } from './base'
import type { CharacterBuild } from '../../entities/character-build'
import { getBackground } from '../backgrounds'
import { cultCost } from '../../systems/cultivation'
import { STAT_NAMES } from '../rewards'
import type { ActionCommand } from '../../combat/types'
import { DistanceSystem } from '../../combat/distance'

export const LIUXIGUA: OpponentDef = {
    id: 'd2',
    name: '霸刀·西瓜',
    generate: (n) => {
        const bg = getBackground('strong')!
        const bgAttrs: Record<string, number> = {}
        for (const a of STAT_NAMES) bgAttrs[a] = bg.attrs[a] ?? 3

        const cultPoints = n * 2
        const target: Record<string, number> = {
            strength: 14,
            vitality: 10,
            agility: 20,
            dexterity: 18,
            insight: 16,
            wisdom: 4,
        }
        // 强制优先级（DEX 优先于 INS，保证命中够）
        const prio: string[] = ['agility', 'strength', 'dexterity', 'vitality', 'insight', 'wisdom']

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
            id: 'd2',
            name: '霸刀·西瓜',
            background: 'strong',
            weapon: 'overlord_blade',
            baseAttrs: result,
            rewards: [
                passive('momentum_mastery'),
                passive('ling_bo_wei_bu'),
                action('spinning_slash'),
                action('cyclone_slash'),
                action('sky_burner'),
                action('little_fist'),
                action('shadow_kick'),
                action('retrieve_blade'),
            ],
            triggers: [],
        }
        return build
    },
    planEvent: (self, state) => {
        const cmds: ActionCommand[] = []
        const dist = state.distance.current
        const hasBlade = state.pendingBuffs.has('overlord_blade::' + self.id)
        const momentum = state.pendingBuffs.get('momentum::' + self.id)?.restoreValue ?? 0
        const perAp = DistanceSystem.apToRange(self.attrs.get('agility'))

        const slash = self.actions.find((a) => a.id === 'spinning_slash')
        const cyclone = self.actions.find((a) => a.id === 'cyclone_slash')
        const sky = self.actions.find((a) => a.id === 'sky_burner')
        const fist = self.actions.find((a) => a.id === 'little_fist')
        const kick = self.actions.find((a) => a.id === 'shadow_kick')

        if (hasBlade) {
            // 燎天势：敌人超出武器范围（3）+ 2m 以上才扔，否则继续近战
            if (momentum >= 3 && sky && self.ap >= sky.apCost && dist > 5) {
                cmds.push({ type: 'attack', actionId: 'sky_burner' })
                return cmds
            }

            // 旋风斩（范围 1~5）
            if (cyclone && self.ap >= cyclone.apCost && dist <= 5) {
                cmds.push({ type: 'attack', actionId: 'cyclone_slash' })
                return cmds
            }

            // 旋斩（范围 1~4）
            if (slash && self.ap >= slash.apCost && dist <= 4) {
                cmds.push({ type: 'attack', actionId: 'spinning_slash' })
                return cmds
            }

            // 太近或太远：走位到攻击范围
            const ideal = Math.max(1, Math.min(3, dist))
            if (Math.abs(dist - ideal) > 0.5 && self.ap >= 1) {
                const moveAp = Math.ceil(Math.abs(dist - ideal) / perAp)
                cmds.push({ type: 'move', bestDistance: dist > ideal ? -moveAp : moveAp })
                return cmds
            }
        } else {
            // 空手态：技能全在冷却或缴械未过期时等待即可（过期自动归还武器）
            // 无影脚突进
            if (kick && self.ap >= kick.apCost && dist > 1) {
                cmds.push({ type: 'attack', actionId: 'shadow_kick' })
                return cmds
            }

            // 小拳拳（赤手空拳范围 0~2）
            if (fist && self.ap >= fist.apCost && dist <= 2) {
                cmds.push({ type: 'attack', actionId: 'little_fist' })
                return cmds
            }

            // 太远（>2）且没 kick → 往前走
            if (dist > 2 && self.ap >= 1) {
                const moveAp = Math.min(self.ap, Math.ceil((dist - 1) / perAp))
                cmds.push({ type: 'move', bestDistance: -moveAp })
                return cmds
            }
        }

        return cmds
    },
}
