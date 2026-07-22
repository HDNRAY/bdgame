import type { BuffDef } from './types'
import { processActionEffect } from '../../engine/combat/effects'
import { calcPoisonTicksPerStack } from '../../engine/calc/damage'
import { round1 } from '../../engine/util/math'

/** 减益状态 */
export const DEBUFF_DB: BuffDef[] = [
    {
        id: 'paralyze',
        name: '麻痹',
        description: '身法、灵巧降低。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 1800 },
        stacking: { type: 'independent' },
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
        expiry: { type: 'duration', ms: 10000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -0.5, dexterity: -0.5 },
    },
    {
        id: 'stun',
        name: '眩晕',
        description: '大幅降低身法、洞察（连续命中递减）。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 5000 },
        stacking: { type: 'independent' },
    },
    {
        id: 'sand_blind',
        name: '迷眼',
        description: '沙尘入眼，洞察大幅降低。',
        tags: ['debuff'],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'none' },
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
    },
    {
        id: 'poison',
        name: '中毒',
        description: '持续毒素伤害。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
        onDebuffApply: ({ self, enemy, stacks, layer }) => {
            if (!layer) {
                console.error('onDebuffApply: layer is undefined', self, enemy, stacks)
                return
            }
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
        onDebuffApply: ({ layer }) => {
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
        name: '神剑印记',
        description: '被落英神剑标记，积满5层自动引爆。',
        tags: ['debuff', 'qi'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 5 },
        logFormat: (layer, targetName) => {
            const stored = layer.extra?.stored as number | undefined
            const base = `「${targetName}」 获得状态 Lv.${layer.restoreValue}`
            return stored ? `${base}（累计寄存${stored}）` : base
        },
        onDebuffApply: ({ self, enemy, engine, layer }) => {
            if (layer.restoreValue < 5) return
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
                message: `[落英神剑] 神剑印记引爆！寄存${stored}，双倍造成${explosionDmg}点伤害`,
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
        description: '义体过载，身法下降。',
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
        description: '浑身浇满油，灼烧层数翻倍。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        // 泼油时身上有灼烧 → 已有层数翻倍
        onDebuffApply: ({ enemy, engine }) => {
            if (!engine) return
            const burnKey = `burn::${enemy.id}`
            const burnLayer = engine.state.pendingBuffs.get(burnKey)
            if (burnLayer) {
                burnLayer.restoreValue *= 2
                engine.emitLog({
                    type: 'system',
                    message: `[泼油] 灼烧层数翻倍！→${burnLayer.restoreValue}`,
                    actorId: enemy.id,
                })
            }
        },
        // 灼烧时身上有泼油 → 抵抗并重新应用翻倍层数
        onReceiveDebuff: (ctx) => {
            if (ctx.buffId !== 'burn') return
            if (!ctx.engine) return
            ctx.engine.state.pendingBuffs.delete(`oil_coating::${ctx.self.id}`)
            processActionEffect(
                { type: 'add_debuff', buffId: 'burn', stacks: ctx.stacks * 2, chance: 1 },
                { self: ctx.enemy, enemy: ctx.self, engine: ctx.engine, tMs: ctx.engine.state.turn.currentTime },
            )
            ctx.engine.emitLog({
                type: 'system',
                message: `[泼油] 灼烧层数翻倍！${ctx.stacks}→${ctx.stacks * 2}`,
                actorId: ctx.self.id,
            })
            return 0
        },
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
        description: '每层增伤3%。累计10点治疗消一层。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 81 },
        onTakeDamage: ({ final, layer }) => Math.round(final * (1 + layer.restoreValue * 0.05) * 10) / 10,
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
]
