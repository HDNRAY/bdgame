import type { Tag } from '../../entities/tag'
import type { RewardType, Reward } from '../../entities/reward'
import { PASSIVES } from '../../data/passives'
import { ARTIFACTS } from '../../data/artifacts'
import { PLAYER_ACTIONS } from '../../data/actions/player'
import { SUPPORT_ACTIONS } from '../../data/actions/support'
import { WEAPON_DB } from '../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { pickWeightedByTags } from '../tagRelevance'

export class RewardPool {
    private static _instance: RewardPool

    private _passivePool: Reward[] | null = null
    private _artifactPool: Reward[] | null = null
    private _actionPool: Reward[] | null = null
    private _weaponPool: Reward[] | null = null
    private _cultPool: Reward[] | null = null

    static get instance(): RewardPool {
        if (!RewardPool._instance) RewardPool._instance = new RewardPool()
        return RewardPool._instance
    }

    getPool(type: RewardType): Reward[] {
        switch (type) {
            case 'passive':
                return this._getPassivePool()
            case 'artifact':
                return this._getArtifactPool()
            case 'action':
                return this._getActionPool()
            case 'weapon':
                return this._getWeaponPool()
            case 'points':
                return this._getCultPool()
            default:
                return []
        }
    }

    /**
     * 从指定类型的奖励池中选取 count 个候选奖励。
     *
     * @param type        - 奖励类型
     * @param count       - 需要几个候选（通常 3）
     * @param exclude     - 已拥有的奖励 ID 列表（不重复出）
     * @param playerTags  - 玩家当前 tags，用于关联度排序
     * @returns 按关联度排序的候选列表
     */
    pickChoices(type: RewardType, count: number, exclude: string[] = [], playerTags: Tag[] = []): Reward[] {
        const pool = this.getPool(type).filter((r) => !exclude.includes(r.id))
        // 招式：requiredTags 与武器 tag 不匹配的不出现
        const filtered =
            type === 'action'
                ? pool.filter((r) => {
                      const reqs = r.requiredTags
                      if (!reqs || reqs.length === 0) return true
                      return reqs.some((t) => playerTags.includes(t as Tag))
                  })
                : pool
        const sorted = pickWeightedByTags(filtered, playerTags, count, exclude)
        return sorted
    }

    /** 从预过滤后的列表中取 count 个候选（外部已过滤） */
    pickChoicesFrom(pool: Reward[], count: number, exclude: string[] = [], playerTags: Tag[] = []): Reward[] {
        const filtered = pool.filter((r) => !exclude.includes(r.id))
        const sorted = pickWeightedByTags(filtered, playerTags, count, exclude)
        return sorted
    }

    /** 检查角色是否满足某奖励的属性门槛 */
    meetsRequirements(reward: Reward, attrs: Record<string, number>): boolean {
        const reqs = reward.requireAttrsMin
        if (!reqs) return true
        for (const [attr, min] of Object.entries(reqs)) {
            if (min !== undefined && (attrs[attr] ?? 0) < min) return false
        }
        return true
    }

    /**
     * 从候选奖励中确保至少一个满足属性门槛，否则回退为修炼点策略。
     */
    validateChoices(choices: Reward[], attrs: Record<string, number>): { valid: Reward[]; allBlocked: boolean } {
        const valid = choices.filter((r) => r.type === 'points' || this.meetsRequirements(r, attrs))
        return { valid, allBlocked: valid.length === 0 }
    }

    // ── 私有池初始化 ──

    private _getPassivePool(): Reward[] {
        if (!this._passivePool) {
            this._passivePool = PASSIVES.map((p) => ({
                id: p.id,
                name: p.name,
                type: 'passive' as const,
                tags: p.tags,
                description: p.description,
                requireAttrsMin: p.requireAttrsMin,
            }))
        }
        return this._passivePool
    }

    private _getArtifactPool(): Reward[] {
        if (!this._artifactPool) {
            this._artifactPool = ARTIFACTS.map((a) => ({
                id: a.id,
                name: a.name,
                type: 'artifact' as const,
                tags: a.tags,
                description: a.description,
            }))
        }
        return this._artifactPool
    }

    private _getActionPool(): Reward[] {
        if (!this._actionPool) {
            this._actionPool = [...PLAYER_ACTIONS, ...SUPPORT_ACTIONS].map((a) => ({
                id: a.id,
                name: a.name,
                type: 'action' as const,
                tags: a.tags,
                requiredTags: a.requiredTags,
                description: a.description,
            }))
        }
        return this._actionPool
    }

    private _getWeaponPool(): Reward[] {
        if (!this._weaponPool) {
            const startingIds = new Set(STARTING_WEAPONS.map((w) => w.id))
            this._weaponPool = WEAPON_DB.filter((w) => !startingIds.has(w.id)).map((w) => ({
                id: w.id,
                name: w.name,
                type: 'weapon' as const,
                tags: w.tags,
                description: w.description,
                requireAttrsMin: w.requireAttrsMin,
            }))
        }
        return this._weaponPool
    }

    private _getCultPool(): Reward[] {
        if (!this._cultPool) {
            // 虚拟的修炼点奖励
            this._cultPool = [
                {
                    id: 'cult_reward',
                    name: '修炼点',
                    type: 'points',
                    tags: [],
                    description: '+4 修炼点',
                },
            ]
        }
        return this._cultPool
    }
}

/** 全局单例 */
export const rewardPool = RewardPool.instance
