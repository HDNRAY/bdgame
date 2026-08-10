// npx tsx scripts/compare-ap.ts 5   ← 5AP 档（含 4AP 顺水推舟特例）
// npx tsx scripts/compare-ap.ts 2   ← 2AP 档
/// 横向对比指定 AP 档所有招式的期望伤害与资源效率（单文件，参数选档）
/// 双方：全属性 15，缠 50，满 AP，49% 血，距离 4
import { Character } from '../src/engine/entities/character'
import { getWeapon } from '../src/data/weapons/weapons'
import type { WeaponDef } from '../src/data/weapons/weapons'
import { PLAYER_ACTIONS } from '../src/data/actions/player'
import { INTERNAL_ACTIONS } from '../src/data/actions/internal'
import { calcExpectedDamage } from '../src/engine/ai/expected-damage'
import type { BattleState } from '../src/engine/combat/types'
import { MAX_CHAN, AI_CHAN_COST_WEIGHT } from '../src/engine/constants'
import type { ActionDefinition } from '../src/engine/entities/action'

const ATTRS = { strength: 15, vitality: 15, agility: 15, dexterity: 15, insight: 15, wisdom: 15 }
const WEAPON_ID = 'po_lang_zhu_zhi' // 无属性加成，射程 [1,4]

function makeChar(id: string, name: string): Character {
    const c = new Character({
        id,
        name,
        weapon: WEAPON_ID,
        baseAttrs: { ...ATTRS },
        rewards: [],
    })
    // 强制纯属性（防御任何构造期加成）
    for (const [k, v] of Object.entries(ATTRS)) c.attrs.set(k as never, v)
    c.chan = MAX_CHAN
    c.ap = c.maxAp
    c.hp = Math.round(c.maxHp * 0.49 * 10) / 10
    return c
}

const atk = makeChar('A', '甲')
const def = makeChar('B', '乙')
const weaponRange = getWeapon(WEAPON_ID).range

// 万法归一：fn 依赖 weaponDef.summon，无召唤物时估算为 0 → 挂合成御物武器按 4 个飞剑召唤物估
const WANFA_SUMMON_WEAPON: WeaponDef = {
    id: '_compare_wanfa',
    name: '测试御物剑',
    tags: ['imperial', 'range', 'summon'],
    range: [0, 10],
    summon: {
        id: '_compare_wanfa_summon',
        name: '测试飞剑',
        maxCount: () => 4,
        actionId: '_fei_jian_shot', // 一剑西来：wis0.5 + base5 的单剑基准
    },
    description: '',
}
const wanfaAtk = makeChar('A', '甲')
wanfaAtk.weaponDef = WANFA_SUMMON_WEAPON

const state: BattleState = {
    pendingBuffs: new Map(),
    position: { distance: () => 4 },
    turn: { currentTime: 0 },
    characters: [atk, def],
} as never

// 缠权重：单一来源 = 引擎 AI_CHAN_COST_WEIGHT（改一个常量，AI 行为与对比口径同步变）
// 手动覆盖：npx tsx scripts/compare-ap.ts 5 1
const CHAN_WEIGHT = Number(process.argv[3] ?? AI_CHAN_COST_WEIGHT)
const HP_PCT = 0.49 // 基准测试双方血量
const EXEC_PCT = 0.25 // 斩杀档双方血量（残血/斩杀/低血必中必暴类招式会在这档涨）
// 加分系数（可调）：射程每超出 4 米 +RANGE_BONUS_PER_STEP；带位移 +DASH_BONUS
const RANGE_BONUS_PER_STEP = 0.05
const DASH_BONUS = 0.25
/** 增益（add_buff）每层价值分 */
const BUFF_VALUE = 0.3

// debuff 价值：每层 × 几率 × 权重，折算进总分（效率点口径）。
// DoT(burn/poison/bleed) 引擎已把 stacks×3 计入期望伤，权重从低避免重复；控制类 debuff 权重高。
const DEBUFF_WEIGHT: Record<string, number> = {
    stun: 0.6,
    knockdown: 0.4,
    paralyze: 0.3,
    sand_blind: 0.3,
    fumble_chance_temp: 0.3,
    duan_qi: 0.2,
    frost: 0.15,
    burn: 0.1,
    poison: 0.1,
    bleed: 0.1,
}
function debuffValue(a: ActionDefinition): number {
    let v = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'add_debuff') {
            const w = DEBUFF_WEIGHT[e.buffId] ?? 0
            if (w > 0) v += (e.stacks ?? 1) * (e.chance ?? 1) * w
        }
    }
    return Math.round(v * 100) / 100
}

// 增益价值：add_buff 每层 × BUFF_VALUE（独立列，不进期望伤）
function buffValue(a: ActionDefinition): number {
    let v = 0
    for (const e of a.effects ?? []) {
        if (e.type === 'add_buff') v += (e.stacks ?? 1) * BUFF_VALUE
    }
    return Math.round(v * 100) / 100
}

