import type { TriggerSlot } from '../trigger'
import type { CharacterBuild } from '../../../game/entities/character-build'
import { TRIGGER_CONDITIONS } from '../../../data/triggers'

/**
 * 把 `build.actionConfigs` 的 `triggerId` 编译成触发槽（构造期算一次，战斗期间固定）。
 *
 * 一个触发条件只能被一个招式使用 —— 重复直接抛：否则战斗中哪一招先响应是不确定的。
 */
export function buildConfigTriggers(build: CharacterBuild): TriggerSlot[] {
    const result: TriggerSlot[] = []
    const seen = new Set<string>()
    for (const ac of build.actionConfigs ?? []) {
        if (!ac.triggerId) continue
        if (seen.has(ac.triggerId)) {
            throw new Error(`重复触发条件: ${ac.triggerId}（招式「${ac.actionId}」），每个触发条件只能被一个招式使用`)
        }
        seen.add(ac.triggerId)
        const tc = TRIGGER_CONDITIONS.find((t) => t.id === ac.triggerId)
        if (!tc) continue
        result.push({
            condition: { type: tc.type, buffId: tc.buffId, check: tc.check },
            actionId: ac.actionId,
        })
    }
    return result
}
