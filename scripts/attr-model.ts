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
import { calcTriggerSlots } from '../src/engine/entities/trigger'
import { MAX_CHAN, MOVE_BASE, MOVE_RATE } from '../src/engine/constants'

/**
 * 属性价值模型（2026-08-09）
 *
 * 场景：1v1 对砍，两人都只有一招（消耗3AP、造成 0.3×力道 + 0.1×身法 + 0.1×灵巧 + 0.1×推演 伤害），6 属性初始全 L。
 * 不考虑距离/移动/辅助招。概率全部取期望（不抽样）。
 *
 * 所有公式（命中/招架/暴击/AP/缠/气血）直接 import 引擎真实实现
 * （src/engine/calc/damage.ts、stats.ts、constants.ts）——改引擎公式，模型立即反映。
 * 事件循环复刻 engine.ts 原子回合：AP 满才行动、行动瞬间完成、
 * 下次行动 = (maxAp−剩余AP)/回复速率；缠劲 = 花AP+消耗量 + 受击50%伤害量；
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
// 统一招式：近战/远程同一个招式（同 AP、同属性系数），仅射程不同（近战 [0,2]、远程 [1,6]）
const baseDamage = (attrs: number[]) =>
    calcBaseDamage(
        { strength: 0.3, agility: 0.05, dexterity: 0.1, wisdom: 0.1 },
        {
            strength: attrs[IDX.str],
            vitality: 0,
            agility: attrs[IDX.agi],
            dexterity: attrs[IDX.dex],
            insight: 0,
            wisdom: attrs[IDX.wis],
        },
    )
const hitChance = (adex: number, ains: number, bAgi: number, bIns: number) =>
    calcHitChance({ attackerDexterity: adex, attackerInsight: ains, defenderAgility: bAgi, defenderInsight: bIns })
const parryChance = (bDex: number, bIns: number) => calcParryChance(bDex, bIns)
const parriedDmg = (base: number, bStr: number) => calcParriedDamage(base, bStr)
const critChance = (adex: number, ains: number) => calcCritChance(adex, ains)
const apCostOf = (agi: number) => calcActionCostAfterSpeed(3, agi, 0)
const apRegenOf = (wis: number) => calcApRegenPerSec(wis)
const maxHpOf = (vit: number) => calcMaxHp(vit)
const maxApOf = (vit: number) => calcMaxAp(vit)

/** 单次命中的期望伤害：A 打 B（属性已含周加成；招式相同，只区分射程） */
function expHit(a: number[], b: number[]): number {
    const base = baseDamage(a)
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
    /** 近战/远程：近战射程 [0,2]、远程 [2,6]；决定移动与攻击距离判定 */
    role: 'melee' | 'range'
    /** 与对手距离（初始 4m） */
    dist: number
    /** 触发槽数（max(1, floor(wisdom/4))，模型内由 wisdom 派生） */
    triggerSlots: number
    /** 触发期望伤累计（按触发槽数量化触发招式的价值） */
    triggerDmg: number
}

