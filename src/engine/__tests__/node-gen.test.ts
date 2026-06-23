import { describe, it, expect } from 'vitest'
import { generateMap, generateOptions, shuffle, pickRandom, ALL_OPPONENT_IDS, ZHANGSAN_ID } from '../systems/node-gen'

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

    it('前两个节点是 bg 和 weapon', () => {
        expect(map[0].type).toBe('bg')
        expect(map[0].index).toBe(1)
        expect(map[1].type).toBe('weapon')
        expect(map[1].index).toBe(2)
    })

    it('Phase 1: 节点 3-10 是 normal, 节点 11 是 boss', () => {
        for (let i = 2; i <= 9; i++) {
            expect(map[i].type).toBe('normal')
            expect(map[i].phase).toBe(1)
        }
        expect(map[10].type).toBe('boss')
        expect(map[10].phase).toBe(1)
        expect(map[10].bossId).toBeDefined()
    })

    it('Phase 2: 节点 12-21 是 normal, 节点 22 是 boss', () => {
        for (let i = 11; i <= 20; i++) {
            expect(map[i].type).toBe('normal')
            expect(map[i].phase).toBe(2)
        }
        expect(map[21].type).toBe('boss')
        expect(map[21].phase).toBe(2)
        expect(map[21].bossId).toBeDefined()
    })

    it('Phase 3: 节点 23-32 是 normal, 节点 33 是 boss', () => {
        for (let i = 22; i <= 31; i++) {
            expect(map[i].type).toBe('normal')
            expect(map[i].phase).toBe(3)
        }
        expect(map[32].type).toBe('boss')
        expect(map[32].phase).toBe(3)
        expect(map[32].bossId).toBeDefined()
    })

    it('所有 normal 节点有空的 options 数组', () => {
        const normals = map.filter((n) => n.type === 'normal')
        expect(normals).toHaveLength(28)
        normals.forEach((n) => {
            expect(n.options).toEqual([])
        })
    })

    it('所有 boss 节点有 bossId', () => {
        const bosses = map.filter((n) => n.type === 'boss')
        expect(bosses).toHaveLength(3)
        bosses.forEach((n) => {
            expect(typeof n.bossId).toBe('string')
        })
    })

    it('节点3有 forceRewardType=action', () => {
        const node3 = map.find((n) => n.index === 3)
        expect(node3?.forceRewardType).toBe('action')
    })

    it('其他 normal 节点没有 forceRewardType', () => {
        const others = map.filter((n) => n.type === 'normal' && n.index !== 3)
        expect(others.length).toBe(27)
        others.forEach((n) => expect(n.forceRewardType).toBeUndefined())
    })

    it('节点默认未完成', () => {
        map.forEach((n) => {
            expect(n.completed).toBeUndefined()
        })
    })
})

describe('generateOptions', () => {
    const enemies = ['zhanglie', 'laifeng', 'xuanji', 'layue', 'yidao', 'sangyuan']
    const normalNode = {
        index: 3,
        phase: 1 as const,
        type: 'normal' as const,
        forceRewardType: 'action' as const,
        options: [],
    }

    it('返回 3 个选项', () => {
        const opts = generateOptions(normalNode, enemies)
        expect(opts).toHaveLength(3)
    })

    it('至少 1 个 combat, 至少 1 个 event', () => {
        const opts = generateOptions(normalNode, enemies)
        const combats = opts.filter((o) => o.content === 'combat')
        const events = opts.filter((o) => o.content === 'event')
        expect(combats.length).toBeGreaterThanOrEqual(1)
        expect(events.length).toBeGreaterThanOrEqual(1)
    })

    it('forceRewardType 节点有一个 action 选项', () => {
        const opts = generateOptions(normalNode, enemies)
        const actions = opts.filter((o) => o.rewardType === 'action')
        expect(actions.length).toBeGreaterThanOrEqual(1)
    })

    it('3 个 rewardType 各不相同', () => {
        const opts = generateOptions(normalNode, enemies)
        const types = opts.map((o) => o.rewardType)
        expect(new Set(types).size).toBe(3)
    })

    it('combat 选项有 enemyId', () => {
        const opts = generateOptions(normalNode, enemies)
        opts.forEach((o) => {
            if (o.content === 'combat') {
                expect(o.enemyId).toBeDefined()
            }
        })
    })

    it('event 选项有 eventText', () => {
        const opts = generateOptions(normalNode, enemies)
        opts.forEach((o) => {
            if (o.content === 'event') {
                expect(o.eventText).toBeDefined()
            }
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
