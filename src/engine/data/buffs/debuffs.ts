import { applyDamage } from '../../combat/effects/damage'
import type { BuffDef } from './types'
import { calcPoisonTicksPerStack } from '../../calc/damage'
import { round1 } from '../../util/math'
import { getBuff } from '../buffs'

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
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 3000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -0.4 },
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
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 2000 },
        stacking: { type: 'none' },
        attrMods: { insight: -4 },
    },
    {
        id: 'knockdown',
        name: '倒地',
        description: '重心不稳，倒地不起，身法大幅降低。',
        tags: ['debuff'],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 2000 },
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
            layer.extra = {
                source: self.name,
                sourceId: self.id,
                remainingTicks: existing,
            }
        },
    },
    {
        id: 'bleed',
        name: '流血',
        description: '行动触发额外伤害。',
        tags: ['debuff'],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
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
        onDebuffApply: ({ self, enemy, engine, layer }) => {
            if (layer.restoreValue < 5) return
            // 5层满 → 引爆
            const stored = (layer.extra?.stored as number) ?? 0
            const explosionDmg = round1(stored * 2)
            if (explosionDmg <= 0) return

            // 清除印记
            engine.state.pendingBuffs.delete(`shen_jian_mark::${enemy.id}`)

            // 造成伤害（标记 triggered 防止递归触发落英神剑）
            const buff = getBuff('shen_jian_mark')
            if (!buff) return
            applyDamage({
                raw: explosionDmg,
                target: enemy,
                attacker: self,
                engine,
                source: buff,
                triggered: true,
            })
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
        expiry: { type: 'duration_by_attr', attr: 'wisdom', multiplier: 30000 },
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
]
