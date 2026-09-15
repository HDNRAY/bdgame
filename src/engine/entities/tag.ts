/** 统一标签类型（武器/效果/分类） */
export type Tag =
    | 'qi' // 炁
    | 'unarmed' // 空手
    | 'slash' // 劈砍
    | 'blunt' // 钝击
    | 'pierce' // 戳刺
    | 'parry' // 可招架
    | 'imperial' // 御物
    | 'paralyze' // 麻痹
    | 'burn' // 灼烧
    | 'poison' // 中毒
    | 'stun' // 眩晕
    | 'cleanse' // 净化
    | 'bleed' // 流血
    | 'counter' // 反击
    | 'ignore_parry' // 无视招架
    | 'self_damage' // 自伤
    | 'knockback' // 击退
    | 'implant' // 义体
    | 'heal' // 回复
    | 'buff' // 增益
    | 'electric' // 雷电
    | 'trigger' // 触发
    | 'talent' // 天赋
    | 'passive' // 功法
    | 'frost' // 霜冻
    | 'polearm' // 长柄
    | 'heavy' // 重型武器（力道驱动，可与 polearm 叠加）
    | 'heavy_reduce' // 化解重器负担（玄剑/潮汐，重器负担计算用）
    | 'sand_blind' // 迷眼
    | 'knockdown' // 倒地
    | 'pre_action' // 前摇
    | 'post_action' // 收招
    | 'move' // 位移
    | 'range' // 远程
    | 'internal' // 内部实现（不对用户/AI暴露）
    // | 'charge' // 冲锋
    | 'defense' // 防御
    | 'debuff' // 弱化
    | 'melee' // 近战武器
    | 'one_handed' // 单手
    | 'two_handed' // 双手
    | 'summon' // 召唤相关
    | 'stance' // 架势/姿态
    | 'retrieve_weapon' // 收回武器
    | 'bonus_damage' // 独立附加伤害
    | 'range_up' // 增加攻击范围
    | 'inherent' // 特性（不可复制、不可禁用）
    | 'weapon' // 武器来源的 buff
    | 'thrown' // 暗器
    | 'super_armor' // 罡体
    | 'jiu' // 酒
    | 'craft' // 锻造品（天工出品，无副作用的人造装备）
    | 'qi_action' // 炁招（纯炁凝聚、按招式自身 tag 判定是否带刃的招式，如炁弹/炁刃）
    | 'chan' // 缠劲（消耗缠/回复缠的奖励标签）
    | 'low_hp' // 残血（血量越低越强 / 用血换效果的奖励标签）
