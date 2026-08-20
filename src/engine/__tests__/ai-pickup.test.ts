import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { planEvent } from '../ai'
import type { BattleState } from '../combat/types'
import { gen } from '../../data/opponents/index'
import { XIAOHUA, FANGLIE } from '../../data/opponents/index'

function makeChar(id: string, name: string, preset: unknown): Character {
    const build = gen(preset as never, 33)
    return new Character({ ...build, id, name })
}

describe('AI 拾起兵器同回合攻击', () => {
    it('掉落点在脚下且 AP 充足：拾起兵器与主招同一 planEvent 返回', () => {
        const self = makeChar('A', '方烈', FANGLIE)
        const enemy = makeChar('B', '小花', XIAOHUA)
        self.weaponDef = undefined // 缴械状态
        // 掉落点 = 自己脚下（position.get 需返回 4，dropPosition 同值）
        const state = {
            pendingBuffs: new Map([
                [`disarmed::A`, { restoreValue: 1, extra: { dropPosition: 4, originalWeapon: self.build.weapon } }],
            ]),
            position: { get: () => 4, distance: () => 4 },
            characters: [self, enemy],
        } as unknown as BattleState
        const cmds = planEvent(self, state)
        const types = cmds.map((c) => c.type)
        const supportIds = cmds.filter((c) => c.type === 'support').map((c) => c.actionId)
        // 同回合内同时包含拾起与攻击，且拾起在前
        expect(supportIds).toContain('pickup_weapon')
        expect(types).toContain('attack')
        const pickIdx = cmds.findIndex((c) => c.type === 'support' && c.actionId === 'pickup_weapon')
        const atkIdx = cmds.findIndex((c) => c.type === 'attack')
        expect(pickIdx).toBeGreaterThanOrEqual(0)
        expect(atkIdx).toBeGreaterThan(pickIdx)
    })
})
