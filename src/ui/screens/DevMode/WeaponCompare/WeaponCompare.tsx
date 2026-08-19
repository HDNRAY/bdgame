// ════════════════════════════════════════
//  WeaponCompare — 武器评分横向对比（DevMode）
//
//  换算模型：所有效果统一折算成「期望伤」（HP 当量），基准招式为桥梁：
//    - 1 AP = 基准招式期望伤（全 15 环境，getApDamageValue）
//    - 1 缠 = 0.3 AP（AI_CHAN_COST_WEIGHT 权威口径）
//  分项：伤害分（真实属性下基准招式可及档平均期望伤，绝对量，属性增减真实博弈）
//       + 距离分（每覆盖一档固定加分）+ 授招分 + 标签分 + 触发分 + 御物召唤分
//  评分逻辑全部内联在本文件（开发工具，不进 bridge 运行时层）。
// ════════════════════════════════════════

import { useMemo, useState } from 'react'
import { Character } from '../../../../engine/entities/character'
import { WEAPON_DB, getWeapon, type WeaponDef } from '../../../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../../../data/weapons/starting-weapons'
import { calcExpectedDamage } from '../../../../engine/ai/expected-damage'
import type { BattleState, BuffLayer } from '../../../../engine/combat/types'
import { MAX_CHAN } from '../../../../engine/constants'
import type { ActionDefinition } from '../../../../engine/entities/action'
import { getBuff } from '../../../../data/buffs'
import { getAction } from '../../../../data/actions'
import { PLAYER_ACTIONS } from '../../../../data/actions/player'
import { INTERNAL_ACTIONS } from '../../../../data/actions/internal'
import { QI_SKILLS } from '../../../../data/actions/qi'
import { calcApRegenPerSec } from '../../../../engine/calc/damage'
import { EntityItem } from '../../../components/ui/EntityItem/EntityItem'
import './WeaponCompare.scss'

// ── 评分常量 ──
/** 全属性基准 15 */
const ATTRS = { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 }
/** 基准武器（锚点）：破狼竹枝，无属性加成 */
const DEFENDER_WEAPON = 'po_lang_zhu_zhi'
/** 四档距离：覆盖 拳套[0-2] / 刀剑[1-3] / 长柄[1-4] / 御物[0-6] 的射程分水岭 */
const BENCH_DISTANCES = [0, 2, 4, 6]
/** 每单位射程跨度的加分（射程广度，按 range 跨度计） */
const DISTANCE_SCORE_PER_UNIT = 0.5
/** 每个 tag 的固定加分（配招面广度，1 个 tag 1 分） */
const TAG_SCORE_PER_TAG = 1
/** 御物耗炁扣分权重：AP 回复被压掉比例 × 此权重（召唤物 0AP 不吃 AP，只反映失去的普攻机会） */
const YUWU_SCORE_WEIGHT = 4

/**
 * 基准招式：requiredTags 空（任何武器可用）、伤害吃全部属性、系数一致（全 0.1）。
 * 3AP（与真实招式池量级一致）：每 AP 期望伤 ≈ 2.13，贴近真实池中位数 2.22——
 * 不做 scaling 全 1 的虚高基准（那会算出 63.8/AP，比真实高 30 倍）。
 * tags 必须为空——武器 buff 钩子依赖 source.tags 判断攻击类型，全标签会误触发。
 */
const BENCH_ACTION: ActionDefinition = {
    id: '_bench_swing',
    name: '基准挥击',
    description: '武器评分基准招式：伤害受全部属性影响，系数一致（全 0.1，3AP）。',
    tags: [],
    requiredTags: [],
    apCost: 3,
    effects: [
        {
            type: 'damage',
            scaling: {
                strength: 0.1,
                vitality: 0.1,
                agility: 0.1,
                dexterity: 0.1,
                insight: 0.1,
                wisdom: 0.1,
            },
        },
    ],
}

