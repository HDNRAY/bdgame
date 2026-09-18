// ════════════════════════════════════════
//  ActionCompare — 招式 AP 档横向对比（DevMode）
//    - AP 成本为多选过滤（选中几档就对比几档，0-5AP 可任意勾选）
//    - 标签多选过滤（OR：命中任一即保留；选项只列候选池里实际出现过的 tag）
//    - 不再特例"顺水推舟"——选中 4AP 自然包含它（它是 4AP 招式）
//  口径：全属性 15 · 缠 50 · 满 AP · 49% 血(斩杀档 25%) · 距离 4
// ════════════════════════════════════════

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Character } from '../../../../engine/entities/character'
import { makeEvalState } from '../makeEvalState'
import type { WeaponDef } from '../../../../data/weapons/weapons'
import { STARTING_WEAPONS } from '../../../../data/weapons/starting-weapons'
import { sumBuffScore, BUFF_SCORE_NOTE, applyCompareDefense, COMPARE_DEFENSE_NOTE } from '../compare-utils'
import { calcExpectedDamage } from '../../../../engine/ai/expected-damage'
import { MAX_CHAN } from '../../../../engine/constants'
import type { Tag } from '../../../../engine/entities/tag'
import { calcChanCostInAp } from '../../../../engine/calc/chan-value'
import type { ActionDefinition } from '../../../../engine/entities/action'
import { EntityItem } from '../../../components/ui/EntityItem/EntityItem'
import { TAG_CN } from '../../../../bridge/tagDisplay'
import './ActionCompare.scss'
import { allMainActions } from '../../../../engine'
import { collectTagOptions, filterActions, getCandidateActions, parseTagParam } from './filter'

const ATTRS = { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 }
// 兜底武器：无属性加成的中性空手（真实 bare_hands 自带 +2 身法会污染伤害评估，这里造一把"计算用空手"）
const CALC_BARE_HANDS: WeaponDef = {
    id: '_calc_bare_hands',
    name: '空手（评估）',
    description: 'compare 专用中性空手，无属性加成。',
    tags: ['unarmed'],
    range: [0, 2],
}
const ALL_AP = [0, 1, 2, 3, 4, 5]

/** 候选池 = 对比表展示的招式全集（全部主招，去掉前置/后置辅助招） */
const CANDIDATE_ACTIONS = getCandidateActions(allMainActions)
/** 标签选项：只列候选池里实际出现过的 tag（不铺满 53 种），按 tagDisplay 中文名排序 */
const TAG_OPTIONS: Tag[] = collectTagOptions(CANDIDATE_ACTIONS)
const TAG_OPTION_SET = new Set<Tag>(TAG_OPTIONS)

// 加分/惩罚系数
// 射程/位移统一单价：位移 1 米 ≈ 射程 1 米（都能扩大这招的打击范围，同价计）
const DIST_BONUS_PER_M = 0.2
/** 射程下限 0 = 贴脸也能打（被贴身不丢输出）的固定加分（旧口径等于 1 米射程） */
const REACH_ZERO_BONUS = 0.3
const SELF_DISARM_PENALTY = 1
const MULTIHIT_PER_EXTRA = 0.25
const MULTIHIT_CAP = 2
const DEBUFF_WEIGHT: Record<string, number> = {
    stun: 0.6,
    knockdown: 0.4,
    paralyze: 0.3,
    sand_blind: 0.3,
    fumble_chance_temp: 0.3,
    duan_qi: 0.2,
    confuse: 0.2,
    frost: 0.15,
    burn: 0.1,
    poison: 0.1,
    bleed: 0.1,
}
const DISARM_WEIGHT = 0.4
const KNOCKBACK_PER_DIST = 0.2
const SELF_HP_COST_WEIGHT = 10
/** 汲取（stat_transfer）：己方 +X 属性（按 1分/点）+ 对方 -X 属性（按 0.5分/点），暂时性效果合并折半 */
const STAT_TRANSFER_VALUE = 1.5

