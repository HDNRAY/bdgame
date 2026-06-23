import type { Tag } from '../entities/tag'
import type { AttrName } from '../entities/attributes'
import { PLAYER_ACTIONS } from './actions/player'
import { PASSIVES } from './passives'
import { ARTIFACTS } from './artifacts'
import { STARTING_WEAPONS } from './starting-weapons'
import { WEAPON_DB } from './weapons'
import { sortByTagRelevance } from './tagRelevance'

// ── 统一奖励类型 ──

export type RewardItemType = 'passive' | 'artifact' | 'action' | 'weapon'

export interface RewardItem {
    id: string
    name: string
    type: RewardItemType
    tags: Tag[]
    description: string
    /** 属性门槛（不够则不展示） */
    requirements?: Partial<Record<AttrName, number>>
}

// ── 各类型池（懒加载缓存） ──

let _passivePool: RewardItem[] | null = null
let _artifactPool: RewardItem[] | null = null
let _actionPool: RewardItem[] | null = null
let _weaponPool: RewardItem[] | null = null

function getPassivePool(): RewardItem[] {
    if (!_passivePool) {
        _passivePool = PASSIVES.map((p) => ({
            id: p.id,
            name: p.name,
            type: 'passive' as const,
            tags: p.tags,
            description: p.description,
            requirements: p.requireAttrsMin,
        }))
    }
    return _passivePool
}

function getArtifactPool(): RewardItem[] {
    if (!_artifactPool) {
        _artifactPool = ARTIFACTS.map((a) => ({
            id: a.id,
            name: a.name,
            type: 'artifact' as const,
            tags: a.tags,
            description: a.description,
        }))
    }
    return _artifactPool
}

function getActionPool(): RewardItem[] {
    if (!_actionPool) {
        _actionPool = PLAYER_ACTIONS.map((a) => ({
            id: a.id,
            name: a.name,
            type: 'action' as const,
            tags: a.tags,
            description: a.description,
        }))
    }
    return _actionPool
}

function getWeaponPool(): RewardItem[] {
    if (!_weaponPool) {
        // 初始武器不进奖励池，只包括 WEAPON_DB 中的非初始武器
        const startingIds = new Set(STARTING_WEAPONS.map((w) => w.id))
        _weaponPool = WEAPON_DB.filter((w) => !startingIds.has(w.id)).map((w) => ({
            id: w.id,
            name: w.name,
            type: 'weapon' as const,
            tags: w.tags,
            description: w.description,
            requirements: w.requireAttrsMin,
        }))
    }
    return _weaponPool
}

// ── 公开 API ──

/** 按类型取奖励池 */
export function getRewardPool(type: RewardItemType): RewardItem[] {
    switch (type) {
        case 'passive':
            return getPassivePool()
        case 'artifact':
            return getArtifactPool()
        case 'action':
            return getActionPool()
        case 'weapon':
            return getWeaponPool()
    }
}

/**
 * 从指定类型的奖励池中选取 count 个候选奖励。
 *
 * @param type        - 奖励类型
 * @param count       - 需要几个候选（通常 3）
 * @param exclude     - 已拥有的奖励 ID 列表（不重复出）
 * @param playerTags  - 玩家当前 tags，用于关联度排序
 * @returns 按关联度排序的候选列表（如果池子不够多则返回全部可用）
 */
export function pickRewardChoices(
    type: RewardItemType,
    count: number,
    exclude: string[] = [],
    playerTags: Tag[] = [],
): RewardItem[] {
    const pool = getRewardPool(type).filter((r) => !exclude.includes(r.id))
    const sorted = sortByTagRelevance(pool, playerTags, exclude)
    return sorted.slice(0, Math.min(count, sorted.length))
}

/**
 * 检查角色是否满足某奖励的属性门槛。
 * 返回 true = 满足，false = 不满足（应隐藏或灰显）。
 */
export function meetsRequirements(reward: RewardItem, attrs: Record<string, number>): boolean {
    if (!reward.requirements) return true
    for (const [attr, min] of Object.entries(reward.requirements)) {
        if (min !== undefined && (attrs[attr] ?? 0) < min) return false
    }
    return true
}