/** 制造标准测试角色：全属性基准 15，武器 stat_buff 与 on_equip buff 的 attrMods 真实生效 */
function makeBenchChar(id: string, name: string, weapon: WeaponDef, pendingBuffs: Map<string, BuffLayer>): Character {
    const c = new Character({
        id,
        name,
        weapon: weapon.id,
        baseAttrs: { ...ATTRS },
        rewards: [],
    })
    c.weaponDef = weapon
    c.chan = MAX_CHAN
    c.ap = c.maxAp
    c.hp = Math.round(c.maxHp * 0.49 * 10) / 10
    for (const t of weapon.triggers ?? []) {
        if (t.condition.type !== 'on_equip') continue
        for (const eff of t.effects ?? []) {
            if (eff.type !== 'add_buff') continue
            const def = getBuff(eff.buffId)
            if (!def) continue
            const stacks = eff.stacks ?? 1
            if (def.attrMods) {
                for (const [attr, v] of Object.entries(def.attrMods)) {
                    c.attrs.modify(attr as never, (v as number) * stacks)
                }
            }
            pendingBuffs.set(`${eff.buffId}::${c.id}`, { restoreValue: stacks })
        }
    }
    return c
}

/** 基准测量：基准招式在四档距离下的期望伤（射程外的档记 0） */
function calcBenchmark(weapon: WeaponDef, pendingBuffs: Map<string, BuffLayer>): { perDistance: number[]; reachableTiers: number } {
    const atk = makeBenchChar('A', '甲', weapon, pendingBuffs)
    const def = makeBenchChar('B', '乙', getWeapon(DEFENDER_WEAPON), pendingBuffs)
    const perDistance = BENCH_DISTANCES.map((d) => {
        const state: BattleState = {
            pendingBuffs,
            position: { distance: () => d },
            turn: { currentTime: 0 },
            characters: [atk, def],
        } as never
        const est = calcExpectedDamage(BENCH_ACTION, atk, def, weapon.range, state)
        return est.canReach ? est.expectedDamage : 0
    })
    return { perDistance, reachableTiers: perDistance.filter((v) => v > 0).length }
}

/** 基准武器四档平均期望伤（1AP 伤害锚），惰性缓存 */
let baseAvgDamage: number | null = null
function getApDamageValue(): number {
    if (baseAvgDamage === null) {
        const pb = new Map<string, BuffLayer>()
        const { perDistance, reachableTiers } = calcBenchmark(getWeapon(DEFENDER_WEAPON), pb)
        baseAvgDamage = reachableTiers > 0 ? perDistance.reduce((s, v) => s + v, 0) / reachableTiers : 0
    }
    return baseAvgDamage
}

/** 伤害分：真实属性下可及档平均期望伤（绝对量）与相对基准增量 */
function calcDamageScore(weapon: WeaponDef): { avg: number; delta: number } {
    const pb = new Map<string, BuffLayer>()
    const { perDistance, reachableTiers } = calcBenchmark(weapon, pb)
    const avg = reachableTiers > 0 ? perDistance.reduce((s, v) => s + v, 0) / reachableTiers : 0
    const delta = Math.round((avg - getApDamageValue()) * 10) / 10
    return { avg: Math.round(avg * 10) / 10, delta }
}

/** 属性分：Σ 属性增减 × 1（1 属性点 = 1 分，可为负）。汇总 stat_buff 与 on_equip buff 的 attrMods。 */
function calcAttrScore(weapon: WeaponDef): { mods: Record<string, number>; score: number } {
    const mods: Record<string, number> = {}
    const add = (attrs: Record<string, number> | undefined, mult: number) => {
        for (const [attr, v] of Object.entries(attrs ?? {})) {
            mods[attr] = (mods[attr] ?? 0) + (v as number) * mult
        }
    }
    for (const eff of weapon.effects ?? []) {
        if (eff.type === 'stat_buff') add(eff.attrs, 1)
    }
    for (const t of weapon.triggers ?? []) {
        if (t.condition.type !== 'on_equip') continue
        for (const eff of t.effects ?? []) {
            if (eff.type !== 'add_buff') continue
            const def = getBuff(eff.buffId)
            if (def?.attrMods) add(def.attrMods, eff.stacks ?? 1)
        }
    }
    const score = Math.round(Object.values(mods).reduce((s, v) => s + v, 0) * 10) / 10
    return { mods, score }
}

