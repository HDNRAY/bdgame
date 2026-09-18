import type { TriggerCondition } from '../engine/entities/trigger'

/**
 * 触发条件表（按 triggerId 引用：`ActionConfig.triggerId` / 数据里的触发槽）。
 *
 * **概念边界（别混）**
 *  - 触发器 = 见招拆招：由交手过程中**发生的事件**驱动 —— 招架、闪避、被命中、被缴械、
 *    对手靠近/远离、给对手挂上中毒/流血、回合开始…… 本表只收这类事件。
 *  - 出招条件 = 自己的套路：**自身状态门槛**（气血/内息/缠劲/距离/状态层数/时间）走
 *    `ActionConfig.condition`（见 src/data/conditions.ts），不进本表。
 *    例：血量低于 30% 是「自己的状态」，不是交手事件 —— 它由出招条件表达，不做成触发槽。
 *
 * **表内两种用途**
 *  - 玩家可选（进构筑面板下拉）：要求有中文名、且名字互不重复（有测试把关）
 *  - 内部种类（`internal: true`）：只给数据/引擎用，不进下拉
 *
 * 本表是**玩家可选项**，不是全部触发事件：引擎事件里另有 `on_hit` / `on_stance` / `on_buff` /
 * `chan_overflow` / `on_action_trigger` / `on_attack` 等，只给数据层声明用（buff 消耗触发、功法/武器自带触发），
 * 不进玩家下拉。`on_attack` 尤其宽泛——等于「每次攻击都触发」，故不列为玩家选项。
 *
 * 数据层自带触发（功法/奇物/武器/被动）是直接写 `TriggerSlot` 对象（`{ type, check }`），不经过本表的 id。
 * 所以**引擎的触发事件可以不出现在本表里**：例如 `hp_below` 只服务数据里声明的「濒危反应」被动
 * （三分归元气 HP<30%、炁体源流 HP<20%），属内部触发，与玩家可选表无关 —— 不要因为本表没有就去删事件。
 */
export const TRIGGER_CONDITIONS: TriggerCondition[] = [
    { id: 'on_parry', type: 'on_parry' },
    { id: 'on_dodged', type: 'on_dodged' },
    { id: 'on_summon_hit', type: 'on_summon_hit' },
    { id: 'on_was_crit', type: 'on_was_crit' },
    { id: 'on_dodge', type: 'on_dodge' },
    { id: 'on_turn_start', type: 'on_turn_start' },
    { id: 'on_turn_end', type: 'on_turn_end' },
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
