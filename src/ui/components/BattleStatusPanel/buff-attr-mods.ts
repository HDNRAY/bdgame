import type { BattleSnapshot } from '../../../engine/combat/types'

/**
 * 从**真实战斗层**汇总某角色各属性的临时修正值（战斗 HUD 属性分解的「状态」桶）。只读、纯函数。
 *
 * 直接读层上的 `mods` —— 那是引擎重算时用的同一份请求值，显示与判定必然一致。
 *
 * 以前是拿 `def.attrMods × 展示层数` 反推的，对**动态**属性 buff 一定错：`mods` 会被 tick 钩子
 * 整张改写（秋水·盈虚 灵巧/洞察每2秒挪1点、tide_power、七十二变、炁机流转…），而 `def.attrMods`
 * 只是声明（甚至常因 `stacks: 0` 从未生效）。于是秋水在界面上恒定显示「灵巧 +4」、从不显示洞察，
 * 分解加起来对不上真实属性。
 *
 * 纯属性附着 buff 不建战斗层（属性已折进 `attrBreakdown` 的功法/奇物/武器桶），所以只走
 * `pendingBuffs` 天然不会与那三个桶重复计数。
 */
export function sumBuffAttrMods(
    charId: string,
    snapshot: Pick<BattleSnapshot, 'pendingBuffs'>,
): Record<string, number> {
    const mods: Record<string, number> = {}
    for (const [key, layer] of snapshot.pendingBuffs) {
        const sep = key.indexOf('::')
        if (sep < 0) continue
        const rest = key.slice(sep + 2)
        const sep2 = rest.indexOf('::')
        const owner = sep2 < 0 ? rest : rest.slice(0, sep2)
        if (owner !== charId) continue
        for (const [attr, val] of Object.entries(layer.mods ?? {})) {
            mods[attr] = (mods[attr] ?? 0) + val
        }
    }
    return mods
}