const HP_PCT = 0.49
const EXEC_PCT = 0.25

/** 万法归一：fn 依赖 weaponDef.summon，无召唤物时估算为 0 → 挂合成御物武器按 4 个飞剑召唤物估 */
const WANFA_SUMMON_WEAPON: WeaponDef = {
    id: '_compare_wanfa',
    name: '测试御物剑',
    tags: ['imperial', 'range', 'summon'],
    range: [0, 10],
    summon: {
        id: '_compare_wanfa_summon',
        name: '测试飞剑',
        maxCount: () => 3,
        actionId: '_orb_shot',
    },
    description: '',
}

function makeChar(id: string, name: string): Character {
    const c = new Character({
        id,
        name,
        // 初始武器仅用于构造（buildRow 会按 requiredTags 覆盖为评估武器）
        weapon: 'bare_hands',
        battleStyle: 'melee' as const,
        baseAttrs: { ...ATTRS },
        rewards: [],
    })
    for (const [k, v] of Object.entries(ATTRS)) c.attrs.set(k as never, v)
    c.chan = MAX_CHAN
    c.ap = c.maxAp
    c.hp = Math.round(c.maxHp * HP_PCT * 10) / 10
    return c
}

interface Row {
    action: ActionDefinition
    label: string
    ap: number
    chan: number
    damage: number
    efficiency: number
    distance: number // 射程加分（射程>4 每档）
    dash: number // 位移加分
    buff: number
    debuff: number
    disarm: number
    knockback: number
    transfer: number // 汲取（stat_transfer）：己方+属性、对方-属性
    exec: number // 斩杀（25% 斩杀档提升）
    multihit: number
    selfDisarm: number
    selfHpCost: number
    score: number
}

