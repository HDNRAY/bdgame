import { describe, it, expect } from 'vitest'
import { collectRewards } from '../entities/reward-collect'
import { buildConfigTriggers } from '../entities/trigger-slots'
import { buildActionCache } from '../entities/action-cache'
import { Character } from '../entities/character'
import type { CharacterBuild } from '../../game/entities/character-build'
import type { ActionDefinition } from '../entities/action'
import type { Reward } from '../../game/entities/reward'

const reward = (type: Reward['type'], id: string): Reward => ({ id, type, name: id, description: '', tags: [] })

function build(over: Partial<CharacterBuild> = {}): CharacterBuild {
    return {
        id: 't',
        name: '测试',
        story: '',
        weapon: 'bare_hands',
        battleStyle: 'clinch',
        baseAttrs: { strength: 10, vitality: 10, agility: 10, dexterity: 10, insight: 10, wisdom: 10 },
        rewards: [],
        actionConfigs: [],
        ...over,
    }
}

describe('构造期拆出来的纯函数', () => {
    it('collectRewards：按类型分类，天赋按原始属性解锁且不重复', () => {
        const r = collectRewards(build({ rewards: [reward('passive', 'forge'), reward('artifact', 'x'), reward('action', 'push_hand')] }))
        expect(r.passives).toContain('forge')
        expect(r.artifacts).toEqual(['x'])
        expect(r.actions).toEqual(['push_hand'])
        // 同一 id 出现两次直接抛（数据错误早暴露）
        expect(() => collectRewards(build({ rewards: [reward('passive', 'forge'), reward('passive', 'forge')] }))).toThrow(
            /重复功法/,
        )
    })

    it('buildConfigTriggers：把 triggerId 编译成触发槽，同一条触发条件用两次直接抛', () => {
        const slots = buildConfigTriggers(
            build({
                actionConfigs: [
                    { actionId: 'push_hand', triggerId: 'on_parry' },
                    { actionId: 'tui_zhang', triggerId: 'unknown_id' }, // 表里没有 → 跳过
                ],
            }),
        )
        expect(slots).toHaveLength(1)
        expect(slots[0].actionId).toBe('push_hand')
        expect(slots[0].condition.type).toBe('on_parry')

        expect(() =>
            buildConfigTriggers(
                build({
                    actionConfigs: [
                        { actionId: 'push_hand', triggerId: 'on_parry' },
                        { actionId: 'tui_zhang', triggerId: 'on_parry' },
                    ],
                }),
            ),
        ).toThrow(/重复触发条件/)
    })

    it('buildActionCache：补触发招、按列表顺序排序、自动补捡武器', () => {
        const enhance = (def: ActionDefinition): ActionDefinition => ({ ...def, name: `${def.name}·强` })
        const cache = buildActionCache(
            build({
                weapon: 'po_lang_zhu_zhi',
                actionConfigs: [{ actionId: 'push_hand' }],
            }),
            ['_generic_counter', 'push_hand'],
            [{ condition: { type: 'on_parry' }, actionId: '_generic_counter' }],
            enhance,
        )
        const ids = cache.map((a) => a.id)
        // actionConfigs 里只有 push_hand → 它排最前
        expect(ids[0]).toBe('push_hand')
        // 非空手非御物 → 自动补捡武器
        expect(ids).toContain('pickup_weapon')
        // 触发槽引用到的招式也要进缓存（供 maxUses 追踪）
        expect(ids).toContain('_generic_counter')
        // 强化生效
        expect(cache.find((a) => a.id === 'push_hand')!.def.name).toContain('·强')
        // 空手不给捡武器
        const bare = buildActionCache(build({ weapon: 'bare_hands' }), ['push_hand'], [], enhance)
        expect(bare.map((a) => a.id)).not.toContain('pickup_weapon')
    })

    it('Character 构造走的就是这几个函数（拆完行为不变）', () => {
        const c = new Character(build({ weapon: 'po_lang_zhu_zhi', actionConfigs: [{ actionId: 'push_hand', triggerId: 'on_parry' }] }))
        expect(c.actions.map((a) => a.id)[0]).toBe('push_hand')
        expect(c.actions.some((a) => a.id === 'pickup_weapon')).toBe(true)
        expect(c.triggers.some((t) => t.condition.type === 'on_parry')).toBe(true)
        // 触发槽上限 ≥ 1（WIS 10 → 2）
        expect(c.maxTriggerSlots).toBeGreaterThanOrEqual(1)
    })
})