function makeFighter(
    base: number[],
    role: 'melee' | 'range' = 'melee',
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
        role,
        dist: 4,
        triggerSlots: calcTriggerSlots(base[IDX.wis]),
        triggerDmg: 0,
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

/** 移动所需 AP：加性公式 perAp = 基础 + 身法/倍率（引擎 MOVE_BASE/MOVE_RATE 同源） */
function perApOf(agi: number): number {
    return MOVE_BASE + agi / MOVE_RATE
}
function moveApFor(dist: number, agi: number): number {
    return Math.ceil(dist / perApOf(agi))
}

/** 触发期望伤：每次攻击/受击后，按触发槽逐一结算防御反应触发。
 *  触发槽绑定反应条件（循环分配）：on_parry(招架反击)/on_dodge(闪避反击)/on_parried(被招架追击)/on_dodged(被闪避追击)。
 *  触发概率 = 该反应的真实概率（模型内直接算）：招架率/闪避率/对方招架率/对方闪避率。
 *  触发招式 = 2AP 招式（与主招 3AP 系数成比例：主招总和 0.6 → 触发 0.4），触发不扣 AP。
 *  返回「每轮（攻击+受击）触发期望伤」。
 */
function triggerExpectedDmg(f: Fighter, target: number[]): number {
    if (f.triggerSlots <= 0) return 0
    const attrs = effAttrs(f)
    const tAttrs = target
    // 触发招式基础伤（2AP，系数总和 0.4）；忽略射程/距离（触发时已在射程内），但乘命中
    const trigBase = calcBaseDamage(
        { strength: 0.2, agility: 0.0333, dexterity: 0.0667, wisdom: 0.0667 },
        {
            strength: attrs[IDX.str],
            vitality: 0,
            agility: attrs[IDX.agi],
            dexterity: attrs[IDX.dex],
            insight: 0,
            wisdom: attrs[IDX.wis],
        },
    )
    // 触发招式命中期望：触发者打目标
    const trigHit = hitChance(attrs[IDX.dex], attrs[IDX.ins], tAttrs[IDX.agi], tAttrs[IDX.ins])
    const trigExp = trigHit * trigBase
    // 反应概率（真实公式）
    const myParry = parryChance(attrs[IDX.dex], attrs[IDX.ins]) // 我招架成功
    const myDodge = 1 - hitChance(tAttrs[IDX.dex], tAttrs[IDX.ins], attrs[IDX.agi], attrs[IDX.ins]) // 我闪避成功
    const tgtParry = parryChance(tAttrs[IDX.dex], tAttrs[IDX.ins]) // 我被招架
    const tgtDodge = 1 - hitChance(attrs[IDX.dex], attrs[IDX.ins], tAttrs[IDX.agi], tAttrs[IDX.ins]) // 我被闪避
    // 触发槽循环绑定反应条件，逐槽累加触发期望
    const conds = [myParry, myDodge, tgtParry, tgtDodge]
    let total = 0
    for (let i = 0; i < f.triggerSlots; i++) {
        const p = conds[i % conds.length]
        total += p * trigExp
    }
    return total
}

/** 事件模拟：窗口 windowMs 内，A/B 各累计 dealt/taken。
 *  A=近战(射程[0,2])、B=远程(射程[1,6])；招式相同（同AP同系数），近战需贴近移动，远程保持距离。 */
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
        const ea = effAttrs(fa)
        const eb = effAttrs(fb)
        const agi = ea[IDX.agi]
        // ── 距离与移动 ──
        const myRange: [number, number] = fa.role === 'melee' ? [0, 2] : [1, 6]
        if (fa.dist > myRange[1]) {
            // 太远：花 AP 贴近到射程内（近战贴近到 1m，远程贴近到射程内最近处）
            const need = fa.role === 'melee' ? fa.dist - 1 : Math.max(0, fa.dist - myRange[1])
            if (need > 0) {
                const moveCost = moveApFor(need, agi)
                if (fa.ap >= moveCost) {
                    fa.ap -= moveCost
                    fa.dist = fa.role === 'melee' ? 1 : myRange[1]
                } else {
                    // AP 不够走完：全走
                    const walk = fa.role === 'melee' ? fa.dist - 1 : fa.dist - myRange[1]
                    const perAp = perApOf(agi)
                    const moved = Math.min(walk, fa.ap * perAp)
                    fa.dist -= moved
                    fa.ap = 0
                }
            }
        } else if (fa.dist < myRange[0]) {
            // 太近（远程被贴身）：后撤拉开
            const need = myRange[0] - fa.dist
            const moveCost = moveApFor(need, agi)
            if (fa.ap >= moveCost) {
                fa.ap -= moveCost
                fa.dist = myRange[0]
            } else {
                const perAp = perApOf(agi)
                fa.dist += Math.min(need, fa.ap * perAp)
                fa.ap = 0
            }
        }
        // 仍够不到射程 → 无法攻击，等 AP 再动
        if (fa.dist > myRange[1] || fa.dist < myRange[0]) {
            fa.next = t + Math.ceil((Math.max(0.5, fa.maxAp - fa.ap) / regen) * 1000)
            continue
        }
        // ── 行动：攻击（期望伤害，按角色招式） ──
        const dmg = expHit(ea, eb)
        fb.hp -= dmg
        fa.dealt += dmg
        fb.taken += dmg
        // 触发招式（按触发槽数）
        const trig = triggerExpectedDmg(fa, eb)
        if (trig > 0) {
            fb.hp -= trig
            fa.dealt += trig
            fb.taken += trig
            fa.triggerDmg += trig
        }
        // 受击方回缠（30%伤害量）
        fb.chan = Math.min(MAX_CHAN, round1(fb.chan + (dmg + trig) * 0.5 + (fb as unknown as { cpd: number }).cpd))
        applyZhou(fb)
        // 攻方花 AP（+缠 = 消耗量）
        const cost = apCostOf(agi)
        fa.ap -= cost
        fa.chan = Math.min(MAX_CHAN, round1(fa.chan + cost + (fa as unknown as { cpa: number }).cpa))
        applyZhou(fa)
        // 近战攻击后保持贴身（1m）；远程攻击后保持距离（不动，站桩输出）
        if (fa.role === 'melee') fa.dist = 1
        // 排下次行动
        const rem = fa.ap
        fa.next = t + Math.ceil(((fa.maxAp - rem) / regen) * 1000)
    }
    return { dealtA: a.dealt, takenA: a.taken, dealtB: b.dealt, takenB: b.taken, endA: a.chan, endB: b.chan }
}

