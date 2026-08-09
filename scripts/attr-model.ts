import {
    calcBaseDamage,
    calcHitChance,
    calcParryChance,
    calcParriedDamage,
    calcCritChance,
    calcBaseCritDamage,
    calcApRegenPerSec,
    calcActionCostAfterSpeed,
} from '../src/engine/calc/damage'
import { calcMaxHp, calcMaxAp } from '../src/engine/calc/stats'
import { MAX_CHAN } from '../src/engine/constants'

/**
 * 属性价值模型（2026-08-09）
 *
 * 场景：1v1 对砍，两人都只有一招（消耗2AP、造成 0.4×力道 伤害），6 属性初始全 L。
 * 不考虑距离/移动/辅助招。概率全部取期望（不抽样）。
 *
 * 所有公式（命中/招架/暴击/AP/缠/气血）直接 import 引擎真实实现
 * （src/engine/calc/damage.ts、stats.ts、constants.ts）——改引擎公式，模型立即反映。
 * 事件循环复刻 engine.ts 原子回合：AP 满才行动、行动瞬间完成、
 * 下次行动 = (maxAp−剩余AP)/回复速率；缠劲 = 花AP+消耗量 + 受击30%伤害量；
 * ≥30缠「周」+1全属性（模型只算 1 层，忽略 50 缠的 2 层周）。
 *
 * 用法：npx tsx scripts/attr-model.ts
 */
const round1 = (v: number) => Math.round(v * 10) / 10

// 属性顺序
const ATTRS = ['力道', '根骨', '身法', '灵巧', '洞察', '推演'] as const
const IDX = { str: 0, vit: 1, agi: 2, dex: 3, ins: 4, wis: 5 }

const HP_MULT = 1000 // 血量放大，保证打满窗口

// ── 引擎公式（直接复用引擎实现，改引擎立即反映） ──
const baseDamage = (str: number) => calcBaseDamage({ strength: 0.4 }, { strength: str })
const hitChance = (adex: number, ains: number, bAgi: number, bIns: number) =>
    calcHitChance({ attackerDexterity: adex, attackerInsight: ains, defenderAgility: bAgi, defenderInsight: bIns })
const parryChance = (bDex: number, bIns: number) => calcParryChance(bDex, bIns)
const parriedDmg = (base: number, bStr: number) => calcParriedDamage(base, bStr)
const critChance = (adex: number, ains: number) => calcCritChance(adex, ains)
const apCostOf = (agi: number) => calcActionCostAfterSpeed(2, agi, 0)
const apRegenOf = (wis: number) => calcApRegenPerSec(wis)
const maxHpOf = (vit: number) => calcMaxHp(vit)
const maxApOf = (vit: number) => calcMaxAp(vit)

/** 单次命中的期望伤害：A 打 B（属性已含周加成） */
function expHit(a: number[], b: number[]): number {
    const base = baseDamage(a[IDX.str])
    const hit = hitChance(a[IDX.dex], a[IDX.ins], b[IDX.agi], b[IDX.ins])
    const parry = parryChance(b[IDX.dex], b[IDX.ins])
    const pd = parriedDmg(base, b[IDX.str])
    const crit = critChance(a[IDX.dex], a[IDX.ins])
    const critDmgMod = calcBaseCritDamage(a[IDX.dex]) // 含基础 0.5 爆伤
    return hit * ((1 - parry) * base + parry * pd) * (1 + crit * critDmgMod)
}

interface Fighter {
    base: number[] // [str,vit,agi,dex,ins,wis]
    zhou: number
    hp: number
    ap: number
    maxAp: number
    chan: number
    last: number
    next: number
    dealt: number
    taken: number
}

function makeFighter(
    base: number[],
    maxApBonus = 0,
    chanPerApExtra = 0,
    chanPerDmgExtra = 0,
    hpMult = HP_MULT,
): Fighter {
    const f: Fighter = {
        base,
        zhou: 0,
        hp: maxHpOf(base[IDX.vit]) * hpMult,
        ap: maxApOf(base[IDX.vit]) * 0.5 + maxApBonus,
        maxAp: maxApOf(base[IDX.vit]) + maxApBonus,
        chan: 0,
        last: 0,
        next: 0,
        dealt: 0,
        taken: 0,
    }
    ;(f as unknown as { cpa: number }).cpa = chanPerApExtra
    ;(f as unknown as { cpd: number }).cpd = chanPerDmgExtra
    return f
}

function applyZhou(f: Fighter): void {
    // 只考虑 1 层「周」（缠≥30，全属性+1）；忽略 50 缠的 2 层周
    f.zhou = f.chan >= 30 ? 1 : 0
}

function effAttrs(f: Fighter): number[] {
    return f.base.map((b) => b + f.zhou)
}

