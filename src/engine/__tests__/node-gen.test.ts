import { describe, it, expect } from 'vitest'
import {
    generateMap,
    shuffle,
    pickRandom,
    getBgChoices,
    getWeaponChoices,
    getFirstActionChoices,
    ALL_OPPONENT_IDS,
    ZHANGSAN_ID,
} from '../systems/node-gen'

describe('generateMap', () => {
    const map = generateMap()

    it('返回 33 个节点', () => {
        expect(map).toHaveLength(33)
    })

    it('节点 index 从 1 到 33', () => {
        map.forEach((node, i) => {
            expect(node.index).toBe(i + 1)
        })
    })

    it('前三个节点是 bg, weapon, first_action', () => {
        expect(map[0].type).toBe('bg')
        expect(map[0].index).toBe(1)
        expect(map[1].type).toBe('weapon')
        expect(map[1].index).toBe(2)
        expect(map[2].type).toBe('first_action')
        expect(map[2].index).toBe(3)
    })

    it('Phase 1: 节点 4-10 是 event, 节点 11 是 boss', () => {
        for (let i = 3; i <= 9; i++) {
            expect(map[i].type).toBe('event')
        }
        expect(map[10].type).toBe('boss')
    })

    it('Phase 2: 节点 12-21 是 event, 节点 22 是 boss', () => {
        for (let i = 11; i <= 20; i++) {
            expect(map[i].type).toBe('event')
        }
        expect(map[21].type).toBe('boss')
    })

    it('Phase 3: 节点 23-32 是 event, 节点 33 是 boss', () => {
        for (let i = 22; i <= 31; i++) {
            expect(map[i].type).toBe('event')
        }
        expect(map[32].type).toBe('boss')
    })

    it('共有 3 个 boss 节点', () => {
        const bosses = map.filter((n) => n.type === 'boss')
        expect(bosses).toHaveLength(3)
    })

    it('共有 27 个 event 节点', () => {
        const events = map.filter((n) => n.type === 'event')
        expect(events).toHaveLength(27)
    })
})

describe('getBgChoices', () => {
    it('返回 3 个背景', () => {
        const choices = getBgChoices()
        expect(choices).toHaveLength(3)
        choices.forEach((c) => {
            expect(c.id).toBeDefined()
            expect(c.name).toBeDefined()
        })
    })
})

describe('getWeaponChoices', () => {
    it('返回 3 把武器', () => {
        const choices = getWeaponChoices()
        expect(choices).toHaveLength(3)
        choices.forEach((c) => {
            expect(c.id).toBeDefined()
            expect(c.name).toBeDefined()
        })
    })
})

describe('getFirstActionChoices', () => {
    it('返回 3 个低费非辅助招式', () => {
        const choices = getFirstActionChoices([], [])
        expect(choices).toHaveLength(3)
        choices.forEach((c) => {
            expect(c.id).toBeDefined()
            expect(c.name).toBeDefined()
        })
    })
})

describe('shuffle', () => {
    it('保持长度不变', () => {
        const arr = [1, 2, 3, 4, 5]
        expect(shuffle(arr)).toHaveLength(5)
    })

    it('不修改原数组', () => {
        const arr = [1, 2, 3]
        const copy = [...arr]
        shuffle(arr)
        expect(arr).toEqual(copy)
    })

    it('包含所有原元素', () => {
        const arr = [1, 2, 3, 4, 5]
        expect(shuffle(arr).sort()).toEqual([1, 2, 3, 4, 5])
    })
})

describe('pickRandom', () => {
    it('返回指定数量的元素', () => {
        const arr = [1, 2, 3, 4, 5]
        expect(pickRandom(arr, 3)).toHaveLength(3)
    })

    it('n 大于数组长度时返回全部', () => {
        const arr = [1, 2, 3]
        expect(pickRandom(arr, 10)).toHaveLength(3)
    })

    it('n 为 0 时返回空数组', () => {
        expect(pickRandom([1, 2, 3], 0)).toEqual([])
    })

    it('不修改原数组', () => {
        const arr = [1, 2, 3]
        const copy = [...arr]
        pickRandom(arr, 2)
        expect(arr).toEqual(copy)
    })
})

describe('ALL_OPPONENT_IDS', () => {
    it('包含 16 个对手 ID', () => {
        expect(ALL_OPPONENT_IDS).toHaveLength(16)
    })

    it('不包含张三', () => {
        expect(ALL_OPPONENT_IDS).not.toContain(ZHANGSAN_ID)
    })
})
