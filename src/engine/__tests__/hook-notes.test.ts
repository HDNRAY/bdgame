import { describe, it, expect } from 'vitest'
import { MELEE_ACTIONS, PLAYER_ACTIONS, SUPPORT_ACTIONS, INTERNAL_ACTIONS, QI_SKILLS } from '../../data/actions'
import type { ActionDefinition } from '../entities/action'

/**
 * 招式的 `hookNotes` 是给玩家看的「这招到底加了什么」，工具提示直接读它 —— 它一旦和钩子不一致
 * 就是在骗人（历史上真出现过：标注了 canUse 但代码里没有、暴伤从 +20% 改成 +30% 标注没跟）。
 *
 * 两条不变量：
 *  1. 标注了某项（数值或条件）→ 对应的钩子必须真的存在；
 *  2. 标注是纯百分数（如 '+30%'）→ 钩子在 base=0 时必须给出同一个数（条件性钩子会因缺 ctx 抛错，跳过）。
 * 纯文字条件（'目标气血低于 50% 时必中'）只由第 1 条兜存在性。
 */
const ALL: ActionDefinition[] = [...MELEE_ACTIONS, ...PLAYER_ACTIONS, ...SUPPORT_ACTIONS, ...INTERNAL_ACTIONS, ...QI_SKILLS]
const HOOK_OF: Record<string, string> = {
    hitChance: 'onActionHitChance',
    critChance: 'onActionCritChance',
    critDamage: 'onActionCritDamage',
    canUse: 'canUse',
    range: 'getRange',
}
const PURE_PCT = /^[+-]?\d+(\.\d+)?%$/

/**
 * 已知「标注了但还没实现」的清单（2026-09 审计出来的 9 条，见提交说明）：
 *  - fall_to_azure_sword：标注「目标气血低于 30% 时暴击+30%」，但没有 onActionCritChance
 *  - 8 条 canUse 标注（听风式/无想剑/刀马旦/三头六臂/灵剑/凝炁成盾/金刚不坏/嚼茴香豆）都没有 canUse 函数
 * 这份清单只许变短：要么补上钩子，要么删掉标注 —— 新出现的标注谎报会被下面的用例拦下。
 * （注：这 8 条的 AI 侧本来就被 support-planner 的 hasActiveBuff 拦着，缺 canUse 只影响玩家手操与提示文案。）
 */
const KNOWN_MISSING = new Set([
    'fall_to_azure_sword.critChance',
    'wind_hear.canUse',
    'wu_xiang_jian.canUse',
    'dao_ma_dan.canUse',
    'santou_liubi.canUse',
    'spirit_sword.canUse',
    'condense_shield.canUse',
    'chanzi_stance.canUse',
    '_eat_beans.canUse',
])

describe('hookNotes 与钩子一致（防标注骗人）', () => {
    it('标注了哪一项，就必须有对应的钩子', () => {
        const missing: string[] = []
        for (const a of ALL) {
            for (const [key, claim] of Object.entries(a.hookNotes ?? {})) {
                const hook = HOOK_OF[key]
                if (!hook) continue
                const fn = (a as unknown as Record<string, unknown>)[hook]
                if (typeof fn !== 'function' && !KNOWN_MISSING.has(`${a.id}.${key}`)) {
                    missing.push(`${a.id}（${a.name}）标注 ${key}「${claim}」但没有 ${hook}`)
                }
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