/** 距离分：按射程跨度（max−min）× 每单位分（范围越大射程越广，非最大距离） */
function calcDistanceScore(weapon: WeaponDef): { span: number; score: number } {
    const span = weapon.range[1] - weapon.range[0]
    return { span, score: Math.round(span * DISTANCE_SCORE_PER_UNIT * 10) / 10 }
}

/** 御物召唤物输出分：召唤物期望伤 × 数量（每个召唤物一次攻击，0AP 免费输出） */
function calcSummonScore(weapon: WeaponDef): { count: number; perSummon: number; total: number } {
    if (!weapon.summon) return { count: 0, perSummon: 0, total: 0 }
    const pendingBuffs = new Map<string, BuffLayer>()
    const atk = makeBenchChar('A', '甲', weapon, pendingBuffs)
    const def = makeBenchChar('B', '乙', getWeapon(DEFENDER_WEAPON), pendingBuffs)
    const summonAction = weapon.summon.action ?? getAction(weapon.summon.actionId)
    if (!summonAction) return { count: 0, perSummon: 0, total: 0 }

    const count = weapon.summon.maxCount(atk)
    const perSummonArr = BENCH_DISTANCES.map((d) => {
        const state: BattleState = {
            pendingBuffs,
            position: { distance: () => d },
            turn: { currentTime: 0 },
            characters: [atk, def],
        } as never
        const est = calcExpectedDamage(summonAction, atk, def, weapon.range, state)
        return est.canReach ? est.expectedDamage : 0
    })
    const reachable = perSummonArr.filter((v) => v > 0)
    const perSummon = reachable.length > 0 ? reachable.reduce((s, v) => s + v, 0) / reachable.length : 0
    // 简化：有多少个召唤物就攻击多少次（每个召唤物 1 次），不做间隔折算
    const total = Math.round(perSummon * count * 10) / 10
    return { count, perSummon: Math.round(perSummon * 10) / 10, total }
}

/** 御物耗炁扣分：按 AP 回复被压掉的比例折算（召唤物 0AP 不吃 AP，扣分只反映失去的普攻 AP 机会） */
function calcYuwuCost(weapon: WeaponDef): { apPerSec: number; score: number } {
    let apPerSec = 0
    for (const t of weapon.triggers ?? []) {
        if (t.condition.type !== 'on_equip') continue
        for (const eff of t.effects ?? []) {
            if (eff.type === 'add_buff' && eff.buffId === 'yuwu_cost') {
                apPerSec += eff.stacks ?? 0
            }
        }
    }
    // 扣分 = 扣掉的 AP 回复比例 × YUWU_SCORE_WEIGHT（基准推演 15 回复 1.5/s）
    const regen = calcApRegenPerSec(ATTRS.wisdom)
    const ratio = regen > 0 ? Math.min(1, apPerSec / regen) : 0
    const score = apPerSec > 0 ? -Math.round(ratio * YUWU_SCORE_WEIGHT * 10) / 10 : 0
    return { apPerSec: Math.round(apPerSec * 100) / 100, score }
}

/** 条件触发的基准触发率（全 15 互打） */
const TRIGGER_RATE: Record<string, number> = {
    on_hit: 0.713,
    on_dodge: 0.287,
    on_parry: 0.45,
    on_attack: 1,
    on_dealt_damage: 1,
    on_was_hit: 0.713,
    on_stance: 0.3,
    on_opponent_move_away: 0.3,
    on_move_away: 0.3,
    on_move_closer: 0.3,
    on_opponent_move_closer: 0.3,
}

/** DoT 类 debuff 的期望伤当量（全 15 环境一轮 DoT 总伤害） */
const DEBUFF_DOT_DMG: Record<string, number> = {
    burn: 12,
    poison: 10,
    bleed: 10,
    frost: 4,
    stun: 8,
    paralyze: 8,
}

/** 标准招式池（玩家/内置/炁招，排除支撑招） */
const STANDARD_ACTION_POOL = [...PLAYER_ACTIONS, ...INTERNAL_ACTIONS, ...QI_SKILLS].filter(
    (a) => !a.tags.includes('pre_action') && !a.tags.includes('post_action'),
)

