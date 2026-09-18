import { Action, type ActionDefinition } from '../action'
import type { EffectSlot } from '../trigger'
import type { CharacterBuild } from '../../../game/entities/character-build'
import { getAction as getActionDef } from '../../../data/actions'
import { getWeapon } from '../../../data/weapons/weapons'

/**
 * 构造期生成招式缓存，顺序与原构造流程一致：
 * 1) 奖励/功法/奇物/武器赋予的招式 → 2) 触发槽引用到的内部招式（供 `maxUses` 追踪）
 * → 3) 通用强化（被动/义体的 `actionEnhancer`，保留剩余次数）→ 4) 非空手非御物自动补「捡武器」
 * → 5) 按 `actionConfigs` 排序（列表顺序 = 出招顺序）。
 */
export function buildActionCache(
    build: CharacterBuild,
    gainedActions: readonly string[],
    passiveTriggers: readonly EffectSlot[],
    enhance: (def: ActionDefinition) => ActionDefinition,
): Action[] {
    const cache = gainedActions
        .map((id) => {
            const def = getActionDef(id)
            return def ? new Action(def) : null
        })
        .filter((a): a is Action => a !== null)

    // 补充触发招式（被动/奇物/武器/actionConfig 引用的内部招式）到缓存，供 maxUses 追踪。
    // 复用 passiveTriggers（已聚合被动/奇物/主副手武器的 triggers），避免重复遍历各来源。
    const triggerActionIds = new Set<string>()
    for (const t of passiveTriggers) {
        if (t.actionId) triggerActionIds.add(t.actionId)
    }
    for (const ac of build.actionConfigs ?? []) {
        if (ac.actionId) triggerActionIds.add(ac.actionId)
    }
    const existingIds = new Set(cache.map((a) => a.id))
    for (const id of triggerActionIds) {
        if (existingIds.has(id)) continue
        const def = getActionDef(id)
        if (def) cache.push(new Action(def))
    }

    for (let i = 0; i < cache.length; i++) {
        const cur = cache[i]
        const modified = enhance(cur.def)
        if (modified === cur.def) continue
        const next = new Action(modified)
        next.remainingUses = cur.remainingUses
        cache[i] = next
    }

    // 非空手、非御物角色自动获取捡武器招式
    const weapon = getWeapon(build.weapon)
    if (
        weapon.id !== 'bare_hands' &&
        !weapon.tags.includes('imperial') &&
        !cache.some((a) => a.id === 'pickup_weapon' || a.id === 'retrieve_blade')
    ) {
        const pw = getActionDef('pickup_weapon')
        if (pw) cache.push(new Action(pw))
    }

    if (build.actionConfigs) {
        const order = new Map(build.actionConfigs.map((c, i) => [c.actionId, i]))
        cache.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
    }
    return cache
}
