import type { BuffDef } from './types'
import { rng } from '../../engine/util/rng'
import { processActionEffect } from '../../engine/combat/effects'
import { dropBuffLayer } from '../../engine/combat/utils/buff-layer'
import { calcApRegenPerSec, calcPoisonTicksPerStack } from '../../engine/calc/damage'
import { round1 } from '../../engine/util/math'
import type { Character } from '../../engine/entities/character'

/** 窒息每跳绞杀伤害：裸绞施加后每秒结算（力道×0.2+体质×0.2）。
 *  引擎 tick 与 AI 伤害评估共用同一份公式，改动只需在此一处。 */
export function calcChokeTickDamage(atk: Character): number {
    return round1(atk.attrs.get('strength') * 0.2 + atk.attrs.get('vitality') * 0.2)
}

/** 减益状态 */
export const DEBUFF_DB: BuffDef[] = [
    {
        id: 'paralyze',
        name: '麻痹',
        description: '身法、灵巧降低。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 4000 },
        stacking: { type: 'independent' },
        // 施加时广播 on_paralyze，驱动攻击方触发器
        onDebuffApply: ({ self, enemy, engine }) => {
            engine?.emit('on_paralyze', self, enemy)
        },
        attrMods: { agility: -1, dexterity: -1 },
    },
    {
        id: 'confuse',
        name: '迷惑',
        description: '神志不清，推演降低。',
        tags: ['debuff'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'independent' },
        attrMods: { wisdom: -1 },
    },
    {
        id: 'frost',
        name: '霜冻',
        description: '身法降低，移动缓慢。',
        tags: ['debuff'],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -0.5, dexterity: -0.5 },
    },
    {
        id: 'stun',
        name: '眩晕',
        description: '大幅降低身法、洞察（连续命中递减）。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 2000 },
        stacking: { type: 'independent' },
        // 施加时广播 on_stun，驱动攻击方触发器
        onDebuffApply: ({ self, enemy, engine }) => {
            engine?.emit('on_stun', self, enemy)
        },
    },
    {
        id: 'sand_blind',
        name: '迷眼',
        description: '沙尘入眼，洞察大幅降低，每层-4。',
        tags: ['debuff'],
        expiry: { type: 'duration', ms: 5000 },
        // single：同一次施加可多层（闪光 stacks3 → -12），已迷眼则跨次忽略（不叠不刷新时长）
        stacking: { type: 'single' },
        // 施加时广播 on_sand_blind，驱动攻击方触发器
        onDebuffApply: ({ self, enemy, engine }) => {
            engine?.emit('on_sand_blind', self, enemy)
        },
        attrMods: { insight: -4 },
    },
    {
        id: 'knockdown',
        name: '倒地',
        description: '重心不稳，倒地不起，身法大幅降低。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'agility', multiplier: 2000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -6 },
    },
    {
        id: 'burn',
        name: '灼烧',
        description: '持续火焰伤害。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        // 施加时广播 on_burn，驱动攻击方触发器
        onDebuffApply: ({ self, enemy, engine }) => {
            engine?.emit('on_burn', self, enemy)
        },
    },
    {
        id: 'poison',
        name: '中毒',
        description: '持续毒素伤害。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        // 施加时广播 on_poison，驱动攻击方触发器（如 on_poison 触发槽）
        onDebuffApply: ({ self, enemy, engine, stacks, layer }) => {
            if (!layer) {
                console.error('onDebuffApply: layer is undefined', self, enemy, stacks)
                return
            }
            engine?.emit('on_poison', self, enemy)
            const ticksPerStack = calcPoisonTicksPerStack(enemy.attrs.get('wisdom'))
            const existing: number[] = (layer.extra?.remainingTicks as number[]) ?? []
            for (let i = 0; i < stacks; i++) existing.push(ticksPerStack)
            layer.extra = { ...layer.extra, remainingTicks: existing }
        },
    },
    {
        id: 'bleed',
        name: '流血',
        description: '行动触发额外伤害。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        // 施加时广播 on_bleed，驱动攻击方触发器（如方烈·追击枪）
        onDebuffApply: ({ self, enemy, engine, layer }) => {
            engine?.emit('on_bleed', self, enemy)
            if (!layer) return
            layer.extra = { ...layer.extra, bleedTriggerCount: 0 }
        },
    },
    {
        id: 'disarmed',
        name: '缴械',
        description: '兵器脱手，无法使用武器招式。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
    },
    {
        id: 'shen_jian_mark',
        name: '神剑印',
        description: '被落英神剑标记，寄存伤害。暴击时引爆。',
        tags: ['debuff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        logFormat: (layer, targetName) => {
            const stored = layer.extra?.stored as number | undefined
            return stored ? `「${targetName}」 获得状态（累计寄存${stored}）` : `「${targetName}」 获得状态`
        },
    },
    {
        id: 'fumble_chance',
        name: '永久失心',
        description: '动作失败率。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
    },
    {
        id: 'fumble_chance_temp',
        name: '失心',
        description: '动作失败率。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'wisdom', multiplier: 10000 },
        stacking: { type: 'additive' },
    },
    {
        id: 'overload',
        name: '失重',
        description: '义体过重，身法下降。',
        tags: ['debuff', 'implant'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        attrMods: { agility: -1 },
    },
    {
        id: 'muscle_degradation',
        name: '失感',
        description: '肌肉负担过重，体质与技巧下降。',
        tags: ['debuff', 'implant'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { vitality: -2, dexterity: -2 },
        // 无钩子，但物化时要打「获得状态」日志 / 广播 on_buff（与改动前逐字节一致）→ 必须建层
        needsLayer: true,
    },
    {
        id: 'ap_drain',
        name: '失能',
        description: '能量损耗，内息上限下降。',
        tags: ['debuff', 'implant'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        maxApMod: -1,
    },
    {
        id: 'energy_drain',
        name: '耗能',
        description: '运转耗能，每层AP回复-0.1/s。',
        tags: ['debuff', 'implant'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        apRegenPerSec: ({ layer }) => -((layer.restoreValue ?? 0) * 0.1),
    },
    {
        id: 'duan_qi',
        name: '断炁',
        description: '封脉断炁，每层AP回复-0.1/s，最多5层。',
        tags: ['debuff', 'qi'],
        expiry: { type: 'duration', ms: 8000 },
        stacking: { type: 'additive', max: 3 },
        apRegenPerSec: ({ layer }) => -((layer.restoreValue ?? 0) * 0.1),
    },
    {
        id: 'wen_luan',
        name: '紊乱',
        description: '气息紊乱，每层AP回复-0.1/s。独立叠层，每层5秒。',
        tags: ['debuff', 'qi'],
        expiry: { type: 'duration', ms: 5000 },
        // 独立叠层：每次施加各占一层、各自 5 秒到期（key 带 appId），层数无上限
        stacking: { type: 'independent' },
        apRegenPerSec: ({ layer }) => -((layer.restoreValue ?? 1) * 0.1),
    },
    {
        id: 'yuwu_cost',
        name: '御物耗炁',
        description: '以炁御物，每秒消耗内息（AP）。',
        tags: ['imperial', 'debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        // 御物耗炁：扣减不超过当前 AP 回复速度的 2/3 —— 低属性也能用御物（只是慢），净回复恒为正，绝无负回复卡死
        apRegenPerSec: ({ target, layer }) => {
            const base = calcApRegenPerSec(target.attrs.get('wisdom'))
            return -Math.min(layer.restoreValue ?? 0, (2 / 3) * base)
        },
    },
    {
        id: 'fen_shen_cost',
        name: '分身耗炁',
        description: '以炁维持分身，每秒消耗0.05点内息。',
        tags: ['summon', 'debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        apRegenPerSec: () => -0.05,
    },
    {
        id: 'permanent_burn',
        name: '过热',
        description: '持续灼烧伤害。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        tickInterval: 5000,
        // 层数 = 每跳最大气血百分比（value:1 = 1%）
        onTickDamage: ({ target, layer }) => Math.max(1, Math.round((target.maxHp * (layer?.restoreValue ?? 1)) / 100)),
    },
    // ── 浸油（忍者工具包·泼油） ──
    {
        id: 'oil_coating',
        name: '浸油',
        description: '浑身浸满油，灼烧伤害翻倍，身法-2。灼烧额外伤害累计20点后油被烧尽。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        attrMods: { agility: -2 },
        // 灼烧 tick 伤害翻倍；累计翻倍带来的额外伤害，达到 20 后移除自身（油烧尽，可重新泼）
        onDebuffTick: ({ buffId, damage, layer, engine, target }) => {
            if (buffId !== 'burn' || !layer) return undefined
            const extra = damage // 翻倍部分 = 原始伤害
            const acc = ((layer.extra?.burnExtra as number) ?? 0) + extra
            if (acc >= 20) {
                if (engine && target) {
                    dropBuffLayer(engine.state, `oil_coating::${target.id}`)
                    engine.emitLog({
                        type: 'system',
                        message: `[浸油] ${target.name} 身上的油被烧尽了`,
                        actorId: target.id,
                    })
                }
                return Math.max(0, round1(damage * 2))
            }
            layer.extra = { ...layer.extra, burnExtra: acc }
            return Math.max(0, round1(damage * 2))
        },
    },
    // ── 失血（断臂） ──
    {
        id: 'blood_loss',
        name: '失血',
        description: '断臂血崩，每1秒失去当前血量的2%（最少1点）。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        tickInterval: 1000,
        onTickDamage: ({ target }) => Math.max(1, round1(target.hp * 0.02)),
    },
    {
        id: 'blade_qi',
        name: '刃炁',
        description: '每层增伤，收益随层数递减，最高约40%。累计10点治疗消一层。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        onTakeDamage: ({ final, layer }) => {
            // 收敛增伤：+40% × n/(n+6)，无层数上限，n→∞ 趋近 +40%（前期每层约 5% 递减，不滚雪球）
            const n = layer.restoreValue
            const mult = 1 + (0.4 * n) / (n + 6)
            return Math.round(final * mult * 10) / 10
        },
        onReceiveHeal: ({ layer, engine, target, final: amount }) => {
            const HEAL_PER_STACK = 10
            const acc = (layer.extra?.healAccumulator as number) ?? 0
            const total = acc + amount
            if (total < HEAL_PER_STACK) {
                layer.extra = { ...layer.extra, healAccumulator: total }
                return
            }
            const reduce = Math.min(layer.restoreValue, Math.floor(total / HEAL_PER_STACK))
            layer.restoreValue -= reduce
            layer.extra = { ...layer.extra, healAccumulator: total - reduce * HEAL_PER_STACK }
            engine?.emitLog({
                type: 'system',
                message: `[治疗] ${target?.name ?? ''} 刃炁 -${reduce}层，剩${layer.restoreValue}层`,
                actorId: target.id,
            })
        },
    },
    // ── 裸绞（窒息） ──
    {
        id: 'choke',
        name: '窒息',
        description: '颈部被锁，呼吸困难。持续受到绞杀伤害。',
        tags: ['debuff'],
        expiry: { type: 'duration', ms: 3000 },
        stacking: { type: 'none' },
        tickInterval: 1000,
        onTickDamage: ({ engine, layer, target: defender }) => {
            const atkId = layer.sourceId
            if (!atkId) return 0
            const atk = engine?.getCharacter(atkId)
            if (!atk || !atk.isAlive()) {
                engine?.state.pendingBuffs.delete(`choke::${defender.id}`)
                return 0
            }

            // 本秒伤害：只要绞杀仍存在就先结算（含松脱那一秒）
            const dmg = calcChokeTickDamage(atk)

            // 扣 AP（1/秒)
            atk.spendAp(1)

            // 刷新对手眩晕（保持锁定）
            if (!engine?.state.pendingBuffs.has(`stun::${defender.id}`)) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'stun', stacks: 1, chance: 1 },
                    { self: atk, enemy: defender, engine: engine!, tMs: engine!.state.turn.currentTime },
                )
            }

            // 力道挣脱 → 松脱但仍结算本秒伤害
            const vicStr = defender.attrs.get('strength')
            const atkStr = atk.attrs.get('strength')
            if (vicStr > atkStr && rng.chance((vicStr - atkStr) * 0.1)) {
                engine!.state.pendingBuffs.delete(`choke::${defender.id}`)
                engine!.emitLog({
                    type: 'system',
                    message: `[绞杀] ${defender.name} 奋力挣脱了束缚！`,
                    actorId: defender.id,
                })
                return dmg
            }

            // AP 耗尽 → 松脱但仍结算本秒伤害
            if (atk.ap <= 0) {
                engine!.state.pendingBuffs.delete(`choke::${defender.id}`)
                return dmg
            }

            return dmg
        },
    },
    {
        id: 'bu_xing',
        name: '不幸',
        description: '厄运缠身，命中、闪避、招架、暴击-4%。',
        tags: ['debuff'],
        expiry: { type: 'duration', ms: 7000 },
        stacking: { type: 'none' },
        onHitChance: () => -0.04,
        onDodgeChance: () => -0.04,
        onParryChance: () => -0.04,
        onCritChance: () => -0.04,
    },
    {
        id: 'weakness',
        name: '虚弱',
        description: '气力不济，力道、推演降低。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 4000 },
        stacking: { type: 'independent' },
        attrMods: { strength: -1, wisdom: -1 },
    },
]
