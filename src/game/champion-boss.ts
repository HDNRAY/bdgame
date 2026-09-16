import { ARTIFACTS } from '../data/artifacts'
import { getWeapon } from '../data/weapons/weapons'
import { ALL_ATTRS, type AttrName } from '../engine/entities/attributes'
import { artifact as artifactReward } from '../engine/util/reward-utils'
import { loadMeta } from './meta-save'
import type { CharacterBuild } from './entities/character-build'
import type { Reward } from './entities/reward'

/**
 * 隐藏boss（n33.5）= 上一轮通关的玩家。
 * 设计见 `docs/ending-design.md` 第三节：
 *  - 玩家 13 个奖励与武器/副手完全保留；
 *  - 换上全部义体（这里排除两件不适合这位「百岁老将」的）；
 *  - 属性：**六项一律 7 点起，奖励与义体的加成全部叠上去**（不做任何抵扣）。
 *    13 件义体 + 专属义体一共给 48 点属性（平均每项 8 点），这就是它相对玩家的身板差；
 *  - 义体自带的代价（失重/失能/永久失心/失感/过热）照常在战斗里结算。
 */

/** 不换上的义体：悬浮座椅（轮椅，不是战斗件）、战斗芯片·改（博士专属） */
export const CHAMPION_EXCLUDED_IMPLANTS = ['wheelchair_lightness', 'doctor_chip']

/** 隐藏boss 专属义体 */
export const CHAMPION_ONLY_IMPLANT = 'titanium_spine'

/** 隐藏boss 的初始属性：六项一律这么多，之后叠奖励与义体（唯一的属性旋钮） */
export const CHAMPION_BASE_ATTR = 7

/** boss 名字与出场台词（战斗内显示；`main-story.md`「隐藏boss」节） */
export const CHAMPION_BOSS_NAME = '斗炁协会副会长'
export const CHAMPION_BOSS_TAUNT = '来了？'

/**
 * boss 在战斗里的角色 id。**必须与玩家 build 的 id（`'player'`）不同**：
 * `runBattle` 用角色 id 报胜者，引擎再用 `winner === enemy.id` 判负，
 * 同 id 会让 boss 战恒判为败（首版就是这个 bug）。
 */
export const CHAMPION_BOSS_ID = 'champion_boss'

/** 隐藏boss 换入的义体 id（全部义体减去排除项） */
export function championImplantIds(): string[] {
    return ARTIFACTS.filter(
        (a) =>
            a.tags.includes('implant') &&
            a.id !== CHAMPION_ONLY_IMPLANT &&
            !CHAMPION_EXCLUDED_IMPLANTS.includes(a.id),
    ).map((a) => a.id)
}

/** 可作副手：单手近战兵器（排除御物与长柄），与 BuildSim 的口径一致 */
function canHoldOffhand(weaponId: string): boolean {
    const def = getWeapon(weaponId)
    if (!def) return false
    return def.tags.includes('one_handed') && !def.tags.includes('imperial') && !def.tags.includes('polearm')
}

/**
 * 由「最近一次通关的玩家 build」构造隐藏boss 的 build。
 * 纯函数：不读存档、不碰全局状态（调用方负责传入存档里的 build）。
 */
export function championBossBuild(saved: CharacterBuild): CharacterBuild {
    // 玩家上一轮已经拿到的义体不重复挂（它的属性早已在那份奖励里）
    const owned = new Set(saved.rewards.filter((r) => r.type === 'artifact').map((r) => r.id))
    const rewards: Reward[] = [...saved.rewards]
    for (const id of [...championImplantIds(), CHAMPION_ONLY_IMPLANT]) {
        if (!owned.has(id)) rewards.push(artifactReward(id))
    }

    const baseAttrs: Partial<Record<AttrName, number>> = {}
    for (const a of ALL_ATTRS) baseAttrs[a] = CHAMPION_BASE_ATTR

    const build: CharacterBuild = {
        ...saved,
        id: CHAMPION_BOSS_ID,
        name: CHAMPION_BOSS_NAME,
        taunt: CHAMPION_BOSS_TAUNT,
        baseAttrs,
        rewards,
        // 这副躯体是「上一轮的自己」，故事线文本不再沿用
        story: undefined,
    }
    // 非法组合清理：主手不是单手兵器时不能带副手
    if (build.offhand && !canHoldOffhand(build.weapon)) build.offhand = undefined
    return build
}

/** 从元进度存档取「最近一次通关的玩家 build」并转成隐藏boss；无存档返回 undefined */
export function championBuildFromSave(): CharacterBuild | undefined {
    const saved = loadMeta().lastWinBuild
    return saved ? championBossBuild(saved) : undefined
}