/** 事件模拟：窗口 windowMs 内，A/B 各累计 dealt/taken */
function simulate(
    a: Fighter,
    b: Fighter,
    windowMs: number,
): { dealtA: number; takenA: number; dealtB: number; takenB: number; endA: number; endB: number } {
    while (true) {
        const fa = a.next <= b.next ? a : b
        const fb = fa === a ? b : a
        const t = fa.next
        if (t >= windowMs) break
        // 回复 AP（用当前含周属性）
        const regen = apRegenOf(effAttrs(fa)[IDX.wis])
        const elapsed = t - fa.last
        if (elapsed > 0) fa.ap = Math.min(fa.maxAp, fa.ap + (regen * elapsed) / 1000)
        fa.last = t
        if (fa.ap < fa.maxAp) {
            // 等 AP 回满
            const deficit = fa.maxAp - fa.ap
            fa.next = t + Math.ceil((deficit / regen) * 1000)
            continue
        }
        // 行动：攻击（期望伤害）
        const dmg = expHit(effAttrs(fa), effAttrs(fb))
        fb.hp -= dmg
        fa.dealt += dmg
        fb.taken += dmg
        // 受击方回缠（30%伤害量）
        fb.chan = Math.min(MAX_CHAN, round1(fb.chan + dmg * 0.3 + (fb as unknown as { cpd: number }).cpd))
        applyZhou(fb)
        // 攻方花 AP（+缠 = 消耗量）
        const cost = apCostOf(effAttrs(fa)[IDX.agi])
        fa.ap -= cost
        fa.chan = Math.min(MAX_CHAN, round1(fa.chan + cost + (fa as unknown as { cpa: number }).cpa))
        applyZhou(fa)
        // 排下次行动
        const rem = fa.ap
        fa.next = t + Math.ceil(((fa.maxAp - rem) / regen) * 1000)
    }
    return { dealtA: a.dealt, takenA: a.taken, dealtB: b.dealt, takenB: b.taken, endA: a.chan, endB: b.chan }
}

/** 基线 + 单侧 +1 某属性的净收益（A 视角）：net = dealtA - takenA */
function attrNetValue(level: number, attrIdx: number, windowMs: number): number {
    const base = new Array(6).fill(level)
    const A = makeFighter(base)
    const B = makeFighter([...base])
    const baseline = simulate(A, B, windowMs)
    const baseNet = baseline.dealtA - baseline.takenA

    const boosted = [...base]
    boosted[attrIdx] += 1
    const aUp = makeFighter(boosted)
    const bRef = makeFighter([...base])
    const up = simulate(aUp, bRef, windowMs)
    return up.dealtA - up.takenA - baseNet
}

// ── 死亡对局（正常血量）：谁先死，A 的净胜 HP ──
function deathMatch(a: Fighter, b: Fighter, maxSec = 300): { netHp: number; time: number } {
    const windowMs = maxSec * 1000
    while (true) {
        const fa = a.next <= b.next ? a : b
        const fb = fa === a ? b : a
        const t = fa.next
        if (t >= windowMs) return { netHp: a.hp - b.hp, time: t }
        const regen = apRegenOf(effAttrs(fa)[IDX.wis])
        const elapsed = t - fa.last
        if (elapsed > 0) fa.ap = Math.min(fa.maxAp, fa.ap + (regen * elapsed) / 1000)
        fa.last = t
        if (fa.ap < fa.maxAp) {
            const deficit = fa.maxAp - fa.ap
            fa.next = t + Math.ceil((deficit / regen) * 1000)
            continue
        }
        const dmg = expHit(effAttrs(fa), effAttrs(fb))
        fb.hp -= dmg
        fa.dealt += dmg
        fb.taken += dmg
        fb.chan = Math.min(MAX_CHAN, round1(fb.chan + dmg * 0.3))
        applyZhou(fb)
        const cost = apCostOf(effAttrs(fa)[IDX.agi])
        fa.ap -= cost
        fa.chan = Math.min(MAX_CHAN, round1(fa.chan + cost))
        applyZhou(fa)
        const rem = fa.ap
        fa.next = t + Math.ceil(((fa.maxAp - rem) / regen) * 1000)
        if (fb.hp <= 0 || fa.hp <= 0) return { netHp: a.hp - b.hp, time: t }
    }
}

/** 死亡对局：A 单侧 +1 某属性，相对基线的净胜HP差 */
function attrKillValue(level: number, attrIdx: number): number {
    const base = new Array(6).fill(level)
    const A = makeFighter(base, 0, 0, 0, 1)
    const B = makeFighter([...base], 0, 0, 0, 1)
    const bl = deathMatch(A, B).netHp
    const boosted = [...base]
    boosted[attrIdx] += 1
    const aUp = makeFighter(boosted, 0, 0, 0, 1)
    const bRef = makeFighter([...base], 0, 0, 0, 1)
    const up = deathMatch(aUp, bRef).netHp
    return up - bl
}

