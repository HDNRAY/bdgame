import type { ActionDefinition, EffectDef } from '../../engine/entities/action'
import type { Character } from '../../engine/entities/character'
import type { Tag } from '../../engine/entities/tag'
import type { BattleState } from '../../engine/combat/types'
import type { BattleEngine } from '../../engine/combat/engine'
import type { BuffHookCtx, RuntimeAction } from '../buffs/types'
import { forEachBuffOf } from '../../engine/combat/utils'
import { PLAYER_ACTIONS } from './player'
import { SUPPORT_ACTIONS } from './support'
import { INTERNAL_ACTIONS } from './internal'
import { QI_SKILLS } from './qi'

/** 合并所有招式（惰性求值，避免循环依赖导致模块初始化顺序问题） */
const getALL_ACTIONS = (): ActionDefinition[] => [
    ...PLAYER_ACTIONS,
    ...SUPPORT_ACTIONS,
    ...INTERNAL_ACTIONS,
    ...QI_SKILLS,
]

export { PLAYER_ACTIONS, SUPPORT_ACTIONS, INTERNAL_ACTIONS, QI_SKILLS }

/** 按 ID 查找 */
export function getAction(id: string): ActionDefinition | undefined {
    return getALL_ACTIONS().find((a) => a.id === id)
}

/** 按武器标签过滤（空数组招式 = 任意武器可用） */
export function getActionsByWeapon(weaponTags: Tag[]): ActionDefinition[] {
    return getALL_ACTIONS().filter((a) => {
        if (a.requiredTags.length === 0) return true
        return a.requiredTags.some((tag) => weaponTags.includes(tag))
    })
}

/** 获取招式有效射程（考虑 getRange、short_dash 延伸；buff 距离修正由调用方用 getRuntimeAction 先行叠加） */
export function getActionRange(
    action: ActionDefinition,
    weaponRange: [number, number],
    attacker?: Character,
): [number, number] {
    const base = action.getRange?.(weaponRange, attacker) ?? weaponRange
    const shortDash = action.effects?.find(
        (e): e is Extract<EffectDef, { type: 'short_dash' }> => e.type === 'short_dash',
    )
    if (!shortDash) return base
    return [base[0], Math.min(10, base[1] + (shortDash.maxDistance ?? 2))]
}

/** 运行时招式（考虑角色身上 buff 的 onRuntimeAction 修正；优先用角色实际持有的招式定义，保留 actionEnhancer 增强如液压腿短冲刺） */
export function getRuntimeAction(
    actionId: string,
    self: Character,
    state: BattleState,
    engine?: BattleEngine,
): ActionDefinition | undefined {
    const base = self.actions.find((a) => a.id === actionId)?.def ?? getAction(actionId)
    if (!base) return undefined
    let cur: ActionDefinition | RuntimeAction = base
    forEachBuffOf(state.pendingBuffs, self.id, (buff, layer) => {
        if (!buff?.onRuntimeAction) return
        cur = buff.onRuntimeAction(
            { final: 0, raw: 0, target: self, attacker: self, engine, state, layer } as BuffHookCtx,
            cur,
        )
    })
    return cur as ActionDefinition
}
