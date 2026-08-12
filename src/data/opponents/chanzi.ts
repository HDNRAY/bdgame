import { type OpponentDef } from '.'
import { action, passive, artifact } from '../../engine/util/reward-utils'

const CHANZI_ATTRS = { strength: 16, vitality: 16, wisdom: 16, agility: 9, dexterity: 8, insight: 11 }

export const CHANZI: OpponentDef = {
    id: 'chanzi',
    name: '禅子',
    story: '多林寺的修禅之人，与来风、竹子同届师兄弟。不习武艺，只求禅定悟道——以炁观心，静坐参禅。掌法与金钟皆是禅修中无意悟得，推演通明，可于未发之前窥破对手破绽。',
    battleStyle: 'melee',
    weapon: 'bare_hands',
    targetAttrs: CHANZI_ATTRS,
    rewards: [
        action('palm_strike'),
        passive('yi_jin_jing'),
        action('qinlong_gong'),
        passive('chanzi_chan_regen'),
        action('chanzi_heal'),
        action('chanzi_stance'),
        action('jin_zhong_zhao'),
        action('ru_lai_shen_zhang'),
        action('deng_ping_du_shui'),
        artifact('pu_ti_zhu'),
        passive('chan_xin_hui_yan'),
        // 11
    ],
    actionConfigs: [
        { actionId: 'jin_zhong_zhao' },
        { actionId: 'chanzi_heal', conditionId: 'hp_below_70' },
        { actionId: 'ru_lai_shen_zhang' },
        { actionId: 'palm_strike', triggerId: 'on_parried' },
        { actionId: 'qinlong_gong', triggerId: 'on_dodge' },
    ],
}