/** 基线 + 单侧 +1 某属性的净收益（被加强方视角）：
 *  近战 +1 打远程 + 远程 +1 打近战 取平均——反映该属性对近战/远程两端的综合价值。 */
/** 基准属性：全 level，但根骨固定 12（模拟低根骨人物的属性分布） */
function baseAttrs(level: number): number[] {
    const a = new Array(6).fill(level)
    a[IDX.vit] = 12
    return a
}

function attrNetValue(level: number, attrIdx: number, windowMs: number): number {
    const base = baseAttrs(level)
    // 近战视角：近战 +1 打远程
    const A = makeFighter(base, 'melee')
    const B = makeFighter([...base], 'range')
    const bl1 = simulate(A, B, windowMs)
    const baseNetMelee = bl1.dealtA - bl1.takenA
    const meleeUp = [...base]
    meleeUp[attrIdx] += 1
    const aUp = makeFighter(meleeUp, 'melee')
    const bRef = makeFighter([...base], 'range')
    const up1 = simulate(aUp, bRef, windowMs)
    const meleeDelta = up1.dealtA - up1.takenA - baseNetMelee

    // 远程视角：远程 +1 打近战（A=近战基准、B=远程+1）
    const A2 = makeFighter([...base], 'melee')
    const B2 = makeFighter([...base], 'range')
    const bl2 = simulate(A2, B2, windowMs)
    const baseNetRange = bl2.dealtB - bl2.takenB
    const rangeUp = [...base]
    rangeUp[attrIdx] += 1
    const aRef = makeFighter([...base], 'melee')
    const bUp = makeFighter(rangeUp, 'range')
    const up2 = simulate(aRef, bUp, windowMs)
    const rangeDelta = up2.dealtB - up2.takenB - baseNetRange

    return (meleeDelta + rangeDelta) / 2
}

// ── 死亡对局（正常血量）：谁先死，A 的净胜 HP ──
// 复用 simulate 的移动/触发/攻击逻辑，只是用正常血量 + 死亡即停
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
        const ea = effAttrs(fa)
        const eb = effAttrs(fb)
        const agi = ea[IDX.agi]
        // ── 距离与移动（与 simulate 同口径） ──
        const myRange: [number, number] = fa.role === 'melee' ? [0, 2] : [1, 6]
        if (fa.dist > myRange[1]) {
            const need = fa.role === 'melee' ? fa.dist - 1 : Math.max(0, fa.dist - myRange[1])
            if (need > 0) {
                const moveCost = moveApFor(need, agi)
                if (fa.ap >= moveCost) {
                    fa.ap -= moveCost
                    fa.dist = fa.role === 'melee' ? 1 : myRange[1]
                } else {
                    const walk = fa.role === 'melee' ? fa.dist - 1 : fa.dist - myRange[1]
                    const perAp = perApOf(agi)
                    const moved = Math.min(walk, fa.ap * perAp)
                    fa.dist -= moved
                    fa.ap = 0
                }
            }
        } else if (fa.dist < myRange[0]) {
            const need = myRange[0] - fa.dist
            const moveCost = moveApFor(need, agi)
            if (fa.ap >= moveCost) {
                fa.ap -= moveCost
                fa.dist = myRange[0]
            } else {
                const perAp = perApOf(agi)
                fa.dist += Math.min(need, fa.ap * perAp)
                fa.ap = 0
            }
        }
        if (fa.dist > myRange[1] || fa.dist < myRange[0]) {
            fa.next = t + Math.ceil((Math.max(0.5, fa.maxAp - fa.ap) / regen) * 1000)
            continue
        }
        // ── 攻击 + 触发（与 simulate 同口径） ──
        const dmg = expHit(ea, eb)
        const trig = triggerExpectedDmg(fa, eb)
        fb.hp -= dmg + trig
        fa.dealt += dmg + trig
        fb.taken += dmg + trig
        fa.triggerDmg += trig
        fb.chan = Math.min(MAX_CHAN, round1(fb.chan + (dmg + trig) * 0.5))
        applyZhou(fb)
        const cost = apCostOf(agi)
        fa.ap -= cost
        fa.chan = Math.min(MAX_CHAN, round1(fa.chan + cost))
        applyZhou(fa)
        if (fa.role === 'melee') fa.dist = 1
        const rem = fa.ap
        fa.next = t + Math.ceil(((fa.maxAp - rem) / regen) * 1000)
        if (fb.hp <= 0 || fa.hp <= 0) return { netHp: a.hp - b.hp, time: t }
    }
}