// 归一：所有招式统一判断范围是否够到距离 4
// buildRow：算单行效率/斩杀/加分/debuff/总分（rawAp = 该招折前 AP）
function buildRow(a: ActionDefinition, rawAp: number, label?: string) {
    // 万法归一按 4 召唤物估（挂合成御物武器）；其余用基准角色
    const useSummon = a.id === 'wan_fa_gui_yi'
    const effAtk = useSummon ? wanfaAtk : atk
    const effRange: [number, number] = useSummon ? WANFA_SUMMON_WEAPON.range : weaponRange
    const est = calcExpectedDamage(a, effAtk, def, effRange, state)
    // 效率 = 期望伤 / (折前AP + 缠权重×缠消耗)
    const resource = rawAp + CHAN_WEIGHT * est.chanCost
    const efficiency = resource > 0 ? Math.round((est.expectedDamage / resource) * 100) / 100 : 0
    // 25% 血斩杀档：双方降到 25% 血重算，期望伤提升部分折算成 exec 加分（越残越强的招吃得到）
    atk.hp = Math.round(atk.maxHp * EXEC_PCT * 10) / 10
    def.hp = Math.round(def.maxHp * EXEC_PCT * 10) / 10
    const est25 = calcExpectedDamage(a, effAtk, def, effRange, state)
    atk.hp = Math.round(atk.maxHp * HP_PCT * 10) / 10
    def.hp = Math.round(def.maxHp * HP_PCT * 10) / 10
    const eff25 = resource > 0 ? Math.round((est25.expectedDamage / resource) * 100) / 100 : 0
    const exec = Math.max(0, Math.round((eff25 - efficiency) * 100) / 100)
    // 加分（用静态射程：招式自身getRange或武器射程，不含dash，避免与位移重复计分）：射程按超出4米每档+0.05；带位移(short_dash/dash) +0.25
    const staticRange = a.getRange?.(weaponRange, atk) ?? weaponRange
    const rangeMax = staticRange[1]
    const hasDash = (a.effects ?? []).some((e) => e.type === 'short_dash' || e.type === 'dash')
    const distanceBonus = Math.max(0, Math.round((rangeMax - 4) * RANGE_BONUS_PER_STEP * 100)) / 100
    const dashBonus = hasDash ? DASH_BONUS : 0
    const buff = buffValue(a)
    const debuff = debuffValue(a)
    const score = Math.round((efficiency + distanceBonus + dashBonus + buff + debuff + exec) * 100) / 100
    return { a, label: label ?? a.name, est, efficiency, rangeMax, hasDash, distanceBonus, dashBonus, buff, debuff, exec, score }
}

// ── 入口：按 CLI 参数选档 ──
const AP_COST = parseInt(process.argv[2] ?? '5', 10)
// 过滤辅助招（pre_action/post_action 不是主攻，不参与效率对比）
const isSupport = (a: ActionDefinition) => a.tags.includes('pre_action') || a.tags.includes('post_action')
// 5AP 档额外纳入 4AP 顺水推舟（保持 4AP 折前成本）
const extra: { action: ActionDefinition; rawAp: number; label: string }[] = []
if (AP_COST === 5) {
    const shunShui = PLAYER_ACTIONS.find((a) => a.id === 'follow_the_current')
    if (shunShui) extra.push({ action: shunShui, rawAp: 4, label: '顺水推舟·4AP' })
}

const rows = [
    ...PLAYER_ACTIONS.filter((a) => a.apCost === AP_COST && !isSupport(a)).map((a) => buildRow(a, AP_COST)),
    ...INTERNAL_ACTIONS.filter((a) => a.apCost === AP_COST && !isSupport(a)).map((a) => buildRow(a, AP_COST)),
    ...extra.map(({ action, rawAp, label }) => buildRow(action, rawAp, label)),
].sort((x, y) => y.score - x.score)

console.log('双方全属性15 · 缠50 · 满AP · 49%血(斩杀档25%) · 距离4')
console.log(`甲 HP ${atk.hp}/${atk.maxHp} AP${atk.maxAp} 缠${atk.chan} | 乙 HP ${def.hp}/${def.maxHp}`)
const extraNote = extra.length > 0 ? `；额外纳入 ${extra.map((e) => `${e.label}(${e.rawAp}AP)`).join('/')}` : ''
console.log(
    `效率 = 期望伤 / (折前AP + 缠权重 ${CHAN_WEIGHT} × 缠)；${AP_COST}AP招折前AP=${AP_COST}${extraNote}；得分 = 效率 + 距离(射程>4每档+0.05) + 位移(+0.25) + buff(每层${BUFF_VALUE}) + debuff(层×几率×权重) + exec(25%斩杀档)`,
)
const tableData: Record<string, Record<string, string | number>> = {}
for (const { label, est, efficiency, distanceBonus, dashBonus, buff, debuff, exec, score } of rows) {
    tableData[label] = {
        缠: est.chanCost,
        期望伤: Math.round(est.expectedDamage * 10) / 10,
        效率: efficiency,
        距离: distanceBonus > 0 ? `+${distanceBonus.toFixed(2)}` : '—',
        位移: dashBonus > 0 ? `+${dashBonus.toFixed(2)}` : '—',
        buff: buff > 0 ? `+${buff.toFixed(2)}` : '—',
        debuff: debuff > 0 ? `+${debuff.toFixed(2)}` : '—',
        exec: exec > 0 ? `+${exec.toFixed(2)}` : '—',
        得分: score,
    }
}
console.table(tableData)
console.log(
    '注：期望伤=引擎 calcExpectedDamage；含残血/破甲；距离=射程>4每档+0.05；位移=带位移+0.25；buff=add_buff每层×' + BUFF_VALUE + '；debuff=层×几率×权重；exec=25%斩杀档提升',
)
console.log(`缠权重可用参数覆盖：npx tsx scripts/compare-ap.ts ${AP_COST} 1`)
