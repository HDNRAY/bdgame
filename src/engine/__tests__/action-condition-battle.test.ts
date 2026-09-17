import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { planEvent } from '../ai'
import { PositionSystem } from '../combat/position'
import { BattleLog } from '../combat/battle-log'
import { TurnManager } from '../combat/turn'
import { BuffRegistry } from '../combat/utils/buff-registry'
import { BattleState } from '../combat/battle-state'
import type { ActionCommand, BattleState as BattleStateType } from '../combat/types'
import type { ActionConfig } from '../../game/entities/action-config'
import type { CharacterBuild } from '../../game/entities/character-build'

/** 空手（unarmed）角色 + 指定招式奖励：不引入功法/奇物/武器自带的触发，隔离"主动出招"这一条路径 */
function makeBuild(actionIds: string[], actionConfigs?: ActionConfig[]): CharacterBuild {
    return {
        id: 'player',
        name: '试招',
        story: 'balanced',
        weapon: 'bare_hands',
        battleStyle: 'clinch',
        baseAttrs: { strength: 12, vitality: 12, agility: 12, dexterity: 12, insight: 12, wisdom: 12 },
        rewards: actionIds.map((id) => ({ id, type: 'action' as const, name: id, description: '', tags: [] })),
        actionConfigs,
    }
}

function makeState(actionIds: string[], actionConfigs: ActionConfig[] | undefined, dist: number) {
    const self = new Character(makeBuild(actionIds, actionConfigs))
    const enemy = new Character({ ...makeBuild([]), id: 'enemy', name: '对手' })
    const st: BattleStateType = new BattleState()
    st.phase = 'fighting'
    st.characters = [self, enemy] as [Character, Character]
    st.position = new PositionSystem(self.id, 0, enemy.id, dist)
    st.turn = new TurnManager()
    st.log = new BattleLog()
    st.eventActorId = null
    st.eventTime = 0
    st.pendingBuffs = new BuffRegistry()
    st.actionCount = 0
    st.isEmitting = false
    st.moveDelta = 0
    st.triggeredThisChain = null
    return { self, state: st }
}

/** 计划里实际要出手的招式 id */
function plannedAttacks(cmds: ActionCommand[]): string[] {
    return cmds.filter((c) => c.type === 'attack' && c.actionId).map((c) => c.actionId!)
}

const ACTIONS = ['liu_yang_zhang', 'thunder_storm']

describe('出招条件在 AI 计划里生效', () => {
    it('对照：不设条件时会出招', () => {
        const { self, state } = makeState(ACTIONS, undefined, 1)
        expect(plannedAttacks(planEvent(self, state))).toContain('liu_yang_zhang')
    })

    it('结构化条件恒不成立 → 一个 attack 都不排', () => {
        const { self, state } = makeState(
            ACTIONS,
            ACTIONS.map((actionId) => ({ actionId, condition: { type: 'time_above' as const, seconds: 99999 } })),
            1,
        )
        expect(plannedAttacks(planEvent(self, state))).toEqual([])
    })

    it('结构化条件成立时不拦（距离区间）', () => {
        const { self, state } = makeState(
            ACTIONS,
            ACTIONS.map((actionId) => ({ actionId, condition: { type: 'distance_between' as const, min: 0, max: 2 } })),
            1,
        )
        expect(plannedAttacks(planEvent(self, state))).toContain('liu_yang_zhang')
    })

})

describe('出招优先级（ActionConfig.priority）', () => {
    it('未设优先级 → 按效率比择优（对手数据就是这个状态，别改）', () => {
        // 电力溜溜球效率比高于六阳掌，两者都 2AP、都能打
        const { self, state } = makeState(['liu_yang_zhang', 'electric_yoyo'], undefined, 1)
        expect(plannedAttacks(planEvent(self, state))).toEqual(['electric_yoyo'])
    })

    it('设了优先级 → 靠前的先出，哪怕效率比更低', () => {
        const { self, state } = makeState(
            ['liu_yang_zhang', 'electric_yoyo'],
            [
                { actionId: 'liu_yang_zhang', priority: 1 },
                { actionId: 'electric_yoyo', priority: 2 },
            ],
            1,
        )
        expect(plannedAttacks(planEvent(self, state))).toEqual(['liu_yang_zhang'])
    })

    it('调换优先级则换成另一招', () => {
        const { self, state } = makeState(
            ['liu_yang_zhang', 'electric_yoyo'],
            [
                { actionId: 'electric_yoyo', priority: 1 },
                { actionId: 'liu_yang_zhang', priority: 2 },
            ],
            1,
        )
        expect(plannedAttacks(planEvent(self, state))).toEqual(['electric_yoyo'])
    })

    it('优先级不越过条件闸门：被挡住就落到下一招', () => {
        const { self, state } = makeState(
            ['liu_yang_zhang', 'electric_yoyo'],
            [
                { actionId: 'electric_yoyo', priority: 1, condition: { type: 'time_above', seconds: 99999 } },
                { actionId: 'liu_yang_zhang', priority: 2 },
            ],
            1,
        )
        expect(plannedAttacks(planEvent(self, state))).toEqual(['liu_yang_zhang'])
    })

    it('优先级不越过缠劲门槛：缠劲不够就落到下一招', () => {
        const { self, state } = makeState(
            ['thunder_storm', 'liu_yang_zhang'],
            [
                { actionId: 'thunder_storm', priority: 1 },
                { actionId: 'liu_yang_zhang', priority: 2 },
            ],
            1,
        )
        expect(plannedAttacks(planEvent(self, state))).toEqual(['liu_yang_zhang'])
    })
})
