import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { applyBuffLayer } from '../combat/utils/buff-apply'
import { getBuff } from '../../data/buffs'
import type { BuffDef } from '../../data/buffs'
import { ALL_ATTRS } from '../entities/attributes'
import type { CharacterBuild } from '../../game/entities/character-build'

/**
 * 附着 buff：源顶层 `effects:[{type:'add_buff'}]` = 这条来源自带的 buff。
 *
 * - 属性（`attrMods × stacks`）在**构造期**就折进来源层账 → 无 engine 的 `new Character(build)`
 *   也读得到（构筑面板/触发槽/血量/武器门槛都靠它）
 * - 开局/换装/被偷到手时**物化**成战斗层（只承载 hooks，`attrsInLedger` 标它不参与属性回放）
 * - 撤源时按 `originId` 整批删层 + 撤账，属性精确回原值
 */
function makeChar(id: string): Character {
    const build: CharacterBuild = {
        id,
        name: id,
        weapon: 'bare_hands',
        battleStyle: 'clinch',
        baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, 10])) as CharacterBuild['baseAttrs'],
        rewards: [],
    }
    return new Character(build)
}

// 纯属性携带者（无钩子）——不再建层，只进账
const ATTR_ONLY = { type: 'add_buff' as const, buffId: 'titanium_arm_attr' }
// 带钩子的附着 buff（菩提静心：onReceiveDebuff）——需要运行时实例
const WITH_HOOKS = { type: 'add_buff' as const, buffId: 'pu_ti_zhu_buff' }

describe('附着 buff', () => {
    it('构造期就生效：没有 engine 的 Character 也把 attrMods 算进属性', () => {
        const mods = getBuff('titanium_arm_attr')!.attrMods!
        const c = makeChar('A')
        const before = c.attrs.getAll()
        c.addSource('artifact:titanium_arm', 'artifact', [ATTR_ONLY])
        for (const [attr, v] of Object.entries(mods)) {
            expect(c.attrs.get(attr as keyof typeof before)).toBe(before[attr as keyof typeof before] + v)
        }
        // 属性照旧在账上；附着表**记录全部**（供展示），物化时再按 needsRuntimeLayer 过滤（不建空壳层）
        const layer = c.sourceLayers.find((l) => l.sourceId === 'artifact:titanium_arm')!
        expect(layer.attachedBuffs).toEqual([{ buffId: 'titanium_arm_attr', stacks: 1 }])
        expect(layer.mods.insight ?? 0).toBe(0) // 钛合金臂：力道/灵巧
        expect(layer.mods.strength).toBe(mods.strength)
    })

    it('带钩子的附着 buff 才物化成战斗层：originId 指回来源，属性不二次应用', () => {
        const c = makeChar('A')
        c.addSource('artifact:pu_ti_zhu', 'artifact', [WITH_HOOKS])
        const inLedger = c.attrs.getAll()

        const engine = new BattleEngine(c, makeChar('B'), 4)
        const keys = engine.state.pendingBuffs.keysOfOrigin('artifact:pu_ti_zhu')
        expect(keys).toHaveLength(1)
        const layer = engine.state.pendingBuffs.get(keys[0])!
        expect(layer.attrsInLedger).toBe(true)
        expect(layer.mods ?? {}).toEqual({}) // 属性归账，物化层不带属性
        expect(c.attrs.getAll()).toEqual(inLedger) // 没有二次加成
    })

    it('纯属性附着 buff 不建层（没有空壳层），但会补进展示列表', () => {
        const c = makeChar('A')
        c.addSource('artifact:titanium_arm', 'artifact', [ATTR_ONLY])
        const engine = new BattleEngine(c, makeChar('B'), 4)
        expect(engine.state.pendingBuffs.keysOfOrigin('artifact:titanium_arm')).toHaveLength(0)
        // 实例口径：没有真实层 → getBuffs 不含它（AI/触发按 pendingBuffs 探测的口径不变）
        expect(engine.getBuffs(c.id).some((b) => b.buffId === 'titanium_arm_attr')).toBe(false)
        // 展示口径：从账上补进列表，属性照旧算对
        const shown = engine.getBuffsForDisplay(c.id).find((b) => b.buffId === 'titanium_arm_attr')
        expect(shown).toEqual({ buffId: 'titanium_arm_attr', name: '钛合金臂', stacks: 1 })
        expect(engine.state.pendingBuffs.has(`titanium_arm_attr::${c.id}`)).toBe(false)
        const layer = c.sourceLayers.find((l) => l.sourceId === 'artifact:titanium_arm')!
        expect(layer.applied.strength).toBe(2)
    })

    it('撤源：按 originId 删层 + 撤账，属性精确回原值', () => {
        const c = makeChar('A')
        const naked = c.attrs.getAll()
        c.addSource('artifact:pu_ti_zhu', 'artifact', [WITH_HOOKS])
        const engine = new BattleEngine(c, makeChar('B'), 4)
        expect(c.attrs.getAll()).not.toEqual(naked)

        expect(c.removeSource('artifact:pu_ti_zhu', engine.state)).toBe(true)
        expect(c.attrs.getAll()).toEqual(naked)
        expect(engine.state.pendingBuffs.keysOfOrigin('artifact:pu_ti_zhu')).toHaveLength(0)
    })

    it('onActivate：物化成战斗层时触发一次（attrMods 表达不了的生效时刻行为）', () => {
        const c = makeChar('A')
        const engine = new BattleEngine(c, makeChar('B'), 4)
        let fired = 0
        const probe: BuffDef = {
            id: 'probe_activate',
            name: '探针',
            description: '',
            tags: [],
            expiry: { type: 'permanent' },
            onActivate: () => {
                fired++
            },
        }
        applyBuffLayer(engine, {
            buff: probe,
            target: c,
            stacks: 1,
            tMs: 0,
            originId: 'test:src',
            skipAttrMods: true,
        })
        expect(fired).toBe(1)
        expect(engine.state.pendingBuffs.keysOfOrigin('test:src')).toHaveLength(1)
    })
})
