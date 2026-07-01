/**
 * 触发条件/事件的中文显示 — 纯展示适配，不涉及游戏状态
 */

import { TRIGGER_CONDITIONS } from '../engine/data/triggers'

/** 所有触发事件的中文名 */
const TRIGGER_NAMES: Record<string, string> = {
    on_parry: '招架时',
    on_dodged: '被闪避时',
    on_hit: '命中时',
    hp_below: 'HP低于阈值时',
    on_dodge: '闪避时',
    turn_start: '回合开始',
    on_attack: '攻击时',
    on_dealt_damage: '造成伤害时',
    on_was_hit: '被命中时',
    on_took_damage: '受到伤害时',
    on_parried: '被招架时',
    on_debuff: '被减益时',
    on_poison: '施加中毒时',
    on_burn: '施加灼烧时',
    on_bleed: '施加流血时',
    on_stun: '施加眩晕时',
    on_paralyze: '施加麻痹时',
    on_sand_blind: '施加致盲时',
    on_disarm: '缴械时',
    on_disarmed: '被缴械时',
    on_move: '移动时',
    on_opponent_move: '对手移动时',
    on_crit: '暴击时',
    on_pre_action: '行动前',
    turn_end: '回合结束时',
    battle_start: '战斗开始时',
    on_buff: '获得增益时',
    on_stance: '进入架势时',
    chan_overflow: '缠劲溢出时',
    on_action_trigger: '触发器触发时',
    on_equip: '装备时',
    on_melee: '被近身命中时',
    on_range: '被远程命中时',
    on_unarmed: '被拳脚命中时',
    on_polearm: '被长兵命中时',
}

/** 所有触发事件的中文描述 */
const TRIGGER_DESCS: Record<string, string> = {
    on_parry: '招架对手攻击时触发',
    on_dodged: '攻击被对手闪避时触发',
    on_hit: '攻击命中时触发',
    on_dodge: '闪避对手攻击时触发',
    on_attack: '攻击时触发',
    on_dealt_damage: '造成伤害时触发',
    on_was_hit: '被攻击命中时触发',
    on_took_damage: '受到伤害时触发',
    on_parried: '攻击被对手招架时触发',
    on_debuff: '受到减益效果时触发',
    on_poison: '使目标中毒时触发',
    on_burn: '使目标灼烧时触发',
    on_bleed: '使目标流血时触发',
    on_stun: '使目标眩晕时触发',
    on_paralyze: '使目标麻痹时触发',
    on_sand_blind: '使目标致盲时触发',
    on_disarm: '缴械目标时触发',
    on_disarmed: '自身被缴械时触发',
    on_move: '移动时触发',
    on_opponent_move: '对手移动时触发',
    on_crit: '暴击时触发',
    on_pre_action: '行动之前触发',
    turn_end: '每回合结束时触发',
    battle_start: '战斗开始时触发',
    on_buff: '自身获得增益状态时触发',
    on_stance: '进入架势状态时触发',
    chan_overflow: '缠劲达到上限时触发',
    on_action_trigger: '触发招式执行时触发',
    on_melee: '被对手近战攻击命中时触发',
    on_range: '被对手远程攻击命中时触发',
    on_unarmed: '被对手拳脚攻击命中时触发',
    on_polearm: '被对手长兵攻击命中时触发',
}

/** 根据触发事件类型获取中文名 */
export function getTriggerName(type: string): string {
    return TRIGGER_NAMES[type] ?? type
}

/** 根据触发事件类型获取描述 */
export function getTriggerDesc(type: string): string {
    return TRIGGER_DESCS[type] ?? ''
}

/** 根据触发条件 ID 获取中文名 */
export function getTriggerConditionName(id: string): string {
    const tc = TRIGGER_CONDITIONS.find((t) => t.id === id)
    return tc ? (TRIGGER_NAMES[tc.type] ?? tc.type) : id
}
