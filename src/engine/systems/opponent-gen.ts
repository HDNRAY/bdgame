import { generateOpponent as gen } from '../data/opponents/index'

/** 根据 n 生成对手 build（引用 opponents/index 的实现） */
export function generateOpponent(n: number) {
    const { build } = gen(n)
    return build
}
