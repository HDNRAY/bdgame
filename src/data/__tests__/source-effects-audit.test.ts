import { describe, it, expect } from 'vitest'
import { ARTIFACTS } from '../artifacts'
import { PASSIVES } from '../passives/passives'
import { TALENTS } from '../passives/talents'
import { WEAPON_DB } from '../weapons/weapons'
import { STARTING_WEAPONS } from '../weapons/starting-weapons'
import { allMainActions } from '../actions'
import { getBuff } from '../buffs'
import { CONSTRUCTION_EFFECTS } from '../../engine/entities/character/source-layer'
import type { EffectDef } from '../../engine/entities/action'

/**
 * 数据审计：源（功法/天赋/奇物/武器）顶层 `effects` 只能写**构造期认**的效果类型。
 *
 * 为什么值得钉：顶层 `effects` 走的是 `buildSourceLayer`，只有 `CONSTRUCTION_EFFECTS` 里的类型会被执行；
 * 想挂自带 buff 必须写 `add_buff`（它的 attrMods 会折进来源层账、开局物化成战斗层）。
 * 历史上玄机的顶层 `effects:[add_buff]` 就是死数据（不生效、也没人报错），靠肉眼很难发现。
 */
interface SourceLike {
    id: string
    effects?: EffectDef[]
    triggers?: { effects?: EffectDef[] }[]
}

const SOURCES: { kind: string; list: SourceLike[] }[] = [
    { kind: '奇物', list: ARTIFACTS as SourceLike[] },
    { kind: '功法', list: PASSIVES as SourceLike[] },
    { kind: '天赋', list: TALENTS as SourceLike[] },
    { kind: '武器', list: [...WEAPON_DB, ...STARTING_WEAPONS] as unknown as SourceLike[] },
]

describe('数据审计：源顶层 effects / buffId', () => {
    it('顶层 effects 里没有构造期不认的效果（死数据）', () => {
        const dead: string[] = []
        for (const { kind, list } of SOURCES) {
            for (const s of list) {
                for (const e of s.effects ?? []) {
                    if (!CONSTRUCTION_EFFECTS.has(e.type)) dead.push(`${kind}:${s.id} → ${e.type}`)
                }
            }
        }
        expect(dead).toEqual([])
    })

    it('所有 add_buff 的 buffId 都能解析（顶层 + 触发器 + 招式）', () => {
        const missing: string[] = []
        const check = (where: string, effects: EffectDef[] | undefined) => {
            for (const e of effects ?? []) {
                if (e.type === 'add_buff' && e.buffId && !getBuff(e.buffId)) missing.push(`${where} → ${e.buffId}`)
            }
        }
        for (const { kind, list } of SOURCES) {
            for (const s of list) {
                check(`${kind}:${s.id}`, s.effects)
                for (const t of s.triggers ?? []) check(`${kind}:${s.id}(触发)`, t.effects)
            }
        }
        for (const a of allMainActions) check(`招式:${a.id}`, a.effects)
        expect(missing).toEqual([])
    })
})
