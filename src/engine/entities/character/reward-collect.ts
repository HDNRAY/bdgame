import type { CharacterBuild } from '../../../game/entities/character-build'
import { checkTalents } from '../../../game/talent-check'

/** 构筑里的奖励按类型分好类 */
export interface CollectedRewards {
    passives: string[]
    artifacts: string[]
    actions: string[]
}

/**
 * 收集构筑奖励：分类 → 天赋解锁 → 重复检查。
 *
 * 天赋按**原始属性**（`baseAttrs`，不含装备/功法/状态加成）解锁，每次构造角色（= 每场战斗前）算一次。
 * 奖励表里已预置的（生成器会写进去，供图鉴/面板展示）不重复加，避免触发重复奖励检查。
 */
export function collectRewards(build: CharacterBuild): CollectedRewards {
    const passives: string[] = []
    const artifacts: string[] = []
    const actions: string[] = []
    for (const r of build.rewards) {
        if (r.type === 'passive') passives.push(r.id)
        else if (r.type === 'artifact') artifacts.push(r.id)
        else if (r.type === 'action') actions.push(r.id)
    }
    for (const t of checkTalents(build.baseAttrs)) {
        if (!passives.includes(t.id)) passives.push(t.id)
    }
    checkDuplicates(build, passives, '功法')
    checkDuplicates(build, artifacts, '奇物')
    checkDuplicates(build, actions, '招式')
    return { passives, artifacts, actions }
}

/** 同一个奖励出现两次是数据错误：构造期直接抛，好过战斗里行为诡异 */
function checkDuplicates(build: CharacterBuild, ids: readonly string[], label: string): void {
    const seen = new Set<string>()
    const dups: string[] = []
    for (const id of ids) {
        if (seen.has(id)) dups.push(id)
        seen.add(id)
    }
    if (dups.length > 0) {
        throw new Error(
            `[${build.name}] 发现重复${label}: ${[...new Set(dups)].join(', ')}。` +
                `请检查奖励列表，每个${label}最多出现一次。`,
        )
    }
}