/** 死亡对局：近战 +1 打远程 + 远程 +1 打近战 的净胜HP差平均（同 attrNetValue 双向口径）。
 *  deathMatch 返回 A 视角 netHp；近战侧 A+1 用 A 视角，远程侧 B+1 转成 B 视角（取反）。 */
function attrKillValue(level: number, attrIdx: number): number {
    const base = baseAttrs(level)
    // 近战视角：A(近战) +1 打 B(远程) → A 视角
    const A = makeFighter(base, 'melee', 0, 0, 0, 1)
    const B = makeFighter([...base], 'range', 0, 0, 0, 1)
    const blMelee = deathMatch(A, B).netHp
    const meleeUp = [...base]
    meleeUp[attrIdx] += 1
    const aUp = makeFighter(meleeUp, 'melee', 0, 0, 0, 1)
    const bRef = makeFighter([...base], 'range', 0, 0, 0, 1)
    const meleeDelta = deathMatch(aUp, bRef).netHp - blMelee

    // 远程视角：B(远程) +1 打 A(近战) → B 视角（deathMatch 返回 A 视角，取反）
    const A2 = makeFighter([...base], 'melee', 0, 0, 0, 1)
    const B2 = makeFighter([...base], 'range', 0, 0, 0, 1)
    const blRange = -deathMatch(A2, B2).netHp
    const rangeUp = [...base]
    rangeUp[attrIdx] += 1
    const aRef = makeFighter([...base], 'melee', 0, 0, 0, 1)
    const bUp = makeFighter(rangeUp, 'range', 0, 0, 0, 1)
    const rangeDelta = -deathMatch(aRef, bUp).netHp - blRange

    return (meleeDelta + rangeDelta) / 2
}

function main(): void {
    const windowMs = 60_000
    const levels = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

    // 基线（10 级）：看看每边总共输出多少，用于归一化 %
    const base10 = makeFighter(new Array(6).fill(10), 'melee')
    const base10b = makeFighter(new Array(6).fill(10), 'range')
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
    const aApmax = makeFighter(new Array(6).fill(10), 'melee', 1) // +1 maxAP
    const bApmax = makeFighter(new Array(6).fill(10), 'range')
    const rApmax = simulate(aApmax, bApmax, windowMs)
    console.log(`+1 最大AP   → ${round1(rApmax.dealtA - rApmax.takenA)} 净伤害（稳态频率不随 maxAp 变，接近0）`)

    const aChan = makeFighter(new Array(6).fill(10), 'melee', 0, 1) // 每击额外 +1 缠
    const bChan = makeFighter(new Array(6).fill(10), 'range')
    const rChan = simulate(aChan, bChan, windowMs)
    console.log(`每击额外+1缠 → ${round1(rChan.dealtA - rChan.takenA)} 净伤害（加速到达「周」30/50 阈值）`)

    const aChanD = makeFighter(new Array(6).fill(10), 'melee', 0, 0, 1) // 受击额外 +1 缠
    const bChanD = makeFighter(new Array(6).fill(10), 'range')
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
        const a = makeFighter(new Array(6).fill(lvl), 'melee')
        const b = makeFighter(new Array(6).fill(lvl), 'range')
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
    const b10a = makeFighter(new Array(6).fill(10), 'melee')
    const b10b = makeFighter(new Array(6).fill(10), 'range')
    const bl10 = simulate(b10a, b10b, w10)
    console.log(`\n=== 10s 窗口基线 ===`)
    console.log(`单边输出 ≈ ${round1(bl10.dealtA)}（10s 内还没到 30 缠，无「周」）`)
    ATTRS.forEach((name, i) => {
        const v = attrNetValue(10, i, w10)
        console.log(`+1 ${name.padEnd(2)} → ${round1(v)} 净伤害`)
    })
}

main()
