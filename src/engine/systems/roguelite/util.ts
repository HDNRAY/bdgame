/** 从数组中随机取 n 个不重复的元素 */
export function pickRandom<T>(arr: T[], n: number): T[] {
    const copy = [...arr]
    const result: T[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(Math.random() * copy.length)
        result.push(copy[idx])
        copy.splice(idx, 1)
    }
    return result
}
