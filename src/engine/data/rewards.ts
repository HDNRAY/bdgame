import type { Tag } from '../entities/tag'
import type { AttrName } from '../entities/attributes'
import type { GameEntity } from '../entities/base'
import { WEAPON_DB } from './weapons'

/** 节点奖励类型 */
export type RewardType = 'stat' | 'passive' | 'implant' | 'action'

export interface Reward extends GameEntity {
    type: RewardType
}

export const STAT_NAMES: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

/** 全量奖励池 */
export const REWARD_POOL: Reward[] = [
    // 属性
    ...STAT_NAMES.map((s) => ({
        type: 'stat' as const,
        id: s,
        name: `${s} +1`,
        description: `${s} +1`,
        tags: [] as Tag[],
    })),
    // 功法
    { type: 'passive', id: 'forge', name: '三分归元气', description: '全属性+2，濒危回血', tags: [] },
    { type: 'passive', id: 'spirit_resonance', name: '灵器共鸣', description: '召唤物伤害+2，力道-2', tags: [] },
    {
        type: 'passive',
        id: 'ling_bo_wei_bu',
        name: '凌波微步',
        description: 'AGI≥18时解锁，闪避反击+最低移动消耗',
        tags: [],
    },
    // 义体
    { type: 'implant', id: 'titanium_arm', name: '钛合金臂', description: 'STR/DEX+4，AGI-2', tags: [] },
    { type: 'implant', id: 'hydraulic_leg', name: '液压腿', description: '移动效率+20%，AGI-1', tags: [] },
    { type: 'implant', id: 'mechanical_eye', name: '机械眼球', description: 'INS+2，maxAP-1', tags: [] },
    { type: 'implant', id: 'muscle_boost', name: '肌肉强化针', description: 'STR/VIT+2，maxHP-20', tags: [] },
    { type: 'implant', id: 'heart_pump', name: '心肺泵', description: '全属性+1，maxAP-2', tags: [] },
    { type: 'implant', id: 'neural_net', name: '人造神经网络', description: 'AGI/DEX/INS+1，失心5%', tags: [] },
    { type: 'implant', id: 'combat_chip', name: '战斗芯片', description: 'WIS+4，失心5%', tags: [] },
    { type: 'implant', id: 'power_furnace', name: '便携式动力炉', description: 'maxAP+4，永久灼烧', tags: [] },
    // 招式主招
    { type: 'action', id: 'straight_punch', name: '正拳', description: '3AP 基础拳击', tags: [] },
    { type: 'action', id: 'crushing_blow', name: '崩拳', description: '5AP 崩劲伤害', tags: [] },
    { type: 'action', id: 'iron_charge', name: '铁山靠', description: '7AP 麻痹+自伤', tags: [] },
    { type: 'action', id: 'flick', name: '弹指', description: '2AP 麻痹弹指', tags: [] },
    { type: 'action', id: 'thrust', name: '刺击', description: '4AP 刺击流血', tags: [] },
    { type: 'action', id: 'fissure', name: '裂地击', description: '8AP 范围麻痹', tags: [] },
    { type: 'action', id: 'needle', name: '飞针', description: '3AP 远程麻痹', tags: [] },
    { type: 'action', id: 'poison_dart', name: '毒镖', description: '5AP 中毒', tags: [] },
    { type: 'action', id: 'tempest', name: '暴雨梨花', description: '8AP 群伤，限2次', tags: [] },
    { type: 'action', id: 'tremor_stomp', name: '震脚', description: '5AP 眩晕', tags: [] },
    { type: 'action', id: 'break_formation', name: '破军', description: '3AP 净化', tags: [] },
    { type: 'action', id: 'pursuit_thrust', name: '追刺', description: '2AP 追击流血', tags: [] },
    { type: 'action', id: 'jab', name: '刺拳', description: '1AP 快速攻击', tags: [] },
]

/** 开局可选武器（排除默认的 bare_hands） */
export const STARTING_WEAPONS: readonly string[] = WEAPON_DB.filter((w) => w.id !== 'bare_hands').map((w) => w.id)
