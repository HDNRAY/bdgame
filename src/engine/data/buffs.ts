import type { GameEntity } from '../entities/base'
import type { AttrName } from '../entities/attributes'
import type { Character } from '../entities/character'
import type { BattleEngine } from '../combat/engine'
import type { BuffLayer } from '../combat/types'
import type { ActionDefinition } from '../entities/action'
import type { Tag } from '../entities/tag'
import type { TriggerEvent } from '../entities/trigger'

/** Buff 钩子上下文 */
export interface BuffHookCtx {
    final: number
    raw: number
    target: Character
    attacker: Character
    engine: BattleEngine
    layer: BuffLayer
    /** 该 buff 所属角色 ID */
    buffOwnerId: string
    /** 当前执行的招式 */
    action: ActionDefinition
}

/** 消耗方式 */
export type BuffExpiry =
    | { type: 'duration'; ms: number }
    | { type: 'duration_by_attr'; attr: AttrName; multiplier: number }
    | { type: 'tick'; interval: number }
    | { type: 'trigger'; event: string }
    | { type: 'consumed'; trigger: TriggerEvent }
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
    /** DOT/tick 间隔（ms） */
    tickInterval?: number
    /** tick 伤害基数 */
    dotDamage?: number
    /** tick 回复基数（1 = 1% maxHP） */
    tickHeal?: number
    /** 伤害修正钩子（applyDamage 中自动调用） */
    onDamage?: (ctx: BuffHookCtx) => number
    /** 层数变更前回调（返回实际 delta，0=拦截变更） */
    onBeforeModify?: (delta: number, ctx: { character: Character; engine: BattleEngine }) => number
    /** 招架率修正钩子（applyDamage 招架判定前自动调用，返回加算值） */
    onParryChance?: (ctx: BuffHookCtx) => number
    /** 招架减伤修正钩子（applyDamage 招架成功后自动调用） */
    onParryReduction?: (ctx: BuffHookCtx) => number
    /** 命中率修正钩子（processHitCheck 中自动调用，返回加算值） */
    onHitChance?: (ctx: BuffHookCtx) => number
    /** 允许自行选择可招架（返回 true 则允许招架） */
    onCanParry?: (ctx: { self: Character; engine: BattleEngine }) => boolean
    /** 暴击率修正钩子（applyDamage 暴击判定前自动调用，返回加算值） */
    onCritChance?: (ctx: BuffHookCtx) => number
    /** 暴击伤害修正钩子（applyDamage 暴击判定时自动调用，返回加算值） */
    onCritDamage?: (ctx: BuffHookCtx) => number
}