/**
 * 触发分（期望伤当量）：触发次数 × 效果价值。
 * restore_ap：基准 AP 富余 → 回 AP 不提升出手次数 → 无价值，不计分。
 */
function calcTriggerScore(weapon: WeaponDef): number {
    let total = 0
    for (const t of weapon.triggers ?? []) {
        if (t.condition.type === 'on_equip') continue
        const cond = t.condition.type
        const rate = TRIGGER_RATE[cond] ?? 0.1
        let value = 0
        if (t.actionId) {
            // 触发招式：按 AP+缠成本折算期望伤（与 ActionCompare 同口径）
            const def = STANDARD_ACTION_POOL.find((a) => a.id === t.actionId)
            if (def) {
                const est = (() => {
                    const pb = new Map<string, BuffLayer>()
                    const atk = makeBenchChar('A', '甲', weapon, pb)
                    const defc = makeBenchChar('B', '乙', getWeapon(DEFENDER_WEAPON), pb)
                    const state: BattleState = {
                        pendingBuffs: pb,
                        position: { distance: () => 4 },
                        turn: { currentTime: 0 },
                        characters: [atk, defc],
                    } as never
                    return calcExpectedDamage(def, atk, defc, weapon.range, state).expectedDamage
                })()
                value = Math.round(est * 10) / 10
            }
        }
        for (const eff of t.effects ?? []) {
            if (eff.type === 'add_debuff')
                value += (eff.stacks ?? 1) * (eff.chance ?? 1) * (DEBUFF_DOT_DMG[eff.buffId] ?? 0)
        }
        // 单次攻击视角：触发概率 × 效果价值（不乘攻击次数——纯一次攻击的期望）
        let p = 1 // 默认触发概率
        if (cond === 'on_hit') p = TRIGGER_RATE.on_hit
        else if (cond === 'on_dodge' || cond === 'on_parry') p = rate
        else if (cond === 'on_was_hit' || cond === 'on_dodged' || cond === 'on_parried') p = TRIGGER_RATE.on_hit
        total += Math.round(p * value * 10) / 10
    }
    return Math.round(total * 10) / 10
}

/** 标签分：每个 tag 固定加分（配招面广度，1 tag = 1 分，不做解锁招式数统计） */
function calcTagScore(weapon: WeaponDef): { count: number; score: number } {
    return { count: weapon.tags.length, score: weapon.tags.length * TAG_SCORE_PER_TAG }
}

/** 授招分：grantsActions 各招式真实期望伤之和 */
function calcGrantScore(weapon: WeaponDef): number {
    let total = 0
    for (const id of weapon.grantsActions ?? []) {
        const def = STANDARD_ACTION_POOL.find((a) => a.id === id)
        if (!def) continue
        const pb = new Map<string, BuffLayer>()
        const atk = makeBenchChar('A', '甲', weapon, pb)
        const defc = makeBenchChar('B', '乙', getWeapon(DEFENDER_WEAPON), pb)
        const state: BattleState = {
            pendingBuffs: pb,
            position: { distance: () => 4 },
            turn: { currentTime: 0 },
            characters: [atk, defc],
        } as never
        const est = calcExpectedDamage(def, atk, defc, weapon.range, state)
        total += Math.round(est.expectedDamage * 10) / 10
    }
    return Math.round(total * 10) / 10
}

interface WeaponScore {
    damage: { avg: number; delta: number }
    attr: { mods: Record<string, number>; score: number }
    summon: { count: number; perSummon: number; total: number }
    yuwu: { apPerSec: number; score: number }
    distance: { span: number; score: number }
    grant: number
    tag: { count: number; score: number }
    trigger: number
    total: number
}

/** 武器总分 = 属性分 + 伤害分 + 距离分 + 授招分 + 标签分 + 触发分。
 *  御物武器：伤害分 = 召唤物输出（替代普攻，御物不打普攻）+ 耗炁扣分。
 */
