import { type OpponentDef } from '.'
import { passive, artifact, action, weapon } from '../../systems/reward-pool'

const YANGGUO_ATTRS = { strength: 10, vitality: 10, agility: 14, dexterity: 14, insight: 20, wisdom: 8 }

export const YANGGUO: OpponentDef = {
    id: 'yangguo',
    name: '西狂·过儿',
    weapon: 'qingfeng_jian',
    targetAttrs: YANGGUO_ATTRS,
    rewards: [
        action('quanzhen_sword'),
        passive('one_arm'),
        passive('dark_iron_sword_art'),
        passive('dark_room_catch'),
        passive('tide_inner_power'),
        artifact('snake_gall'),
        action('yunv_sword'),
        weapon('dark_iron_sword'),
        action('flick'),
        action('desolate_palm'),
    ],
    actionConfigs: [
        { actionId: 'desolate_palm' }, // AI 出招顺序
        { actionId: 'quanzhen_sword' }, // AI 出招顺序
        { actionId: 'flick', triggerId: 'on_dodge' },
        { actionId: 'yunv_sword', triggerId: 'on_parry' },
    ],
}
