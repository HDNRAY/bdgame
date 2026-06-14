import type { GameEntity } from '../entities/base'
import type { AttrName } from '../entities/attributes'
import type { Character } from '../entities/character'
import type { BattleEngine } from '../combat/engine'
import type { BuffLayer } from '../combat/types'
import { getAction } from './actions'
import type { Tag } from '../entities/tag'

/** 伤害修正钩子上下文 */
export interface DamageModContext {
    final: number
    target: Character
    attacker: Character
    engine: BattleEngine
    actionId?: string
    layer: BuffLayer
    /** 该 buff 所属角色 ID */
    buffOwnerId?: string
}

/** 消耗方式 */
export type BuffExpiry =
    | { type: 'duration'; ms: number }
    | { type: 'duration_by_attr'; attr: AttrName; multiplier: number }
    | { type: 'tick'; interval: number }
    | { type: 'trigger'; event: string; maxTriggers: number }
    | { type: 'consumed' }
    | { type: 'permanent' }

/** 叠层行为 */
export type BuffStacking = { type: 'none' } | { type: 'additive'; max?: number } | { type: 'independent' }

/** Buff 定义 */
export interface BuffDef extends GameEntity {
    value?: number
    /** 消耗方式 */
    expiry?: BuffExpiry
    /** 叠层行为 */
    stacking?: BuffStacking
    /** 每层属性修正 */
    attrMods?: Record<string, number>
    /** 连续眩晕递减 */
    consecutiveDiminish?: boolean
    /** DOT/tick 间隔（ms） */
    tickInterval?: number
    /** tick 伤害基数 */
    dotDamage?: number
    /** tick 回复基数（1 = 1% maxHP） */
    tickHeal?: number
    /** 伤害修正钩子（applyDamage 中自动调用） */
    onDamage?: (final: number, ctx: DamageModContext) => number
    /** 层数变更前回调（返回实际 delta，0=拦截变更） */
    onBeforeModify?: (delta: number, ctx: { character: Character; engine: BattleEngine }) => number
    /** 招架率修正钩子（applyDamage 招架判定前自动调用，返回加算值） */
    onParryChance?: (ctx: { target: Character; attacker: Character; engine: BattleEngine }) => number
    /** 招架减伤修正钩子（applyDamage 招架成功后自动调用） */
    onParryReduction?: (final: number, ctx: { target: Character; attacker: Character; engine: BattleEngine }) => number
}

