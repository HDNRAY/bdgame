import { describe, it, expect } from 'vitest'
import { BUFF_DB } from '../data/buffs/buffs'
import { DEBUFF_DB } from '../data/buffs/debuffs'
import { PLAYER_ACTIONS } from '../data/actions/player'
import { SUPPORT_ACTIONS } from '../data/actions/support'
import { INTERNAL_ACTIONS } from '../data/actions/internal'
import { QI_SKILLS } from '../data/actions/qi'
import { PASSIVES } from '../data/passives/passives'
import { TALENTS } from '../data/passives/talents'
import { WEAPON_DB } from '../data/weapons/weapons'
import { STARTING_WEAPONS } from '../data/weapons/starting-weapons'
import { ARTIFACTS } from '../data/artifacts'
import { OPPONENTS } from '../data/opponents'

/**
 * 检查数组中所有 id 唯一，返回重复 id 列表
 */
function findDupes(items: { id: string }[]): string[] {
    const seen = new Set<string>()
    const dupes = new Set<string>()
    for (const item of items) {
        if (seen.has(item.id)) dupes.add(item.id)
        else seen.add(item.id)
    }
    return [...dupes]
}

/**
 * 检查两组间的 id 交叉
 */
function findOverlap(a: { id: string }[], b: { id: string }[]): string[] {
    const idsA = new Set(a.map((x) => x.id))
    return b.filter((x) => idsA.has(x.id)).map((x) => x.id)
}

/** 单组检查 */
function expectNoDupes(items: { id: string }[], label: string) {
    const dupes = findDupes(items)
    expect(dupes, `${label} 重复 id: ${dupes.join(', ')}`).toEqual([])
}

/** 交叉检查 */
function expectNoOverlap(a: { id: string }[], b: { id: string }[], labelA: string, labelB: string) {
    const overlap = findOverlap(a, b)
    expect(overlap, `${labelA} 与 ${labelB} 交叉重复 id: ${overlap.join(', ')}`).toEqual([])
}

// ──────────────────────────────────────────
// Buffs
// ──────────────────────────────────────────
describe('buffs', () => {
    it('BUFF_DB 内无重复 id', () => expectNoDupes(BUFF_DB, 'BUFF_DB'))
    it('DEBUFF_DB 内无重复 id', () => expectNoDupes(DEBUFF_DB, 'DEBUFF_DB'))
    it('BUFF_DB 与 DEBUFF_DB 无交叉重复', () => expectNoOverlap(BUFF_DB, DEBUFF_DB, 'BUFF_DB', 'DEBUFF_DB'))
})

// ──────────────────────────────────────────
// Actions
// ──────────────────────────────────────────
describe('actions', () => {
    it('PLAYER_ACTIONS 内无重复 id', () => expectNoDupes(PLAYER_ACTIONS, 'PLAYER_ACTIONS'))
    it('SUPPORT_ACTIONS 内无重复 id', () => expectNoDupes(SUPPORT_ACTIONS, 'SUPPORT_ACTIONS'))
    it('INTERNAL_ACTIONS 内无重复 id', () => expectNoDupes(INTERNAL_ACTIONS, 'INTERNAL_ACTIONS'))
    it('QI_SKILLS 内无重复 id', () => expectNoDupes(QI_SKILLS, 'QI_SKILLS'))
})

// ──────────────────────────────────────────
// Passives & Talents
// ──────────────────────────────────────────
describe('passives & talents', () => {
    it('PASSIVES 内无重复 id', () => expectNoDupes(PASSIVES, 'PASSIVES'))
    it('TALENTS 内无重复 id', () => expectNoDupes(TALENTS, 'TALENTS'))
})

// ──────────────────────────────────────────
// Weapons
// ──────────────────────────────────────────
describe('weapons', () => {
    it('WEAPON_DB 内无重复 id', () => expectNoDupes(WEAPON_DB, 'WEAPON_DB'))
    it('STARTING_WEAPONS 内无重复 id', () => expectNoDupes(STARTING_WEAPONS, 'STARTING_WEAPONS'))
})

// ──────────────────────────────────────────
// Artifacts
// ──────────────────────────────────────────
describe('artifacts', () => {
    it('ARTIFACTS 内无重复 id', () => expectNoDupes(ARTIFACTS, 'ARTIFACTS'))
})

// ──────────────────────────────────────────
// Opponents
// ──────────────────────────────────────────
describe('opponents', () => {
    it('OPPONENTS 内无重复 id', () => expectNoDupes(OPPONENTS, 'OPPONENTS'))
})

// ──────────────────────────────────────────
// 跨文件交叉：同一实体类型内，不同子文件合并后不应有重复 id
// （buffs/actions/passives/weapons/artifacts 各有独立查找函数，
//   不同实体类型间可以有同名 id，不做交叉检查）
// ──────────────────────────────────────────
describe('跨文件交叉检查', () => {
    const sameDomain: [string, { id: string }[], string, { id: string }[]][] = [
        ['BUFF_DB', BUFF_DB, 'DEBUFF_DB', DEBUFF_DB],
        ['PASSIVES', PASSIVES, 'TALENTS', TALENTS],
        ['WEAPON_DB', WEAPON_DB, 'STARTING_WEAPONS', STARTING_WEAPONS],
    ]
    for (const [nameA, arrA, nameB, arrB] of sameDomain) {
        it(`${nameA} 与 ${nameB} 无交叉重复`, () => expectNoOverlap(arrA, arrB, nameA, nameB))
    }

    // actions 各子文件间也不应有交叉
    const actionGroups: [string, { id: string }[]][] = [
        ['PLAYER_ACTIONS', PLAYER_ACTIONS],
        ['SUPPORT_ACTIONS', SUPPORT_ACTIONS],
        ['INTERNAL_ACTIONS', INTERNAL_ACTIONS],
        ['QI_SKILLS', QI_SKILLS],
    ]
    for (let i = 0; i < actionGroups.length; i++) {
        for (let j = i + 1; j < actionGroups.length; j++) {
            const [nameA, arrA] = actionGroups[i]
            const [nameB, arrB] = actionGroups[j]
            it(`${nameA} 与 ${nameB} 无交叉重复`, () => expectNoOverlap(arrA, arrB, nameA, nameB))
        }
    }
})
