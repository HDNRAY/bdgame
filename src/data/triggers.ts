import type { TriggerCondition } from '../engine/entities/trigger'

/**
 * 触发条件表（按 triggerId 引用：`ActionConfig.triggerId` / 数据里的触发槽）。
 *
 * 两种用途要分清：
 *  - **玩家可选**：进构筑面板的触发槽下拉（`SELECTABLE_TRIGGER_CONDITIONS`）。
 *    要求：有中文名（`getTriggerConditionName` 依赖 `TRIGGER_NAMES[type]`）、且名字互不重复。
 *  - **内部种类**（`internal: true`）：只给数据/引擎用，不进下拉。典型是那些玩家靠「出招条件」
 *    已经能表达的阈值（如血量低于 X%），或语义与别的条件重叠、玩家区分不了的。
 *
 * 数据层自带触发（功法/奇物/武器/被动）是直接写 `TriggerSlot` 对象（`{ type, check }`），
 * 不经过本表的 id，所以标记 internal 不影响它们。
 */
export const TRIGGER_CONDITIONS: TriggerCondition[] = [
    { id: 'on_parry', type: 'on_parry' },
    { id: 'on_dodged', type: 'on_dodged' },
    { id: 'on_summon_hit', type: 'on_summon_hit' },
    { id: 'on_was_crit', type: 'on_was_crit' },
    {
        id: 'hp_below_30',
        type: 'hp_below',
        check: (ctx) => (ctx.actor.hp / ctx.actor.maxHp) * 100 < 30,
        maxUses: 1,
        // 内部：血量阈值交给「出招条件」表达，不做成玩家触发槽（且与 hp_below_50 同名，玩家区分不了）
        internal: true,
    },
    {
        id: 'hp_below_50',
        type: 'hp_below',
        check: (ctx) => (ctx.actor.hp / ctx.actor.maxHp) * 100 < 50,
        maxUses: 1,
        // 内部：同上
        internal: true,
    },
    { id: 'on_dodge', type: 'on_dodge' },
    { id: 'on_turn_start', type: 'on_turn_start' },
    { id: 'on_turn_end', type: 'on_turn_end' },
    { id: 'on_attack', type: 'on_attack' },
    { id: 'on_dealt_damage', type: 'on_dealt_damage' },
    { id: 'on_was_hit', type: 'on_was_hit' },
    // 内部：与「被命中时」在玩家侧区分不开（差别只是有没有真的掉血），事件本身仍由引擎广播
    { id: 'on_took_damage', type: 'on_took_damage', internal: true },
    { id: 'on_parried', type: 'on_parried' },
    { id: 'on_debuff', type: 'on_debuff' },
    { id: 'on_poison', type: 'on_poison' },
    { id: 'on_burn', type: 'on_burn' },
    { id: 'on_bleed', type: 'on_bleed' },
    { id: 'on_stun', type: 'on_stun' },
    { id: 'on_paralyze', type: 'on_paralyze' },
    { id: 'on_sand_blind', type: 'on_sand_blind' },
    { id: 'on_disarm', type: 'on_disarm' },
    { id: 'on_disarmed', type: 'on_disarmed' },
    { id: 'on_move_closer', type: 'on_move_closer' },
    { id: 'on_move_away', type: 'on_move_away' },
    { id: 'on_opponent_move_closer', type: 'on_opponent_move_closer' },
    { id: 'on_opponent_move_away', type: 'on_opponent_move_away' },
    { id: 'on_crit', type: 'on_crit' },
    { id: 'battle_start', type: 'battle_start' },
]

/** 玩家在构筑面板能选的触发条件（过滤掉内部种类） */
export const SELECTABLE_TRIGGER_CONDITIONS: TriggerCondition[] = TRIGGER_CONDITIONS.filter((t) => !t.internal)
