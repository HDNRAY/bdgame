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
    /** 当前执行的招式（部分钩子如 onTurnEnd 无此值） */
    action?: ActionDefinition
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
    /** tick 伤害回调 */
    onTickDamage?: (ctx: BuffHookCtx) => number
    /** tick 回复回调 */
    onTickHeal?: (ctx: BuffHookCtx) => number
    /** 攻击伤害修正（buff 持有者造成伤害时调用） */
    onDealDamage?: (ctx: BuffHookCtx) => number
    /** 造成伤害后追加独立伤害（返回 >0 则额外调 applyBonusDamage） */
    onAfterDealDamage?: (ctx: BuffHookCtx) => number
    /** 受击伤害修正（buff 持有者受到伤害时调用） */
    onTakeDamage?: (ctx: BuffHookCtx) => number
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
    /** 回合结束回调（turn_end 时调用，不依赖命中） */
    onTurnEnd?: (ctx: BuffHookCtx) => void
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
        onHitChance: ({ engine, attacker }) => {
            const dist = engine.state.position.distance(engine.state.characters[0].id, engine.state.characters[1].id)
            const maxRange = attacker.weaponDef?.range?.[1] ?? 4
            return dist <= maxRange ? 0.4 : 0
        },
    },
    {
        id: 'momentum',
        name: '刀势',
        description: '越战越勇，每层斩击伤害+10%, 命中率+5%。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 6 },
        onDealDamage: ({ final, layer }) => Math.round((final + final * 0.1 * layer.restoreValue) * 10) / 10,
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
        expiry: { type: 'permanent' },
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
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 1800 },
        stacking: { type: 'independent' },
        attrMods: { agility: -1, dexterity: -1 },
    },
    {
        id: 'frost',
        name: '霜冻',
        description: '身法降低，移动缓慢。',
        tags: [],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 3000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -0.4 },
    },
    {
        id: 'stun',
        name: '眩晕',
        description: '大幅降低身法、洞察（连续命中递减）。',
        tags: [],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 2000 },
        stacking: { type: 'independent' },
    },
    {
        id: 'sand_blind',
        name: '迷眼',
        description: '沙尘入眼，洞察大幅降低。',
        tags: [],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 2000 },
        stacking: { type: 'none' },
        attrMods: { insight: -4 },
    },
    {
        id: 'knockdown',
        name: '倒地',
        description: '重心不稳，倒地不起，身法大幅降低。',
        tags: [],
        expiry: { type: 'duration_by_attr', attr: 'vitality', multiplier: 2000 },
        stacking: { type: 'independent' },
        attrMods: { agility: -4 },
    },
    {
        id: 'burn',
        name: '灼烧',
        description: '持续火焰伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
    },
    {
        id: 'poison',
        name: '中毒',
        description: '持续毒素伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
    },
    {
        id: 'bleed',
        name: '流血',
        description: '行动触发额外伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive' },
    },

    // ── 伤害修正 buff ──
    {
        id: 'qi_shield',
        name: '炁盾',
        description: '吸收炁招式伤害，每次2点。',
        tags: [],
        onTakeDamage: ({ final, target, attacker, engine, action, layer }) => {
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
        onTakeDamage: ({ final, target, action, engine }) => {
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
        onDealDamage: ({ final, attacker, layer }) => {
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
        onDealDamage: ({ final, attacker }) =>
            Math.round((final + Math.round(attacker.attrs.get('dexterity') * 0.5 * 10) / 10) * 10) / 10,
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
        name: '跑得贼快',
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
        onCanParry: ({ self }) => !self.weaponDef?.tags.includes('parry'),
    },
    {
        id: 'silk_guard',
        name: '金丝护手',
        description: '金丝手套护持，无刃亦可格挡兵刃。',
        tags: [],
        expiry: { type: 'permanent' },
        onCanParry: ({ self }) => !self.weaponDef?.tags.includes('parry'),
    },

    // ── 永久修饰（构造期执行） ──
    { id: 'max_ap_mod', name: '失能', description: '最大AP变化。', tags: [], expiry: { type: 'permanent' } },
    { id: 'max_hp_mod', name: '失血', description: '最大HP变化。', tags: [], expiry: { type: 'permanent' } },
    {
        id: 'fumble_chance',
        name: '失心',
        description: '动作失败率。',
        tags: [],
        expiry: { type: 'duration', ms: 5000 },
        stacking: { type: 'additive' },
    },
    {
        id: 'permanent_burn',
        name: '过热',
        description: '持续灼烧伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 3000,
        onTickDamage: () => 1,
    },
    {
        id: 'vitality_regen',
        name: '生生不息',
        description: '持续恢复生命，血越少恢复越多。',
        tags: ['heal'],
        expiry: { type: 'permanent' },
        tickInterval: 1000,
        onTickHeal: ({ target }) => Math.round(target.maxHp * 0.005 + (target.maxHp - target.hp) * 0.01),
    },
    {
        id: 'qi_state',
        name: '凝炁状态',
        description: '炁劲充盈全身，全属性+1，炁系效果可作用于所有招式。',
        tags: [],
        expiry: { type: 'permanent' },
        attrMods: { strength: 1, vitality: 1, agility: 1, dexterity: 1, insight: 1 },
    },
    {
        id: 'qi_amplify',
        name: '炁意',
        description: '凝炁玉增幅，炁系招式伤害+15%。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, action, engine }) => {
            const hasQiState = engine.state.pendingBuffs.has(`qi_state::${attacker.id}`)
            const isQi = action?.tags?.includes('qi') || attacker?.weaponDef?.tags?.includes('qi') || hasQiState
            if (!isQi) return final
            return Math.round(final * 1.1 * 10) / 10
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
        id: 'vigor_stance',
        name: '刚劲',
        description: '剑势·刚，力道+4/层，身法-2/层。最多2层。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        attrMods: { strength: 4, agility: -2 },
    },
    {
        id: 'gentle_stance',
        name: '柔劲',
        description: '剑势·柔，身法+4/层，力道-2/层。最多2层。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'additive', max: 2 },
        attrMods: { agility: 4, strength: -2 },
    },
    {
        id: 'dark_room_sense',
        name: '暗室雀眼',
        description: '暗室练就的敏锐感知，免疫迷眼。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'yue_nv_buff',
        name: '越女剑意',
        description: '白猿授剑，灵巧化为剑势，附加灵巧×0.2伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker }) =>
            Math.round((final + Math.round(attacker.attrs.get('dexterity') * 0.2 * 10) / 10) * 10) / 10,
    },
    {
        id: 'herb_pouch',
        name: '蜂草鱼囊',
        description: '每 3 秒自动化解一层毒素。',
        tags: [],
        expiry: { type: 'permanent' },
        tickInterval: 3000,
        onTickHeal: ({ target, engine }) => {
            const poisonKey = `poison::${target.id}`
            const poisonLayer = engine.state.pendingBuffs.get(poisonKey)
            if (poisonLayer && poisonLayer.restoreValue > 0) {
                poisonLayer.restoreValue -= 1
                engine.emitLog({
                    type: 'system',
                    message: `[蜂草鱼囊] ${target.name} 解毒-1层`,
                    actorId: target.id,
                })
                if (poisonLayer.restoreValue <= 0) {
                    engine.state.pendingBuffs.delete(poisonKey)
                }
            }
            return 0
        },
    },
    {
        id: 'thunder_constitution',
        name: '雷电锻体',
        description: '雷系伤害减免80%，其他伤害减免10%。',
        tags: [],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final, action }) => {
            if (action?.tags?.includes('electric')) {
                return Math.round(final * 0.2 * 10) / 10
            }
            return Math.round(final * 0.9 * 10) / 10
        },
    },
    {
        id: 'thunder_bonus',
        name: '雷法',
        description: '攻击附加3点雷击伤害。',
        tags: [],
        expiry: { type: 'permanent' },
        onAfterDealDamage: () => 2,
    },
    {
        id: 'cinnabar_mark',
        name: '守宫砂·印',
        description: '每次攻击积攒一颗雷印，满四颗后下一击爆发。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, layer, engine }) => {
            if (layer.restoreValue >= 4) {
                layer.restoreValue = 0
                engine.emitLog({ type: 'system', message: '[守宫砂] 雷印爆发！伤害×1.5', actorId: attacker.id })
                return Math.round(final * 1.5 * 10) / 10
            }
            layer.restoreValue = (layer.restoreValue ?? 0) + 1
            engine.emitLog({
                type: 'system',
                message: `[守宫砂] ${attacker.name} 雷印+1（${layer.restoreValue}/4）`,
                actorId: attacker.id,
            })
            return final
        },
    },

    // ── 缠劲溢出奖励 ──
    {
        id: 'zhou',
        name: '周',
        description: '缠劲充盈，周身劲力流转。全属性+1。',
        tags: [],
        expiry: { type: 'permanent' },
        stacking: { type: 'none' },
        attrMods: { strength: 1, agility: 1, vitality: 1, wisdom: 1, dexterity: 1, insight: 1 },
    },

    // ── 杨过 ──
    {
        id: 'poison_resist',
        name: '蛇毒不侵',
        description: '毒抗+70%。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'tide_power',
        name: '潮汐内力',
        description: '内力如潮汐涨落，每回合交替以力道或身法驱动。',
        tags: [],
        expiry: { type: 'permanent' },
        onDealDamage: ({ final, attacker, layer }) => {
            const isStr = (layer.restoreValue ?? 0) === 0
            const attr = isStr ? 'strength' : 'agility'
            const bonus = Math.round(attacker.attrs.get(attr) * 0.1 * 10) / 10
            return Math.round((final + bonus) * 10) / 10
        },
        onTurnEnd: ({ attacker, engine, layer }) => {
            const isStr = (layer.restoreValue ?? 0) === 0
            const nextLabel = isStr ? '身法' : '力道'
            layer.restoreValue = isStr ? 1 : 0
            engine.emitLog({
                type: 'system',
                message: `[潮汐内力] ${attacker.name} 转为${nextLabel}驱动`,
                actorId: attacker.id,
            })
        },
    },
    {
        id: 'heavy_training',
        name: '玄铁剑法',
        description: '以力驭剑，重型武器身法负担减半。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'heavy_parry_ignore',
        name: '玄铁剑意',
        description: '重剑无锋，大巧不工。招架无法减免玄铁剑的伤害。',
        tags: [],
        expiry: { type: 'permanent' },
    },
    {
        id: 'iron_defense',
        name: '铁布衫',
        description: '所受直伤-20%。',
        tags: [],
        expiry: { type: 'permanent' },
        onTakeDamage: ({ final }) => Math.round(final * 0.8 * 10) / 10,
    },
]

export function getBuff(id: string): BuffDef | undefined {
    return BUFF_DB.find((b) => b.id === id)
}