/** 单行：算效率/斩杀/加分/debuff/总分（chanNow = 基准缠劲，缠成本按阈值感知模型折算） */
function buildRow(a: ActionDefinition, rawAp: number, chanNow: number): Row {
    const atk = makeChar('A', '甲')
    const def = makeChar('B', '乙')
    // 按 requiredTags 从初始武器池匹配评估武器（找不到或无要求 → 中性空手）
    const reqTags = a.requiredTags ?? []
    const matched =
        reqTags.length > 0 ? STARTING_WEAPONS.find((w) => reqTags.every((t) => w.tags.includes(t))) : undefined
    const baseWeapon = matched ?? CALC_BARE_HANDS
    // 基准武器模拟为重型（heavy）：燎天势等按重型武器加成的招式在对比中体现
    atk.weaponDef = { ...baseWeapon, tags: [...new Set([...baseWeapon.tags, 'heavy'])] as Tag[] }
    const weaponRange: [number, number] = baseWeapon.range

    const useSummon = a.id === 'wan_fa_gui_yi'
    const effAtk = atk
    let effRange: [number, number] = weaponRange
    if (useSummon) {
        atk.weaponDef = WANFA_SUMMON_WEAPON
        effRange = WANFA_SUMMON_WEAPON.range
    }

    const state = makeEvalState(atk, def, { distance: 4 })
    // 双方各挂 10% 全减伤（石肤），模拟真实对局双方都有防御
    applyCompareDefense(state, atk, def)

    const est = calcExpectedDamage(a, effAtk, def, effRange, state, undefined, { applyDefenseReduction: true })
    const chanCost = calcChanCostInAp(chanNow, est.chanCost)
    const resource = rawAp + chanCost
    const efficiency = resource > 0 ? Math.round((est.expectedDamage / resource) * 100) / 100 : 0

    // 25% 斩杀档
    atk.hp = Math.round(atk.maxHp * EXEC_PCT * 10) / 10
    def.hp = Math.round(def.maxHp * EXEC_PCT * 10) / 10
    const est25 = calcExpectedDamage(a, effAtk, def, effRange, state, undefined, { applyDefenseReduction: true })
    atk.hp = Math.round(atk.maxHp * HP_PCT * 10) / 10
    def.hp = Math.round(def.maxHp * HP_PCT * 10) / 10
    const eff25 = resource > 0 ? Math.round((est25.expectedDamage / resource) * 100) / 100 : 0
    const exec = Math.max(0, Math.round((eff25 - efficiency) * 100) / 100)

    // 加分
    const staticRange = a.getRange?.(weaponRange, atk) ?? weaponRange
    const rangeMax = staticRange[1]
    // 位移加分：按最大位移距离缩放（short_dash 用 maxDistance，dash 用 maxRange；多段位移取最大）
    let dashDist = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'short_dash') dashDist = Math.max(dashDist, e.maxDistance ?? 0)
        if (e.type === 'dash') dashDist = Math.max(dashDist, e.maxRange ?? 0)
    }
    // 射程/位移同价：射程超 4m 每米 +0.2，短于 4m 每米 -0.2（0-1 贴脸短打减分）；位移每米 +0.2。
    // 射程下限 0 = 贴脸也能打（被贴身不丢输出）→ 额外 +0.3。
    const reachZeroBonus = staticRange[0] <= 0 ? REACH_ZERO_BONUS : 0
    const distanceBonus = Math.round((rangeMax - 4) * DIST_BONUS_PER_M * 100) / 100 + reachZeroBonus
    const dashBonus = Math.round(dashDist * DIST_BONUS_PER_M * 100) / 100

    const buff = sumBuffScore(a.effects)
    let debuff = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'add_debuff') {
            const w = DEBUFF_WEIGHT[e.buffId] ?? 0
            if (w > 0) debuff += (e.stacks ?? 1) * (e.chance ?? 1) * w
        }
    }
    let disarm = 0
    let knockback = 0
    let transfer = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'disarm') disarm += (e.chance ?? 1) * DISARM_WEIGHT
        if (e.type === 'knockback') knockback += e.distance * KNOCKBACK_PER_DIST
        if (e.type === 'stat_transfer') transfer += (e.value ?? 1) * STAT_TRANSFER_VALUE
    }
    let hits = 1
    for (const e of a.effects ?? []) {
        if (e.type === 'damage') hits = Math.max(hits, e.independentHits ?? 1)
    }
    const multiHit = hits > 1 ? Math.min(MULTIHIT_CAP, Math.round((hits - 1) * MULTIHIT_PER_EXTRA * 100) / 100) : 0
    let selfRatio = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'self_hp_cost' || e.type === 'self_damage') selfRatio += e.ratio
    }
    // 自爆等把失血（blood_loss）挂到自己身上：每秒扣2%当前血（最少1点），按典型剩余12s折算扣血比例
    // 累计扣血 = 1 - 0.98^12 ≈ 22% 血量（指数衰减），经 SELF_HP_COST_WEIGHT 折算成自伤分
    for (const e of a.effects ?? []) {
        if (e.type === 'add_buff' && e.buffId === 'blood_loss') selfRatio += 0.22 // 失血每秒2%×12s≈22%
    }
    const selfDisarm = (a.effects ?? []).some((e) => e.type === 'self_disarm') ? SELF_DISARM_PENALTY : 0
    const selfHpCost = Math.round(selfRatio * SELF_HP_COST_WEIGHT * 100) / 100

    const execTotal = Math.round((exec + multiHit) * 100) / 100
    const score =
        Math.round(
            (efficiency +
                distanceBonus +
                dashBonus +
                buff +
                debuff +
                disarm +
                knockback +
                transfer +
                execTotal -
                selfDisarm -
                selfHpCost) *
                100,
        ) / 100

    return {
        action: a,
        label: a.name,
        ap: a.apCost,
        chan: Math.round(est.chanCost * 10) / 10,
        damage: Math.round(est.expectedDamage * 10) / 10,
        efficiency,
        distance: distanceBonus,
        dash: dashBonus,
        buff: Math.round(buff * 100) / 100,
        debuff: Math.round(debuff * 100) / 100,
        disarm: Math.round(disarm * 100) / 100,
        knockback: Math.round(knockback * 100) / 100,
        transfer: Math.round(transfer * 100) / 100,
        exec: execTotal,
        multihit: multiHit,
        selfDisarm,
        selfHpCost,
        score,
    }
}

