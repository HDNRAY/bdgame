// ════════════════════════════════════════
//  ActionCompare — 招式 AP 档横向对比（DevMode）
//  移植 scripts/compare-ap.ts：
//    - AP 成本为多选过滤（选中几档就对比几档，0-5AP 可任意勾选）
//    - 不再特例"顺水推舟"——选中 4AP 自然包含它（它是 4AP 招式）
//  口径与脚本一致：全属性 15 · 缠 50 · 满 AP · 49% 血(斩杀档 25%) · 距离 4
// ════════════════════════════════════════

import { useMemo, useState } from 'react'
import { Character } from '../../../../engine/entities/character'
import { getWeapon, type WeaponDef } from '../../../../data/weapons/weapons'
import { PLAYER_ACTIONS } from '../../../../data/actions/player'
import { INTERNAL_ACTIONS } from '../../../../data/actions/internal'
import { QI_SKILLS } from '../../../../data/actions/qi'
import { calcExpectedDamage } from '../../../../engine/ai/expected-damage'
import type { BattleState } from '../../../../engine/combat/types'
import { MAX_CHAN, AI_CHAN_COST_WEIGHT } from '../../../../engine/constants'
import type { ActionDefinition } from '../../../../engine/entities/action'
import { EntityItem } from '../../../components/ui/EntityItem/EntityItem'
import './ActionCompare.scss'

const ATTRS = { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 }
const WEAPON_ID = 'po_lang_zhu_zhi' // 无属性加成，射程 [1,4]
const ALL_AP = [0, 1, 2, 3, 4, 5]

// 加分/惩罚系数（与 compare-ap.ts 一致）
const RANGE_BONUS_PER_STEP = 0.05
const DASH_BONUS = 0.25
const BUFF_VALUE = 0.3
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
    frost: 0.15,
    // burn: 0.1,
    // poison: 0.1,
    // bleed: 0.1,
}
const DISARM_WEIGHT = 0.4
const KNOCKBACK_PER_DIST = 0.2
const SELF_HP_COST_WEIGHT = 10

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
        maxCount: () => 4,
        actionId: '_fei_jian_shot',
    },
    description: '',
}

