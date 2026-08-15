import { LogicEngine } from 'json-logic-engine'

// ════════════════════════════════════════
//  Flag 条件（只读求值）
//  使用 json-logic-engine：标准 JSON 表达式，可序列化，可嵌套。
//  示例：
//    { "==": [{ "var": "flags.story" }, "sect"] }
//    { "and": [ { "==": [{ "var": "flags.weapon_one_handed" }, true] }, { "!": { "var": "flags.has_offhand" } } ] }
//  data 根对象固定为 { flags: Record<string, boolean|string|number> }。
// ════════════════════════════════════════

/** json-logic 表达式（标准 JSON 对象）。 */
export type When = Record<string, unknown>

/** 求值上下文：条件统一读 flags（唯一的叙事状态）。 */
export interface FlagContext {
    flags: Record<string, boolean | string | number>
}

const _engine = new LogicEngine()

/** 求值一个 when 条件；undefined 视为无条件（恒真）。 */
export function evaluateWhen(when: When | undefined, ctx: FlagContext): boolean {
    if (!when) return true
    try {
        return Boolean(_engine.run(when, ctx))
    } catch {
        // 表达式非法 → 视为不满足（宁可不出事件，也不让流程崩）
        return false
    }
}
