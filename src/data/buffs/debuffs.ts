import type { BuffDef } from './types'
import { processActionEffect } from '../../engine/combat/effects'
import { calcApRegenPerSec, calcPoisonTicksPerStack } from '../../engine/calc/damage'
import { round1 } from '../../engine/util/math'

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
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'additive' },
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
        description: '沙尘入眼，洞察大幅降低。',
        tags: ['debuff'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'none' },
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
        attrMods: { agility: -4 },
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
        description: '被落英神剑标，积满5层自动引爆。',
        tags: ['debuff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 5 },
        logFormat: (layer, targetName) => {
            const stored = layer.extra?.stored as number | undefined
            const base = `「${targetName}」 获得状态 Lv.${layer.restoreValue}`
            return stored ? `${base}（累计寄存${stored}）` : base
        },
        onDebuffApply: ({ self, enemy, engine, layer }) => {
            if (!engine || !layer || layer.restoreValue < 5) return
            // 5层满 → 引爆
            const stored = (layer.extra?.stored as number) ?? 0
            const explosionDmg = round1(stored * 2)
            if (explosionDmg <= 0) return

            // 清除印记
            engine.state.pendingBuffs.delete(`shen_jian_mark::${enemy.id}`)

            // 直接扣血 + 单行汇总（避免 applyDamage 产生额外日志）
            enemy.takeDamage(explosionDmg, engine)
            engine.emitLog({
                type: 'system',
                message: `[落英神剑] 神剑印引爆！寄存${stored}，双倍造成${explosionDmg}点伤害`,
                actorId: self.id,
            })
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
        description: '以炁维持毫毛分身，每个分身每秒消耗0.05点内息。',
        tags: ['summon', 'debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        apRegenPerSec: ({ target }) => -0.05 * Math.max(1, Math.min(3, Math.ceil(target.attrs.get('vitality') / 4))),
    },
    {
        id: 'permanent_burn',
        name: '过热',
        description: '持续灼烧伤害。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        tickInterval: 3000,
        onTickDamage: ({ target }) => Math.max(1, Math.round(target.maxHp * 0.01)),
    },
    { id: 'max_ap_mod', name: '失能', description: '最大AP变化。', tags: [], expiry: { type: 'permanent' } },
    { id: 'max_hp_mod', name: '失血', description: '最大HP变化。', tags: [], expiry: { type: 'permanent' } },
    // ── 泼油 ──
    {
        id: 'oil_coating',
        name: '泼油',
        description: '浑身浇满油，整场灼烧伤害翻倍。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        // 常驻：灼烧 tick 伤害翻倍（油不消耗；与铸火诀/千锤百炼同一 onDebuffTick 数据钩子）
        onDebuffTick: ({ buffId, damage }) => {
            if (buffId !== 'burn') return undefined
            return Math.max(0, round1(damage * 2))
        },
    },
    // ── 失血（断臂） ──
    {
        id: 'blood_loss',
        name: '失血',
        description: '断臂血崩，每2秒失去当前血量的2%（最少1点）。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        tickInterval: 2000,
        onTickDamage: ({ target }) => Math.max(1, Math.round(target.hp * 0.02 * 10) / 10),
    },
    // ── 烟玉冷却 ──
    {
        id: 'smoke_bomb_cd',
        name: '烟玉冷却',
        description: '',
        tags: [],
        expiry: { type: 'duration', ms: 20000 },
        stacking: { type: 'none' },
    },
    // ── 撒菱冷却 ──
    {
        id: 'caltrops_cd',
        name: '撒菱冷却',
        description: '',
        tags: [],
        expiry: { type: 'duration', ms: 15000 },
        stacking: { type: 'none' },
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

            // 扣 AP（2/秒）
            atk.ap = Math.max(0, atk.ap - 2)
            atk.lastApUpdate = engine!.state.turn.currentTime

            // 刷新对手眩晕（保持锁定）
            if (!engine?.state.pendingBuffs.has(`stun::${defender.id}`)) {
                processActionEffect(
                    { type: 'add_debuff', buffId: 'stun', stacks: 1, chance: 1 },
                    { self: atk, enemy: defender, engine: engine!, tMs: engine!.state.turn.currentTime },
                )
            }

            // 力道挣脱
            const vicStr = defender.attrs.get('strength')
            const atkStr = atk.attrs.get('strength')
            if (vicStr > atkStr && Math.random() < (vicStr - atkStr) * 0.1) {
                engine!.state.pendingBuffs.delete(`choke::${defender.id}`)
                engine!.emitLog({
                    type: 'system',
                    message: `[绞杀] ${defender.name} 奋力挣脱了束缚！`,
                    actorId: defender.id,
                })
                return 0
            }

            // AP 耗尽 → 提前结束
            if (atk.ap <= 0) {
                engine!.state.pendingBuffs.delete(`choke::${defender.id}`)
                return 0
            }

            // 正常 tick 伤害
            return round1(atk.attrs.get('vitality') * 0.5)
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