function makeChar(id: string, name: string): Character {
    const c = new Character({
        id,
        name,
        weapon: WEAPON_ID,
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
    exec: number // 斩杀（25% 斩杀档提升）
    multihit: number
    selfDisarm: number
    selfHpCost: number
    score: number
}

/** 单行：算效率/斩杀/加分/debuff/总分 */
function buildRow(a: ActionDefinition, rawAp: number, chanWeight: number): Row {
    const atk = makeChar('A', '甲')
    const def = makeChar('B', '乙')
    const baseWeapon = getWeapon(WEAPON_ID)
    // 基准武器模拟为重型（heavy）：燎天势等按重型武器加成的招式在对比中体现
    atk.weaponDef = { ...baseWeapon, tags: [...baseWeapon.tags, 'heavy'] }
    const weaponRange: [number, number] = baseWeapon.range

    const useSummon = a.id === 'wan_fa_gui_yi'
    const effAtk = atk
    let effRange: [number, number] = weaponRange
    if (useSummon) {
        atk.weaponDef = WANFA_SUMMON_WEAPON
        effRange = WANFA_SUMMON_WEAPON.range
    }

    const state: BattleState = {
        pendingBuffs: new Map(),
        position: { distance: () => 4 },
        turn: { currentTime: 0 },
        characters: [atk, def],
    } as never

    const est = calcExpectedDamage(a, effAtk, def, effRange, state)
    const netChan = est.chanCost * 0.8
    const resource = rawAp + chanWeight * netChan
    const efficiency = resource > 0 ? Math.round((est.expectedDamage / resource) * 100) / 100 : 0

    // 25% 斩杀档
    atk.hp = Math.round(atk.maxHp * EXEC_PCT * 10) / 10
    def.hp = Math.round(def.maxHp * EXEC_PCT * 10) / 10
    const est25 = calcExpectedDamage(a, effAtk, def, effRange, state)
    atk.hp = Math.round(atk.maxHp * HP_PCT * 10) / 10
    def.hp = Math.round(def.maxHp * HP_PCT * 10) / 10
    const eff25 = resource > 0 ? Math.round((est25.expectedDamage / resource) * 100) / 100 : 0
    const exec = Math.max(0, Math.round((eff25 - efficiency) * 100) / 100)

    // 加分
    const staticRange = a.getRange?.(weaponRange, atk) ?? weaponRange
    const rangeMax = staticRange[1]
    const hasDash = (a.effects ?? []).some((e) => e.type === 'short_dash' || e.type === 'dash')
    const distanceBonus = Math.max(0, Math.round((rangeMax - 4) * RANGE_BONUS_PER_STEP * 100)) / 100
    const dashBonus = hasDash ? DASH_BONUS : 0

    let buff = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'add_buff') buff += (e.stacks ?? 1) * BUFF_VALUE
    }
    let debuff = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'add_debuff') {
            const w = DEBUFF_WEIGHT[e.buffId] ?? 0
            if (w > 0) debuff += (e.stacks ?? 1) * (e.chance ?? 1) * w
        }
    }
    let disarm = 0
    let knockback = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'disarm') disarm += (e.chance ?? 1) * DISARM_WEIGHT
        if (e.type === 'knockback') knockback += e.distance * KNOCKBACK_PER_DIST
    }
    let hits = 1
    for (const e of a.effects ?? []) {
        if (e.type === 'damage' || e.type === 'fixed_damage') hits = Math.max(hits, e.independentHits ?? 1)
    }
    const multiHit = hits > 1 ? Math.min(MULTIHIT_CAP, Math.round((hits - 1) * MULTIHIT_PER_EXTRA * 100) / 100) : 0
    let selfRatio = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'self_hp_cost' || e.type === 'self_damage') selfRatio += e.ratio
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
    const [selected, setSelected] = useState<number[]>([2, 3, 4, 5])
    const [chanWeight, setChanWeight] = useState<number>(AI_CHAN_COST_WEIGHT)
    const [search, setSearch] = useState('')

    const toggleAp = (ap: number) => {
        setSelected((prev) => (prev.includes(ap) ? prev.filter((x) => x !== ap) : [...prev, ap].sort((a, b) => a - b)))
    }

    const rows = useMemo<Row[]>(() => {
        if (selected.length === 0) return []
        const isSupport = (a: ActionDefinition) => a.tags.includes('pre_action') || a.tags.includes('post_action')
        const query = search.trim().toLocaleLowerCase()
        const all = [...PLAYER_ACTIONS, ...INTERNAL_ACTIONS, ...QI_SKILLS]
        return all
            .filter((a) => {
                if (!selected.includes(a.apCost) || isSupport(a)) return false
                if (!query) return true
                return [a.name, a.id, ...a.tags].some((value) => value.toLocaleLowerCase().includes(query))
            })
            .map((a) => buildRow(a, a.apCost, chanWeight))
            .sort((x, y) => y.score - x.score)
    }, [selected, chanWeight, search])

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
                <span className="ac-label ac-label-chan">缠权重：</span>
                <input
                    className="ac-chan-input"
                    type="number"
                    step={0.1}
                    value={chanWeight}
                    onChange={(e) => setChanWeight(Number(e.target.value) || 0)}
                />
                <label className="ac-label ac-search-label" htmlFor="action-compare-search">
                    搜索：
                </label>
                <input
                    id="action-compare-search"
                    className="ac-search-input"
                    type="search"
                    value={search}
                    placeholder="名称 / ID / 标签"
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <p className="ac-note">
                双方全属性 15 · 缠 50 · 满 AP · 49% 血（斩杀档 25%）· 距离 4 · 基准武器 po_lang_zhu_zhi（按重型）。 效率
                = 期望伤 /（折前AP + 缠权重×缠消耗）；得分 = 效率 + 射程（{'>'}4 每档+0.05）+ 位移（+0.25） +
                buff（add_buff 每层×0.3）+ debuff（层×几率×权重）+ 缴械（×0.4）+ 击退（距离×0.2） + 斩杀（25%
                斩杀档提升）+ 多段（每段+0.25 封顶+2）− 自缴械（−1）− 自耗血（比例×10）。
            </p>
            {rows.length === 0 ? (
                <p className="ac-note">请至少勾选一个 AP 档。</p>
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
