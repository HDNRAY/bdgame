import type { CharacterBuild, BattleStyle } from '../game/entities/character-build'
import type { Reward } from '../game/entities/reward'
import type { ActionConfig } from '../game/entities/action-config'
import { ALL_ATTRS } from '../engine/entities/attributes'
import { cultCost } from './cultivation'
import { checkTalents } from './talent-check'
import { getArtifact } from '../data/artifacts'
import { getPassive } from '../data/passives'
import { getWeapon } from '../data/weapons/weapons'

/** 通用生成器 */
export function simpleGenerate(
    def: { id: string; name: string; battleStyle?: BattleStyle; story?: string; targetAttrs: Record<string, number> },
    weapon: string,
    rewards: Reward[],
    n: number,
    actionConfigs?: ActionConfig[],
): CharacterBuild {
    // 修炼点 = 每2节点1次+4
    const cultRewards = Math.floor((n - 1) / 2)
    // 天生道种：固定 +8 修炼点
    const hasInnateSeed = rewards.some((r) => r.id === 'innate_seed')
    const extraPoints = hasInnateSeed ? 8 : 0
    const total = Math.max(0, cultRewards * 4 + extraPoints)
    const result: Record<string, number> = {}
    for (const a of ALL_ATTRS) result[a] = 3

    // 轮流加点
    let remaining = total
    while (remaining > 0) {
        let improved = false
        for (const attr of ALL_ATTRS) {
            const cur = result[attr]
            const target = def.targetAttrs[attr] ?? 30
            if (cur >= target) continue
            const cost = cultCost(cur)
            if (remaining >= cost) {
                result[attr]++
                remaining -= cost
                improved = true
            }
        }
        if (!improved) break
    }

    // 根据属性自动解锁天赋
    const talentRewards = checkTalents(result)

    // 奖励按优先级选取
    const ratio = Math.min(1, n / 33)
    const rewardCount = Math.round(rewards.length * ratio)
    const picked = rewards.slice(0, rewardCount)

    // 从奖励中找武器：第一个为主武器，第二个为副武器
    const weaponRewards = picked.filter((r) => r.type === 'weapon')
    const finalWeapon = weaponRewards[0]?.id ?? weapon

    // 只有单手持握且非御物的武器才能有副手
    const mainDef = getWeapon(finalWeapon)
    let offhandWeapon: string | undefined
    if (mainDef.tags.includes('one_handed') && !mainDef.tags.includes('imperial')) {
        offhandWeapon = weaponRewards[1]?.id
    }

    // 收集所有已获得的招式 ID（含被动/奇物 grantsActions）
    const pickedActionIds = new Set(picked.filter((r) => r.type === 'action').map((r) => r.id))
    for (const r of picked) {
        if (r.type === 'artifact') {
            const def = getArtifact(r.id)
            if (def?.grantsActions) for (const aId of def.grantsActions) pickedActionIds.add(aId)
        } else if (r.type === 'passive') {
            const def = getPassive(r.id)
            if (def?.grantsActions) for (const aId of def.grantsActions) pickedActionIds.add(aId)
        }
    }
    const filteredConfigs = actionConfigs?.filter((ac) => pickedActionIds.has(ac.actionId))

    return {
        id: def.id,
        name: def.name,
        story: def.story,
        battleStyle: def.battleStyle,
        offhand: offhandWeapon,
        weapon: finalWeapon,
        spriteId: def.id,
        baseAttrs: result,
        rewards: [...talentRewards, ...picked],
        actionConfigs: filteredConfigs,
    }
}