export const BUFF_DB: BuffDef[] = [
    // ── 战斗状态 ──
    {
        id: 'iaijutsu',
        name: '居合',
        description: '拔刀之势，蓄势待发。',
        tags: [],
        value: 0,
        expiry: { type: 'consumed' },
        stacking: { type: 'none' },
    },
    {
        id: 'foresight',
        name: '看破',
        description: '洞察先机，招架率+40%。',
        tags: [],
        value: 0.4,
        expiry: { type: 'consumed' },
        stacking: { type: 'none' },
    },
    {
        id: 'mind_eye',
        name: '心眼',
        description: '心眼已开，暴击率+0.25。',
        tags: [],
        value: 0.25,
        expiry: { type: 'consumed' },
        stacking: { type: 'none' },
    },
    {
        id: 'circle',
        name: '圆',
        description: '下次攻击距离≤4时，命中+40%。',
        tags: [],
        value: 0.4,
        expiry: { type: 'consumed' },
        stacking: { type: 'none' },
    },
    {
        id: 'momentum',
        name: '刀势',
        description: '越战越勇，每层斩击伤害+10%, 命中率+5%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 6 },
        onDamage: (f, { attacker, layer, buffOwnerId }) => {
            if (buffOwnerId === attacker.id) {
                return f + f * 0.1 * layer.restoreValue
            }
            return f
        },
        onBeforeModify: (delta, { character, engine }) => {
            if (delta < 0 && engine.state.pendingBuffs.has(`overlord_blade::${character.id}`)) {
                return 0 // 霸刀护体，刀势不降
            }
            return delta
        },
    },
    {
        id: 'overlord_blade',
        name: '霸刀',
        description: '霸刀在手，身法受限但势不可挡。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { agility: -10 },
        onParryChance: () => 0.15,
    },

    {
        id: 'disarmed',
        name: '缴械',
        description: '兵器脱手，无法使用武器招式。',
        tags: [],
        expiry: { type: 'duration', ms: 1500 },
        stacking: { type: 'none' },
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '凝炁为刃，或凝炁与刃',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
    },

    // ── 属性类 ──
    {
        id: 'stat_multiply',
        name: '超越',
        description: '属性临时倍增。',
        tags: [],
        expiry: { type: 'duration_by_attr', attr: 'wisdom', multiplier: 150 },
        stacking: { type: 'independent' },
    },
    { id: 'stat_buff', name: '内劲', description: '属性临时变化。', tags: [], stacking: { type: 'independent' } },
    {
        id: 'stat_transfer',
        name: '汲取',
        description: '吸取目标属性。',
        tags: [],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'independent' },
    },

    // ── 负面状态 ──
    {
        id: 'paralyze',
        name: '麻痹',
        description: '身法、灵巧降低。',
        tags: [],
        expiry: { type: 'duration', ms: 1500 },
        stacking: { type: 'independent' },
        attrMods: { agility: -1, dexterity: -1 },
    },
    {
        id: 'frost',
        name: '霜冻',
        description: '身法降低，移动缓慢。',
        tags: [],
        expiry: { type: 'duration', ms: 3000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -0.4 },
    },
    {
        id: 'stun',
        name: '眩晕',
        description: '大幅降低身法、洞察（连续命中递减）。',
        tags: [],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'independent' },
        consecutiveDiminish: true,
    },
    {
        id: 'sand_blind',
        name: '迷眼',
        description: '沙尘入眼，洞察大幅降低。',
        tags: [],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'none' },
        attrMods: { insight: -4 },
    },
    {
        id: 'knockdown',
        name: '倒地',
        description: '重心不稳，倒地不起，身法大幅降低。',
        tags: [],
        expiry: { type: 'duration', ms: 2000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -4 },
    },
    {
        id: 'burn',
        name: '灼烧',
        description: '持续火焰伤害。',
        tags: [],
        expiry: { type: 'tick', interval: 1000 },
        stacking: { type: 'additive' },
        dotDamage: 5,
    },
    {
        id: 'poison',
        name: '中毒',
        description: '持续毒素伤害。',
        tags: [],
        expiry: { type: 'tick', interval: 2000 },
        stacking: { type: 'additive' },
    },
    {
        id: 'bleed',
        name: '流血',
        description: '行动触发额外伤害。',
        tags: [],
        expiry: { type: 'trigger', event: 'action', maxTriggers: 5 },
        stacking: { type: 'additive' },
    },

    // ── 伤害修正 buff ──
    {
        id: 'qi_shield',
        name: '炁盾',
        description: '吸收qi招式伤害，每次2点。',
        tags: [],
        onDamage: (f, { target, attacker, engine, actionId, layer }) => {
            const act = actionId ? getAction(actionId) : undefined
            const isQi = act?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (!isQi || f <= 0 || layer.restoreValue <= 0) return f
            const absorb = Math.min(2, f)
            layer.restoreValue--
            engine.emitLog({
                type: 'system',
                message: `[炁盾] ${target.name} 吸收${absorb}点（剩${layer.restoreValue}次）`,
                actorId: target.id,
            })
            if (layer.restoreValue <= 0) engine.state.pendingBuffs.delete(`qi_shield::${target.id}`)
            return Math.max(0, Math.round((f - absorb) * 10) / 10)
        },
    },
    {
        id: 'dmg_reduce',
        name: '乌铠',
        description: '消耗AP减免斩/刺/钝伤害。',
        tags: [],
        onDamage: (f, { target, actionId, engine }) => {
            if (target.ap < 1 || f <= 5) return f
            const act = actionId ? getAction(actionId) : undefined
            if (!act?.requiredTags?.some((t: Tag) => t === 'slash' || t === 'pierce' || t === 'blunt')) return f
            target.spendAp(1)
            engine.emitLog({ type: 'system', message: `[乌铠] ${target.name} 消耗1AP减免3点`, actorId: target.id })
            return Math.max(0, Math.round((f - 3) * 10) / 10)
        },
    },
    {
        id: 'dimensional_blade',
        name: '次元刃',
        description: '凝炁为刃，无视招架。',
        tags: [],
    },
    {
        id: 'zuoyou_hubo',
        name: '左右互搏',
        description: '一次行动可使用两次主招式。',
        tags: [],
    },
    {
        id: 'last_stand',
        name: '九死剑诀',
        description: '损失血量增伤。',
        tags: [],
        onDamage: (f, { attacker, layer }) => {
            const ratio = layer.restoreValue
            if (ratio <= 0 || attacker.hp >= attacker.maxHp) return f
            const missingRatio = 1 - attacker.hp / attacker.maxHp
            return Math.round(f * (1 + missingRatio * ratio) * 10) / 10
        },
    },

    // ── 内部追踪 ──
    { id: 'stun_track', name: '眩晕连续', description: '连续眩晕计数（5秒窗口）。', tags: [] },

    // ── 战斗状态 ──
    {
        id: 'guard_up',
        name: '守势',
        description: '凝神防守，招架率大幅提升。',
        tags: [],
        expiry: { type: 'duration', ms: 3000 },
        stacking: { type: 'none' },
    },
    {
        id: 'frost_dex_bonus',
        name: '春雷',
        description: '春雷灵巧加成，灵巧增伤。',
        tags: [],
        expiry: { type: 'permanent' },
        onDamage: (f, { attacker, buffOwnerId }) => {
            if (attacker.id !== buffOwnerId) return f
            const bonus = Math.round(attacker.attrs.get('dexterity') * 0.5 * 10) / 10
            return Math.round((f + bonus) * 10) / 10
        },
    },
    {
        id: 'ranged_dodge',
        name: '斗笠掩踪',
        description: '距离≥5m时闪避+15%。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'elemental_immunity',
        name: '冰心',
        description: '免疫灼烧、冰霜、麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'min_move_cost',
        name: '凌波微步',
        description: '步法精妙，移动消耗最低。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'tai_chi',
        name: '太极',
        description: '以柔克刚，四两拨千斤。空手可招架，灵巧增益招架减伤。',
        tags: [],
        expiry: { type: 'permanent' },
        onParryReduction: (f, { target }) => {
            const dexBonus = target.attrs.get('dexterity') * 0.01
            return Math.round(f * (1 - dexBonus) * 10) / 10
        },
    },

    // ── 永久修饰（构造期执行） ──
    { id: 'max_ap_mod', name: '失能', description: '最大AP变化。', tags: [], expiry: { type: 'permanent' } },
    { id: 'max_hp_mod', name: '失血', description: '最大HP变化。', tags: [], expiry: { type: 'permanent' } },
    { id: 'fumble_chance', name: '失心', description: '动作失败率。', tags: [], expiry: { type: 'permanent' } },
    {
        id: 'permanent_burn',
        name: '过热',
        description: '持续灼烧伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 3000,
        dotDamage: 1,
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '每 3 秒回复 1% 生命。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 3000,
        tickHeal: 1,
    },
    {
        id: 'qi_amplify',
        name: '炁意',
        description: '凝炁玉增幅，炁系招式伤害+15%。',
        tags: [],
        expiry: { type: 'permanent' },
        onDamage: (f, { attacker, actionId }) => {
            const act = actionId ? getAction(actionId) : undefined
            const isQi = act?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (!isQi) return f
            return Math.round(f * 1.1 * 10) / 10
        },
    },
]

export function getBuff(id: string): BuffDef | undefined {
    return BUFF_DB.find((b) => b.id === id)
}
