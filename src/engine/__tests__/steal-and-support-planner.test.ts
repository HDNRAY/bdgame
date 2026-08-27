import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { planSupportActions } from '../ai/support-planner'
import type { BattleState } from '../combat/types'

function makeChar(id: string, name: string, rewards: { type: 'passive' | 'artifact' | 'action'; id: string }[]): Character {
    return new Character({
        id,
        name,
        weapon: 'po_lang_zhu_zhi',
        baseAttrs: { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 },
        rewards,
    })
}

/** 最小 state（support-planner 只用 pendingBuffs / characters / position） */
function makeState(chars: [Character, Character]): BattleState {
    return {
        pendingBuffs: new Map(),
        characters: chars,
        position: { distance: () => 4 },
        turn: { currentTime: 0 },
        log: { enterReaction: () => {}, exitReaction: () => {} },
        eventActorId: null,
        eventTime: 0,
        actionCount: 0,
        isEmitting: false,
        moveDelta: 0,
        triggeredThisChain: null,
    } as unknown as BattleState
}

describe('steal_artifact 移除奇物招式', () => {
    it('被偷方移除女儿红招式（_jiu_nv_er_hong），偷取方获得招式', () => {
        // 凤寻香（偷取方）带探云手；风似水（被偷方）带女儿红奇物
        const thief = makeChar('A', '偷取者', [{ type: 'action', id: 'steal_artifact' }])
        const victim = makeChar('B', '被偷者', [
            { type: 'artifact', id: 'nv_er_hong' },
            { type: 'action', id: '_jiu_nv_er_hong' },
        ])
        // 构造前:被偷方应有女儿红招式
        expect(victim.actions.some((a) => a.id === '_jiu_nv_er_hong')).toBe(true)
        expect(victim.artifactDefs.some((a) => a.id === 'nv_er_hong')).toBe(true)

        // 直接调用 steal 逻辑（模拟探云手得手）
        // 手动复刻 steal_artifact handler 的移除逻辑（不经引擎，验证 Character 方法本身）
        const target = victim.artifactDefs.find((a) => a.id === 'nv_er_hong')!
        victim.artifactDefs.splice(victim.artifactDefs.indexOf(target), 1)
        victim.removeActionsByIds(target.grantsActions ?? [])
        thief.addArtifact(target.id)

        // 被偷方:女儿红招式移除、奇物移除
        expect(victim.actions.some((a) => a.id === '_jiu_nv_er_hong')).toBe(false)
        expect(victim.artifactDefs.some((a) => a.id === 'nv_er_hong')).toBe(false)
        // 偷取方:获得奇物 + 招式
        expect(thief.artifactDefs.some((a) => a.id === 'nv_er_hong')).toBe(true)
        expect(thief.actions.some((a) => a.id === '_jiu_nv_er_hong')).toBe(true)
    })
})

describe('planSupportActions 跳过位移招', () => {
    it('魅影步（dash+自buff）不再被选为辅助招', () => {
        const self = makeChar('A', '甲', [{ type: 'action', id: 'swift_step' }])
        const enemy = makeChar('B', '乙', [])
        const cmds = planSupportActions(self, makeState([self, enemy]), 10, 'pre_action')
        expect(cmds.some((c) => c.actionId === 'swift_step')).toBe(false)
    })

    it('普通 buff 辅招仍被选中', () => {
        const self = makeChar('A', '甲', [{ type: 'action', id: '_jiu_nv_er_hong' }])
        const enemy = makeChar('B', '乙', [])
        const cmds = planSupportActions(self, makeState([self, enemy]), 10, 'pre_action')
        expect(cmds.some((c) => c.actionId === '_jiu_nv_er_hong')).toBe(true)
    })
})
