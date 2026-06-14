import { simpleGenerate } from '../../systems/character-gen'
import { type OpponentDef, passive, action, artifact } from '.'
import { getWeapon } from '../weapons'
import { DistanceSystem } from '../../combat/distance'
import type { ActionCommand } from '../../combat/types'

export const XUANJI: OpponentDef = {
    id: 'xuanji',
    name: '御物·玄机',
    generate: (n) =>
        simpleGenerate(
            'xuanji',
            '御物·玄机',
            'wise',
            'tri_orb',
            { strength: 6, vitality: 10, agility: 12, dexterity: 15, insight: 15, wisdom: 19 },
            [
                passive('spirit_resonance'),
                action('qi_bolt'),
                artifact('qi_guard'),
                artifact('iron_will'),
                artifact('ap_boost'),
            ],
            [
                { condition: { type: 'on_parry' }, actionId: 'restore_ap' },
                { condition: { type: 'on_dodge' }, actionId: 'summon_haste' },
                { condition: { type: 'on_hit' }, actionId: 'agility_steal' },
            ],
            n,
        ),
    planEvent: (self, state) => {
        const RESERVE = 2 // 留给乌铠
        const weapon = getWeapon(self.build.weapon)
        const cmds: ActionCommand[] = []
        const perAp = DistanceSystem.apToRange(self.attrs.get('agility'))
        const maxDist = weapon.range[1] // 6m

        // 选主招（消耗大的优先）
        const main = [...self.actions]
            .sort((a, b) => b.apCost - a.apCost)
            .find((a) => !a.def.bonus && a.canUse() && self.ap - RESERVE >= a.apCost)
        if (!main) return null

        let usedAp = 0
        const spend = (ap: number) => {
            usedAp += ap
            return usedAp
        }
        const remain = () => self.ap - RESERVE - usedAp

        // bonus（before_main）
        for (const inst of self.actions) {
            if (!inst.def.bonus || !inst.canUse()) continue
            if (inst.def.bonusTiming?.type !== 'before_main') continue
            if (remain() >= inst.apCost + main.apCost) {
                cmds.push({ type: 'bonus', actionId: inst.id })
                spend(inst.apCost)
            }
        }

        // 移动至武器最大射程（不超出）
        const currentDist = state.distance.current
        let virtualDist = currentDist
        if (virtualDist < maxDist && remain() > main.apCost) {
            const maxDelta = maxDist - virtualDist - 0.01 // 留余量不超出
            const moveAp = Math.min(Math.floor(maxDelta / perAp), remain() - main.apCost)
            if (moveAp > 0) {
                cmds.push({ type: 'move', bestDistance: moveAp })
                spend(moveAp)
                virtualDist += moveAp * perAp
            }
        }

        // 攻击
        cmds.push({ type: 'attack', actionId: main.id })
        spend(main.apCost)

        // 行动后移动：保持在武器射程内
        const postAp = remain()
        if (postAp > 0 && virtualDist < maxDist - 0.01) {
            const push = Math.min(Math.floor((maxDist - virtualDist - 0.01) / perAp), postAp)
            if (push > 0) cmds.push({ type: 'move', bestDistance: push })
        }

        return cmds
    },
}
