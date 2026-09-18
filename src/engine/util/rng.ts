/**
 * 随机数统一入口。
 *
 * 目的：把「主战斗的骰子」和「AI 推演沙盒的骰子」拆成**两条独立的流**。
 *
 * - `mainDraw` 默认直通 `Math.random`（行为与文档一致；测试里对 `Math.random` 的 spy 依旧生效，
 *   所以这里必须写成 `() => Math.random()` 而不是缓存函数引用）。
 * - `calcExpectedDamage` 执行期间调用 `enterSandbox()`：其间所有 `rng.next()` 都从沙盒自己的流取，
 *   **主战斗的流一个数都不动**。否则 AI 每评估一个候选就要掷一百多次骰子，沙盒一改（层集/钩子/
 *   分支）就移动真实战斗的随机流 → 对局结果变化、平衡漂移。
 * - `seedMain()` 为「整场战斗可播种」预留：`runBattle` 传 seed 时调用即可让整场可复现。
 *
 * 注意：**标识符不算骰子**。buff 层 appId 这类唯一串走 `token()`（计数器），否则播种/沙盒会改变
 * 层 key，既影响可复现比对，也可能撞层。
 */

/** 线性同余，够快也够均匀（仅用于游戏随机，不做密码学用途） */
function lcg(seed: number): () => number {
    let s = seed >>> 0
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000)
}

let mainDraw: () => number = () => Math.random()
let simDraw: (() => number) | null = null
/** 沙盒栈：支持评估内部再进入评估（恢复上一层而不是直接清空） */
const simStack: Array<(() => number) | null> = []
let tokenSeq = 0

export const rng = {
    /** 下一个 [0,1) 随机数（沙盒内取自沙盒流） */
    next(): number {
        return (simDraw ?? mainDraw)()
    },
    /** 概率判定：等价于 `Math.random() < p` */
    chance(p: number): boolean {
        return rng.next() < p
    },
    /** [0, n) 整数 */
    int(n: number): number {
        return Math.floor(rng.next() * n)
    },
    /** 等概率取一个元素 */
    pick<T>(arr: readonly T[]): T {
        return arr[rng.int(arr.length)]
    },
    /** 唯一标识串（buff 层 appId 等）：计数器，不消耗随机流 */
    token(): string {
        return `t${++tokenSeq}`
    },
    /** 进入推演沙盒：此后随机数走沙盒私有流（同一颗种子 → 同一候选每次估值一致） */
    enterSandbox(seed: number): void {
        simStack.push(simDraw)
        simDraw = lcg(seed)
    },
    /** 退出沙盒（恢复上一层：可能是主流，也可能是外层的沙盒流） */
    exitSandbox(): void {
        simDraw = simStack.length > 0 ? (simStack.pop() ?? null) : null
    },
    /** 当前是否在沙盒内（测试/调试用） */
    get inSandbox(): boolean {
        return simDraw !== null
    },
    /** 整场战斗播种（为「可复现对局」预留；默认仍是 Math.random） */
    seedMain(seed: number): void {
        mainDraw = lcg(seed)
    },
    /** 恢复主战斗流为 Math.random */
    resetMain(): void {
        mainDraw = () => Math.random()
    },
}