const fmt = (v: number, plus = false): string => {
    if (v === 0) return '—'
    return `${plus && v > 0 ? '+' : ''}${v.toFixed(2)}`
}

export function ActionCompare() {
    // 状态持久化到 URL（?ap=2,3,4,5&chan=35&q=…），HMR 重挂载/切 tab 后从 URL 恢复，不丢过滤条件
    const [searchParams, setSearchParams] = useSearchParams()

    const selected: number[] = useMemo(() => {
        const raw = searchParams.get('ap')
        if (!raw) return []
        return raw
            .split(',')
            .map((s) => Number(s))
            .filter((n) => ALL_AP.includes(n))
    }, [searchParams])

    const chanNow: number = useMemo(() => {
        const raw = Number(searchParams.get('chan') ?? 35)
        return Number.isFinite(raw) ? Math.min(MAX_CHAN, Math.max(0, raw)) : 35
    }, [searchParams])

    // 标签多选（?tags=stun,paralyze）：与 AP 同样走 URL，分享/刷新/HMR 不丢；脏值（不在候选池）丢弃
    const selectedTags: Tag[] = useMemo(() => parseTagParam(searchParams.get('tags'), TAG_OPTION_SET), [searchParams])

    // 搜索词：本地 state 实时输入（IME 组合不被 URL 重渲染打断——受控 value 直接绑 URL 时，
    // 中文输入每键触发 setSearchParams 重渲染，组合中的拼音被 URL 旧值覆盖 → 输入即消失），
    // 失焦（blur）时才写回 URL（保留 ?q= 持久化/HMR 恢复；输入过程中不写 URL）
    const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '')
    const search: string = searchInput
    const commitSearch = (v: string) => patchParams({ q: v || null })

    const patchParams = (patch: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams)
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '') next.delete(k)
            else next.set(k, v)
        }
        setSearchParams(next, { replace: true })
    }

    const toggleAp = (ap: number) => {
        const next = selected.includes(ap) ? selected.filter((x) => x !== ap) : [...selected, ap].sort((a, b) => a - b)
        patchParams({ ap: next.length > 0 ? next.join(',') : null })
    }

    // 选中项按 TAG_OPTIONS（中文名）顺序写回 URL，链接稳定可分享
    const toggleTag = (tag: Tag) => {
        const next = selectedTags.includes(tag)
            ? selectedTags.filter((t) => t !== tag)
            : TAG_OPTIONS.filter((t) => t === tag || selectedTags.includes(t))
        patchParams({ tags: next.length > 0 ? next.join(',') : null })
    }

    const clearTags = () => patchParams({ tags: null })

    const rows = useMemo<Row[]>(() => {
        // AP（多选）× 标签（OR）× 搜索 串联：三者都生效，任一不通过即剔除
        return filterActions(CANDIDATE_ACTIONS, { ap: selected, tags: selectedTags, query: search })
            .map((a) => buildRow(a, a.apCost, chanNow))
            .sort((x, y) => y.score - x.score)
    }, [selected, selectedTags, chanNow, search])

    return (
        <div className="ac">
            <h2>招式 AP 档对比</h2>
            <div className="ac-controls">
                <span className="ac-label">AP 档（多选）：</span>
                {ALL_AP.map((ap) => (
                    <label key={ap} className={`ac-chip${selected.includes(ap) ? ' ac-chip-on' : ''}`}>
                        <input type="checkbox" checked={selected.includes(ap)} onChange={() => toggleAp(ap)} />
                        {ap}AP
                    </label>
                ))}
                <span className="ac-label ac-label-chan">基准缠劲：</span>
                <input
                    className="ac-chan-input"
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={chanNow}
                    onChange={(e) => patchParams({ chan: e.target.value })}
                />
                <span className="ac-chan-value">{chanNow}</span>
                <label className="ac-label ac-search-label" htmlFor="action-compare-search">
                    搜索：
                </label>
                <input
                    id="action-compare-search"
                    className="ac-search-input"
                    type="search"
                    value={search}
                    placeholder="名称 / ID / 标签"
                    onChange={(e) => setSearchInput(e.target.value)}
                    onBlur={(e) => commitSearch(e.target.value)}
                />
            </div>
            {/* 标签多选：选项只列候选池里实际存在的 tag，纯中文名文字（不用 Tag 徽章，避免一屏几十个彩色块） */}
            <div className="ac-controls ac-controls-tags">
                <span className="ac-label">标签（多选）：</span>
                {TAG_OPTIONS.map((tag) => (
                    <label key={tag} className={`ac-chip${selectedTags.includes(tag) ? ' ac-chip-on' : ''}`}>
                        <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} />
                        {TAG_CN[tag] ?? tag}
                    </label>
                ))}
                <button type="button" className="ac-clear" onClick={clearTags} disabled={selectedTags.length === 0}>
                    清空
                </button>
                <span className="ac-label">（命中任一即保留）</span>
            </div>
            <p className="ac-note">
                双方全属性 15 · 满 AP · 49% 血（斩杀档 25%）· 距离 4 · 基准武器 po_lang_zhu_zhi（按重型）。{' '}
                {COMPARE_DEFENSE_NOTE}，期望伤已按防御方减伤折算。 效率 = 期望伤 /（折前AP +
                缠成本）；缠成本按阈值感知模型折算（基准缠劲可调，默认 35：缠越满越便宜， 跌破 30/50 丢「周」buff
                加重成本）。得分 = 效率 + 射程（4m 为基准，每±1m ∓{DIST_BONUS_PER_M}；射程下限 0 可贴脸打 +
                {REACH_ZERO_BONUS}）+ 位移（每米+{DIST_BONUS_PER_M}，与射程同价） +{BUFF_SCORE_NOTE} +
                debuff（层×几率×权重）+ 缴械（×0.4）+ 击退 （距离×0.2） + 汲取（stat_transfer 每点×1.5）+ 斩杀（25%
                斩杀档提升）+ 多段（每段+0.25 封顶+2）− 自缴械（−1）− 自耗血（比例×10）。
            </p>
            {rows.length === 0 ? (
                <p className="ac-note">无匹配招式（当前 AP 档 / 标签 / 搜索条件无结果）。</p>
            ) : (
                <table className="ac-table">
                    <thead>
                        <tr>
                            <th>招式</th>
                            <th>AP</th>
                            <th>缠</th>
                            <th>期望伤</th>
                            <th>效率</th>
                            <th>射程</th>
                            <th>位移</th>
                            <th>buff</th>
                            <th>debuff</th>
                            <th>缴械</th>
                            <th>击退</th>
                            <th>汲取</th>
                            <th>斩杀</th>
                            <th>多段</th>
                            <th>自缴械</th>
                            <th>自耗血</th>
                            <th>得分</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.label}>
                                <td className="ac-name">
                                    <EntityItem entity={r.action} type="action" />
                                </td>
                                <td>{r.ap}</td>
                                <td>{r.chan}</td>
                                <td>{r.damage}</td>
                                <td>{r.efficiency}</td>
                                <td>{fmt(r.distance, true)}</td>
                                <td>{fmt(r.dash, true)}</td>
                                <td>{fmt(r.buff, true)}</td>
                                <td>{fmt(r.debuff, true)}</td>
                                <td>{fmt(r.disarm, true)}</td>
                                <td>{fmt(r.knockback, true)}</td>
                                <td>{fmt(r.transfer, true)}</td>
                                <td>{fmt(r.exec, true)}</td>
                                <td>{fmt(r.multihit, true)}</td>
                                <td>{fmt(r.selfDisarm)}</td>
                                <td>{fmt(r.selfHpCost)}</td>
                                <td className="ac-score">{r.score}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}