function calcWeaponScore(weapon: WeaponDef): WeaponScore {
    const damage = calcDamageScore(weapon)
    const attr = calcAttrScore(weapon)
    const summon = calcSummonScore(weapon)
    const yuwu = calcYuwuCost(weapon)
    const distance = calcDistanceScore(weapon)
    const grant = calcGrantScore(weapon)
    const tag = calcTagScore(weapon)
    const trigger = calcTriggerScore(weapon)
    // 御物武器：召唤物输出替代普攻期望伤（召唤物是它的攻击方式），耗炁扣分
    const damagePart = summon.total > 0 ? summon.total + yuwu.score : damage.avg
    const total = Math.round(
        (attr.score + damagePart + distance.score + grant + tag.score + trigger) * 10,
    ) / 10
    return { damage, attr, summon, yuwu, distance, grant, tag, trigger, total }
}

/** 全部武器（数据武器 + 初始武器） */
function getAllWeapons(): WeaponDef[] {
    return [...WEAPON_DB, ...STARTING_WEAPONS]
}

export function WeaponCompare() {
    const [search, setSearch] = useState('')

    const rows = useMemo(() => {
        const query = search.trim().toLocaleLowerCase()
        return getAllWeapons()
            .map((w) => ({ weapon: w, score: calcWeaponScore(w) }))
            .filter(({ weapon }) =>
                query ? [weapon.name, weapon.id, ...weapon.tags].some((v) => v.toLocaleLowerCase().includes(query)) : true,
            )
            .sort((a, b) => b.score.total - a.score.total)
    }, [search])

    return (
        <div className="wc">
            <h2>武器评分对比</h2>
            <div className="wc-controls">
                <label className="wc-label wc-search-label" htmlFor="weapon-compare-search">
                    搜索：
                </label>
                <input
                    id="weapon-compare-search"
                    className="wc-search-input"
                    type="search"
                    value={search}
                    placeholder="名称 / ID / 标签"
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <p className="wc-note">
                双方全属性 15 · 同一招式基准挥击（伤害吃全部属性、系数一致）。属性分 = Σ 属性增减 × 1（1 点
                = 1 分，可为负）；伤害分 = 真实属性下基准招式可及档平均期望伤（绝对量）；距离分 = 可及档数 ×
                固定值；召唤分 = 御物召唤物输出（0AP 免费）；触发分 = 触发概率 × 效果价值；授招/标签分 = 配招面加分。
            </p>
            <table className="wc-table">
                <thead>
                    <tr>
                        <th>武器</th>
                        <th>属性</th>
                        <th>伤害Δ</th>
                        <th>召唤</th>
                        <th>耗炁</th>
                        <th>距离分</th>
                        <th>授招</th>
                        <th>标签</th>
                        <th>触发</th>
                        <th>总分</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ weapon, score }) => (
                        <tr key={weapon.id}>
                            <td className="wc-name">
                                <EntityItem entity={weapon} type="weapon" />
                            </td>
                            <td className={score.attr.score < 0 ? 'wc-delta-neg' : score.attr.score > 0 ? 'wc-delta' : undefined}>
                                {score.attr.score === 0 ? '—' : score.attr.score > 0 ? `+${score.attr.score}` : score.attr.score}
                            </td>
                            <td className={score.damage.delta !== 0 ? (score.damage.delta > 0 ? 'wc-delta' : 'wc-delta-neg') : undefined}>
                                {score.damage.delta === 0 ? '—' : score.damage.delta > 0 ? `+${score.damage.delta}` : score.damage.delta}
                            </td>
                            <td>{score.summon.total > 0 ? score.summon.total : '—'}</td>
                            <td className="wc-delta-neg">{score.yuwu.apPerSec > 0 ? score.yuwu.score : '—'}</td>
                            <td>{score.distance.score}<span className="wc-dim">（跨{score.distance.span}）</span></td>
                            <td>{score.grant > 0 ? score.grant : '—'}</td>
                            <td>{score.tag.count > 0 ? `${score.tag.score}(${score.tag.count})` : '—'}</td>
                            <td>{score.trigger !== 0 ? score.trigger : '—'}</td>
                            <td className="wc-score">{score.total}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
