import type { Tag } from '../../entities/tag'
import type { RewardType, RewardEntity } from '../../entities/reward'
import { PASSIVES } from '../../data/passives'
import { ARTIFACTS } from '../../data/artifacts'
import { PLAYER_ACTIONS } from '../../data/actions/player'
import { SUPPORT_ACTIONS } from '../../data/actions/support'
import { WEAPON_DB } from '../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../data/weapons/starting-weapons'
import { pickWeightedByTags } from '../tagRelevance'

export class RewardPool {
    private static _instance: RewardPool

    private _passivePool: RewardEntity[] | null = null
    private _artifactPool: RewardEntity[] | null = null
    private _actionPool: RewardEntity[] | null = null
    private _weaponPool: RewardEntity[] | null = null
    private _cultPool: RewardEntity[] | null = null

    static get instance(): RewardPool {
        if (!RewardPool._instance) RewardPool._instance = new RewardPool()
        return RewardPool._instance
    }

    getPool(type: RewardType): RewardEntity[] {
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

    pickChoices(type: RewardType, count: number, exclude: string[] = [], playerTags: Tag[] = []): RewardEntity[] {
        const pool = this.getPool(type).filter((r) => !exclude.includes(r.id))
        const filtered =
            type === 'action'
                ? pool.filter((r) => {
                      const reqs = r.requiredTags
                      if (!reqs || reqs.length === 0) return true
                      return reqs.some((t) => playerTags.includes(t))
                  })
                : pool
        const sorted = pickWeightedByTags(filtered, playerTags, count, exclude)
        return sorted
    }

    pickChoicesFrom(
        pool: RewardEntity[],
        count: number,
        exclude: string[] = [],
        playerTags: Tag[] = [],
    ): RewardEntity[] {
        const filtered = pool.filter((r) => !exclude.includes(r.id))
        const sorted = pickWeightedByTags(filtered, playerTags, count, exclude)
        return sorted
    }

    meetsRequirements(reward: RewardEntity, attrs: Record<string, number>): boolean {
        const reqs = reward.requireAttrsMin
        if (!reqs) return true
        for (const [attr, min] of Object.entries(reqs)) {
            if (min !== undefined && (attrs[attr] ?? 0) < min) return false
        }
        return true
    }

    validateChoices(
        choices: RewardEntity[],
        attrs: Record<string, number>,
    ): { valid: RewardEntity[]; allBlocked: boolean } {
        const valid = choices.filter((r) => this.meetsRequirements(r, attrs))
        return { valid, allBlocked: valid.length === 0 }
    }

    // ── 私有池初始化 ──

    private _getPassivePool(): RewardEntity[] {
        if (!this._passivePool) {
            this._passivePool = [...PASSIVES] as RewardEntity[]
        }
        return this._passivePool
    }

    private _getArtifactPool(): RewardEntity[] {
        if (!this._artifactPool) {
            this._artifactPool = [...ARTIFACTS] as RewardEntity[]
        }
        return this._artifactPool
    }

    private _getActionPool(): RewardEntity[] {
        if (!this._actionPool) {
            this._actionPool = [...PLAYER_ACTIONS, ...SUPPORT_ACTIONS] as RewardEntity[]
        }
        return this._actionPool
    }

    private _getWeaponPool(): RewardEntity[] {
        if (!this._weaponPool) {
            this._weaponPool = [...WEAPON_DB, ...STARTING_WEAPONS] as RewardEntity[]
        }
        return this._weaponPool
    }

    private _getCultPool(): RewardEntity[] {
        if (!this._cultPool) {
            this._cultPool = [
                {
                    id: 'cult_reward',
                    name: '修炼点',
                    type: 'points' as const,
                    tags: [],
                    description: '+4 修炼点',
                } as RewardEntity,
            ]
        }
        return this._cultPool
    }
}

/** 全局单例 */
export const rewardPool = RewardPool.instance
