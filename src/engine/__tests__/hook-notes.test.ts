import { describe, it, expect } from 'vitest'
import { MELEE_ACTIONS, PLAYER_ACTIONS, SUPPORT_ACTIONS, INTERNAL_ACTIONS, QI_SKILLS } from '../../data/actions'
import type { ActionDefinition } from '../entities/action'

/**
 * 招式的 `hookNotes` 是给玩家看的「这招到底加了什么」，工具提示直接读它 —— 它一旦和钩子不一致
 * 就是在骗人（历史上真出现过：暴伤从 +20% 改成 +30% 标注没跟、标注了一个早已删掉的效果）。
 *
 * 两条不变量：
 *  1. 数值/范围类标注（hitChance / critChance / critDamage / range）→ 对应的钩子必须真的存在；
 *  2. 标注是纯百分数（如 '+30%'）→ 钩子在 base=0 时必须给出同一个数（条件性钩子会因缺 ctx 抛错，跳过）。
 * 纯文字条件（'目标气血低于 50% 时必中'）只由第 1 条兜存在性。
 *
 * `canUse` 标注**不在此列**：这类「已有 X 时不可重复」说明的是 AI 侧 `support-planner.hasActiveBuff`
 * 的去重行为（非 additive 且层已存在就跳过），不是 action 级的硬门（玩家手操仍可点），所以
 * action 上没有 canUse 函数不算谎报。真正带 canUse 的招式（如 guard/听潮式）标注照样成立。
 */
const ALL: ActionDefinition[] = [...MELEE_ACTIONS, ...PLAYER_ACTIONS, ...SUPPORT_ACTIONS, ...INTERNAL_ACTIONS, ...QI_SKILLS]
const HOOK_OF: Record<string, string> = {
    hitChance: 'onActionHitChance',
    critChance: 'onActionCritChance',
    critDamage: 'onActionCritDamage',
    range: 'getRange',
}
const PURE_PCT = /^[+-]?\d+(\.\d+)?%$/

describe('hookNotes 与钩子一致（防标注骗人）', () => {
    it('标注了哪一项，就必须有对应的钩子', () => {
        const missing: string[] = []
        for (const a of ALL) {
            for (const [key, claim] of Object.entries(a.hookNotes ?? {})) {
                if (key === 'canUse') continue // 说明 AI 侧去重行为，不是 action 级硬门（见文件头）
                const hook = HOOK_OF[key]
                if (!hook) continue
                const fn = (a as unknown as Record<string, unknown>)[hook]
                if (typeof fn !== 'function') missing.push(`${a.id}（${a.name}）标注 ${key}「${claim}」但没有 ${hook}`)
            }
        }
        expect(missing).toEqual([])
    })

    it('纯百分数标注与实际钩子一致', () => {
        const bad: string[] = []
        for (const a of ALL) {
            for (const [key, claim] of Object.entries(a.hookNotes ?? {})) {
                if (!PURE_PCT.test(claim)) continue
                const hook = HOOK_OF[key]
                if (!hook) continue
                const fn = (a as unknown as Record<string, ((base: number, ...rest: never[]) => number) | undefined>)[hook]
                if (!fn) continue
                let got: number
                try {
                    got = fn(0, {} as never) * 100
                } catch {
                    continue // 条件性钩子（要读 ctx/state），交给上一条用例兜存在性
                }
                const want = parseFloat(claim)
                if (!Number.isFinite(got) || Math.abs(got - want) > 0.01) bad.push(`${a.id}（${a.name}）${key}: 标注 ${claim}，钩子实际 ${got}%`)
            }
        }
        expect(bad).toEqual([])
    })
})
