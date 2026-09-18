import { describe, it, expect } from 'vitest'
import { ARTIFACTS } from '../artifacts'
import { PASSIVES } from '../passives/passives'
import { TALENTS } from '../passives/talents'
import { WEAPON_DB } from '../weapons/weapons'
import { STARTING_WEAPONS } from '../weapons/starting-weapons'
import { allMainActions } from '../actions'
import { getBuff } from '../buffs'
import { BUFF_DB } from '../buffs/buffs'
import { CONSTRUCT_TRIGGER, type EffectSlot } from '../../engine/entities/trigger'
import type { EffectDef } from '../../engine/entities/action'

/**
 * 数据审计：源的 `on_construct` 槽（构造期）只能写**构造期认**的效果类型。
 *
 * 为什么值得钉：`on_construct` 槽的 `apply` 走的是 `buildSourceLayer`，它**只认 `add_buff`**
 * （构造期贡献从 BuffDef 派生：attrMods / maxHpMod / triggerSlotMod / attrConvert / weaponTags /
 * buffDurationFn / statRestriction）；其他类型写在构造槽里就是死数据（不生效、也没人报错），
 * 靠肉眼很难发现。历史上玄机的构造期 `effects:[add_buff]` 就踩过这个坑。
 */
interface SourceLike {
    id: string
    effects?: EffectSlot[]
}

const SOURCES: { kind: string; list: SourceLike[] }[] = [
    { kind: '奇物', list: ARTIFACTS as SourceLike[] },
    { kind: '功法', list: PASSIVES as SourceLike[] },
    { kind: '天赋', list: TALENTS as SourceLike[] },
    { kind: '武器', list: [...WEAPON_DB, ...STARTING_WEAPONS] as unknown as SourceLike[] },
]

describe('数据审计：源构造期槽 / buffId', () => {
    it('on_construct 槽的 apply 只允许 add_buff（其余类型都是死数据）', () => {
        const dead: string[] = []
        for (const { kind, list } of SOURCES) {
            for (const s of list) {
                for (const slot of s.effects ?? []) {
                    if (slot.condition.type !== CONSTRUCT_TRIGGER) continue
                    for (const e of slot.apply ?? []) {
                        if (e.type !== 'add_buff') dead.push(`${kind}:${s.id} → ${e.type}`)
                    }
                }
            }
        }
        expect(dead).toEqual([])
    })

    it('所有 add_buff 的 buffId 都能解析（源自带槽 + 招式）', () => {
        const missing: string[] = []
        const check = (where: string, effects: EffectDef[] | undefined) => {
            for (const e of effects ?? []) {
                if (e.type === 'add_buff' && e.buffId && !getBuff(e.buffId)) missing.push(`${where} → ${e.buffId}`)
            }
        }
        for (const { kind, list } of SOURCES) {
            for (const s of list) {
                for (const slot of s.effects ?? []) check(`${kind}:${s.id}(${slot.condition.type})`, slot.apply)
            }
        }
        for (const a of allMainActions) check(`招式:${a.id}`, a.effects)
        expect(missing).toEqual([])
    })

    it('动态属性 buff 不声明 attrMods（贡献只写 description）', () => {
        // 判据：def 上任何一个函数钩子体内出现 `setLayerMods` —— 说明它的属性是运行期算出来的。
        // 这类 buff 再声明 attrMods 只会骗界面：tooltip 把它当静态加成念出来，而每 tick 写进去的
        // mods 是另一套数（秋水·盈虚 / 潮汐内力都踩过，见 docs/design-principles.md 第 2 条）。
        const offenders: string[] = []
        for (const def of BUFF_DB) {
            const dynamic = Object.values(def).some((v) => typeof v === 'function' && String(v).includes('setLayerMods'))
            if (dynamic && def.attrMods) offenders.push(`${def.id} → ${JSON.stringify(def.attrMods)}`)
        }
        expect(offenders).toEqual([])
    })
})
