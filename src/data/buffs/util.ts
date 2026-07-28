import type { RuntimeAction } from './types'

/** 给招式加射程（内部处理 getRange 链式调用 + 上限10m） */
export function buffEnhanceActionRange(action: RuntimeAction, bonus: number): RuntimeAction {
    const origGetRange = action.getRange
    return {
        ...action,
        getRange: (wr: [number, number]) => {
            const base = origGetRange?.(wr) ?? wr
            return [base[0], Math.min(10, base[1] + bonus)]
        },
    }
}