function main(): void {
    const windowMs = 60_000
    const levels = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

    // 基线（10 级）：看看每边总共输出多少，用于归一化 %
    const base10 = makeFighter(new Array(6).fill(10))
    const base10b = makeFighter(new Array(6).fill(10))
    const bl = simulate(base10, base10b, windowMs)
    const baselineDealt = bl.dealtA
    console.log(`=== 基线（双方全 10）60s ===`)
    console.log(`单边总输出 ≈ ${round1(baselineDealt)} 伤害（含「周」中后期增益）`)
    console.log(
        `平均 DPS ≈ ${round1(baselineDealt / 60)}，命中≈${(hitChance(10, 10, 10, 10) * 100).toFixed(1)}% 招架≈${(parryChance(10, 10) * 100).toFixed(1)}% 暴击≈${(critChance(10, 10) * 100).toFixed(1)}%\n`,
    )

    // 属性边际价值表：行=属性，列=等级(双方同 L, A 单侧 +1)
    console.log(`=== 每点属性边际价值（A 单侧 +1，60s 净伤害差 / 基线% ）===`)
    const header = ['属性', ...levels.map((l) => `L${l}`), 'L10→L20 趋势'].join('\t')
    console.log(header)
    const rows: number[][] = ATTRS.map(() => [])
    for (const l of levels) {
        for (let i = 0; i < ATTRS.length; i++) rows[i].push(attrNetValue(l, i, windowMs))
    }
    ATTRS.forEach((name, i) => {
        const vals = rows[i]
        const first = vals[0]
        const last = vals[vals.length - 1]
        const trend = last > first ? '↑' : last < first ? '↓' : '→'
        console.log(
            [name, ...vals.map((v) => `${round1(v)} (${round1((v / baselineDealt) * 100)}%)`), trend].join('\t'),
        )
    })
    console.log('（括号内为占基线单边总输出的百分比）\n')

    // 1AP / 1缠
    console.log(`\n=== 资源点价值（10 级，60s）===`)
    const aApmax = makeFighter(new Array(6).fill(10), 1) // +1 maxAP
    const bApmax = makeFighter(new Array(6).fill(10))
    const rApmax = simulate(aApmax, bApmax, windowMs)
    console.log(`+1 最大AP   → ${round1(rApmax.dealtA - rApmax.takenA)} 净伤害（稳态频率不随 maxAp 变，接近0）`)

    const aChan = makeFighter(new Array(6).fill(10), 0, 1) // 每击额外 +1 缠
    const bChan = makeFighter(new Array(6).fill(10))
    const rChan = simulate(aChan, bChan, windowMs)
    console.log(`每击额外+1缠 → ${round1(rChan.dealtA - rChan.takenA)} 净伤害（加速到达「周」30/50 阈值）`)

    const aChanD = makeFighter(new Array(6).fill(10), 0, 0, 1) // 受击额外 +1 缠
    const bChanD = makeFighter(new Array(6).fill(10))
    const rChanD = simulate(aChanD, bChanD, windowMs)
    console.log(`受击额外+1缠 → ${round1(rChanD.dealtA - rChanD.takenA)} 净伤害`)

    // 死亡对局（正常血量）：每点属性的净胜HP
    console.log(`\n=== 死亡对局（正常血量）：A 单侧 +1 的净胜HP 差 ===`)
    console.log(`（正 = A 多活下来的 HP；这是每点属性在真实对局里的存活价值）`)
    const killHeader = ['属性', ...levels.map((l) => `L${l}`)].join('\t')
    console.log(killHeader)
    const killRows: number[][] = ATTRS.map(() => [])
    for (const l of levels) {
        for (let i = 0; i < ATTRS.length; i++) killRows[i].push(attrKillValue(l, i))
    }
    ATTRS.forEach((name, i) => {
        console.log([name, ...killRows[i].map((v) => `${round1(v)}`)].join('\t'))
    })
    console.log(`\n=== 死亡对局 10 级摘要 ===`)
    ATTRS.forEach((name, i) => console.log(`+1 ${name.padEnd(2)} → 净胜HP ${round1(killRows[i][0])}`))

    // 等级参考块（L10 / L14 / L18）：60s 净伤害 + 死亡净胜HP，各用自己基线归一化
    for (const lvl of [10, 14, 18]) {
        const idx = levels.indexOf(lvl)
        const a = makeFighter(new Array(6).fill(lvl))
        const b = makeFighter(new Array(6).fill(lvl))
        const bl = simulate(a, b, windowMs)
        console.log(`\n=== ★ L${lvl}（全属性${lvl}）参考：每点属性价值 ===`)
        console.log(`L${lvl} 基线单边输出 ≈ ${round1(bl.dealtA)}（60s）`)
        ATTRS.forEach((name, i) => {
            const w = rows[i][idx]
            const k = killRows[i][idx]
            console.log(
                `+1 ${name.padEnd(2)} → 60s净伤害 ${round1(w)}（${round1((w / bl.dealtA) * 100)}%）· 死亡净胜HP ${round1(k)}`,
            )
        })
    }

    // 10s 窗口（没有周增益的纯前期）
    const w10 = 10_000
    const b10a = makeFighter(new Array(6).fill(10))
    const b10b = makeFighter(new Array(6).fill(10))
    const bl10 = simulate(b10a, b10b, w10)
    console.log(`\n=== 10s 窗口基线 ===`)
    console.log(`单边输出 ≈ ${round1(bl10.dealtA)}（10s 内还没到 30 缠，无「周」）`)
    ATTRS.forEach((name, i) => {
        const v = attrNetValue(10, i, w10)
        console.log(`+1 ${name.padEnd(2)} → ${round1(v)} 净伤害`)
    })
}

main()