export const BUFF_DB: BuffDef[] = [
    // ── 战斗状态 ──
    {
        id: 'iaijutsu',
        name: '居合',
        description: '拔刀之势，蓄势待发。',
        tags: [],
        value: 0,
        expiry: { type: 'consumed', trigger: 'on_hit' },
        stacking: { type: 'none' },
    },
    {
        id: 'foresight',
        name: '看破',
        description: '洞察先机，招架率+40%。',
        tags: [],
        value: 0.4,
        expiry: { type: 'consumed', trigger: 'on_parry' },
        stacking: { type: 'none' },
        onParryChance: () => 0.4,
    },
    {
        id: 'mind_eye',
        name: '心眼',
        description: '心眼已开，暴击率+0.25。',
        tags: [],
        value: 0.25,
        expiry: { type: 'consumed', trigger: 'on_crit' },
        stacking: { type: 'none' },
        onCritChance: () => 0.25,
    },
    {
        id: 'circle',
        name: '圆',
        description: '下次攻击距离≤4时，命中+40%。',
        tags: [],
        value: 0.4,
        expiry: { type: 'consumed', trigger: 'on_hit' },
        stacking: { type: 'none' },
        onHitChance: ({ engine }) =>
            engine.state.position.distance(engine.state.characters[0].id, engine.state.characters[1].id) <= 4 ? 0.4 : 0,
    },
    {
        id: 'momentum',
        name: '刀势',
        description: '越战越勇，每层斩击伤害+10%, 命中率+5%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 6 },
        onDamage: ({ final, attacker, layer, buffOwnerId }) => {
            if (buffOwnerId === attacker.id) {
                return final + final * 0.1 * layer.restoreValue
            }
            return final
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
        attrMods: { agility: -10, strength: 4 },
        onParryChance: () => 0.15,
        onHitChance: ({ action }) => (action?.tags.includes('slash') ? 0.1 : 0),
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
        expiry: { type: 'trigger', event: 'action' },
        stacking: { type: 'additive' },
    },

    // ── 伤害修正 buff ──
    {
        id: 'qi_shield',
        name: '炁盾',
        description: '吸收炁招式伤害，每次2点。',
        tags: [],
        onDamage: ({ final, target, attacker, engine, action, layer }) => {
            const act = action
            const isQi = act?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (!isQi || final <= 0 || layer.restoreValue <= 0) return final
            const absorb = Math.min(2, final)
            layer.restoreValue--
            engine.emitLog({
                type: 'system',
                message: `[炁盾] ${target.name} 吸收${absorb}点（剩${layer.restoreValue}次）`,
                actorId: target.id,
            })
            if (layer.restoreValue <= 0) engine.state.pendingBuffs.delete(`qi_shield::${target.id}`)
            return Math.max(0, Math.round((final - absorb) * 10) / 10)
        },
    },
    {
        id: 'dmg_reduce',
        name: '乌铠',
        description: '消耗AP减免斩/刺/钝伤害。',
        tags: [],
        onDamage: ({ final, target, action, engine }) => {
            if (target.ap < 1 || final <= 5) return final
            const act = action
            if (!act?.requiredTags?.some((t: Tag) => t === 'slash' || t === 'pierce' || t === 'blunt')) return final
            target.spendAp(1)
            engine.emitLog({ type: 'system', message: `[乌铠] ${target.name} 消耗1AP减免3点`, actorId: target.id })
            return Math.max(0, Math.round((final - 3) * 10) / 10)
        },
    },
    {
        id: 'dimensional_blade',
        name: '次元刃',
        description: '凝炁为刃，削弱招架减伤效果。',
        tags: [],
        onParryReduction: ({ final, raw }) => {
            const blocked = raw - final
            const reduced = Math.round(blocked * 0.2 * 10) / 10
            return raw - reduced
        },
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
        onDamage: ({ final, attacker, layer }) => {
            const ratio = layer.restoreValue
            if (ratio <= 0 || attacker.hp >= attacker.maxHp) return final
            const missingRatio = 1 - attacker.hp / attacker.maxHp
            return Math.round(final * (1 + missingRatio * ratio) * 10) / 10
        },
    },

    // ── 内部追踪 ──
    { id: 'stun_track', name: '眩晕连续', description: '连续眩晕计数（5秒窗口）。', tags: [] },

    // ── 战斗状态 ──
    {
        id: 'iaijutsu_focus',
        name: '居合·势',
        description: '招架或闪避后蓄势，每层暴击伤害+0.25。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 3 },
        onCritDamage: ({ layer }) => layer.restoreValue * 0.25,
    },
    {
        id: 'guard_up',
        name: '守势',
        description: '凝神防守，招架率大幅提升。',
        tags: [],
        value: 0.35,
        expiry: { type: 'duration', ms: 3000 },
        stacking: { type: 'none' },
        onParryChance: () => 0.35,
    },
    {
        id: 'frost_dex_bonus',
        name: '春雷',
        description: '春雷灵巧加成，灵巧增伤。',
        tags: [],
        expiry: { type: 'permanent' },
        onDamage: ({ final, attacker, buffOwnerId }) => {
            if (attacker.id !== buffOwnerId) return final
            const bonus = Math.round(attacker.attrs.get('dexterity') * 0.5 * 10) / 10
            return Math.round((final + bonus) * 10) / 10
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
        onParryReduction: ({ final, target }) => {
            const dexBonus = target.attrs.get('dexterity') * 0.01
            return Math.round(final * (1 - dexBonus) * 10) / 10
        },
        onCanParry: ({ self }) => self.weaponDef?.id === 'bare_hands',
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
        description: '每 2 秒回复 1% 生命。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 2000,
        tickHeal: 1,
    },
    {
        id: 'qi_amplify',
        name: '炁意',
        description: '凝炁玉增幅，炁系招式伤害+15%。',
        tags: [],
        expiry: { type: 'permanent' },
        onDamage: ({ final, attacker, action }) => {
            const act = action
            const isQi = act?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi')
            if (!isQi) return final
            return Math.round(final * 1.15 * 10) / 10
        },
    },
    {
        id: 'paralyze_immunity',
        name: '雷体',
        description: '免疫麻痹。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'thunder_constitution',
        name: '雷电锻体',
        description: '雷系伤害减免80%，其他伤害减免20%。',
        tags: [],
        expiry: { type: 'permanent' },
        onDamage: ({ final, action }) => {
            if (action?.tags?.includes('electric')) {
                return Math.round(final * 0.2 * 10) / 10
            }
            return Math.round(final * 0.8 * 10) / 10
        },
    },
    {
        id: 'thunder_bonus',
        name: '雷法',
        description: '攻击附加3点雷击伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        onDamage: ({ final, buffOwnerId, attacker }) => {
            if (buffOwnerId !== attacker.id) return final
            return Math.round((final + 3) * 10) / 10
        },
    },
    {
        id: 'cinnabar_mark',
        name: '守宫砂·印',
        description: '每次攻击积攒一颗雷印，满三颗后下一击爆发。',
        tags: [],
        expiry: { type: 'permanent' },
        onDamage: ({ final, buffOwnerId, attacker, layer, engine }) => {
            if (buffOwnerId !== attacker.id) return final
            if (layer.restoreValue >= 2) {
                layer.restoreValue = 0
                engine.emitLog({ type: 'system', message: '[守宫砂] 雷印爆发！伤害×1.5', actorId: attacker.id })
                return Math.round(final * 1.5 * 10) / 10
            }
            layer.restoreValue = (layer.restoreValue ?? 0) + 1
            return final
        },
    },
]

export function getBuff(id: string): BuffDef | undefined {
    return BUFF_DB.find((b) => b.id === id)
}
