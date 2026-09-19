import { DMG_PER_POISON_TICK, MAX_CHAN } from '../../engine/constants'
import { getAction as getBaseAction } from './index'
import type { ActionDefinition } from '../../engine/entities/action'
import { forEachBuffOf } from '../../engine/combat/utils'
import { round1 } from '../../engine/util/math'

/**
 * 公开招式（玩家可装备）
 * 每招机制唯一，不重复。
 */
export const PLAYER_ACTIONS: ActionDefinition[] = [
    // ── 暗器系 ──
    {
        id: 'flick',
        name: '弹指',
        description: '指间弹出炁劲，击中目标短暂眩晕。',
        requiredTags: [],
        apCost: 2,
        tags: ['thrown', 'stun', 'qi', 'range', 'blunt', 'debuff'],
        effects: [
            { type: 'damage', scaling: { strength: 0.2, dexterity: 0.1 } },
            { type: 'add_debuff', buffId: 'stun', stacks: 1, chance: 0.4 },
        ],
        getRange: () => [0, 6],
    },
    {
        id: 'blood_droplet',
        name: '血滴子',
        description: '以血为引，凝炁成滴，射向对手。消耗10%当前气血。',
        requiredTags: [],
        apCost: 1,
        tags: ['qi', 'unarmed', 'range', 'thrown', 'low_hp', 'self_damage'],
        getRange: () => [1, 4],
        onActionHitChance: (base) => base + 0.3,
        hookNotes: { hitChance: '+30%' },
        effects: [
            // 血引：以血为引，先耗10%当前气血（不受命中影响，miss 也耗血）
            { type: 'self_hp_cost', ratio: 0.1 },
            // 1:1 换血：伤害 = 所耗之血。扣血已先行执行，fn 拿到的是扣后血：
            {
                type: 'functional_damage',
                fn: ({ self }) => round1(self.hp / 9),
                note: '造成与所耗等额伤害（1:1 换血）',
            },
        ],
    },
    {
        id: 'yin_zhen',
        name: '银针',
        description: '一指银针破空而去，精准刺穴。',
        requiredTags: [],
        apCost: 2,
        tags: ['pierce', 'range', 'thrown', 'ignore_parry'],
        getRange: () => [0, 5] as [number, number],
        effects: [
            { type: 'ignore_parry' },
            { type: 'damage', scaling: { dexterity: 0.2, strength: 0.1 }, piercingRatio: 0.5 },
        ],
    },
    {
        id: 'dart_throw',
        name: '五芒镖',
        description: '五芒破空，轨迹莫测。',
        requiredTags: [],
        apCost: 2,
        tags: ['slash', 'range', 'thrown'],
        getRange: () => [0, 5],
        onActionHitChance: (base) => base + 0.03,
        hookNotes: { hitChance: '+3%' },
        effects: [{ type: 'damage', scaling: { strength: 0.3, dexterity: 0.1 } }],
    },
    {
        id: 'yufeng_needle',
        name: '玉蜂针',
        description: '玉蜂针破空，附寒毒麻痹。',
        requiredTags: [],
        apCost: 2,
        tags: ['range', 'thrown', 'paralyze', 'pierce', 'poison'],
        getRange: () => [1, 6] as [number, number],
        effects: [
            // { type: 'damage', scaling: { strength: 0.1, dexterity: 0.1 } },
            { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 1 },
            { type: 'add_debuff', buffId: 'poison', stacks: 1, chance: 1 },
        ],
    },
    {
        id: 'throwing_knife',
        name: '飞刀',
        description: '例不虚发，飞刀破空，刀势凌厉易出暴击。',
        requiredTags: [],
        apCost: 2,
        tags: ['range', 'pierce', 'slash', 'thrown'],
        getRange: () => [0, 6],
        onActionCritChance: (base) => base + 0.1,
        hookNotes: { critChance: '+10%' },
        effects: [{ type: 'damage', scaling: { dexterity: 0.1, strength: 0.1 }, fixed: 2 }],
    },
    {
        id: 'sheng_si_fu',
        name: '生死符',
        description: '一道气劲凝符，穿透防御直击经脉。',
        requiredTags: [],
        apCost: 4,
        tags: ['range', 'thrown', 'qi'],
        getRange: () => [1, 5] as [number, number],
        effects: [{ type: 'damage', scaling: { wisdom: 0.5 }, piercing: 10 }],
    },
    // ── 雷系 ──
    {
        id: 'electric_yoyo',
        name: '电力溜溜球',
        description: '电力灌注的溜溜球，远近皆宜。',
        requiredTags: [],
        apCost: 2,
        tags: ['electric', 'debuff', 'qi', 'paralyze'],
        getRange: () => [1, 3] as [number, number],
        onActionHitChance: (base) => base + 0.2,
        hookNotes: { hitChance: '+20%' },
        effects: [
            { type: 'damage', scaling: { wisdom: 0.3 } },
            { type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 0.5 },
        ],
    },
    {
        id: 'thunder_storm',
        name: '雷蛇',
        description: '以炁化雷，电蛇出击，眩晕对手。',
        requiredTags: [],
        apCost: 5,
        tags: ['electric', 'stun', 'chan', 'debuff', 'ignore_parry'],
        getRange: () => [0, 4] as [number, number],
        chanCost: 15,
        hookNotes: { hitChance: '+25%' },
        effects: [
            { type: 'damage', scaling: { wisdom: 2 }, piercingRatio: 0.3 },
            { type: 'add_debuff', buffId: 'stun', stacks: 1, chance: 1 },
            { type: 'ignore_parry' },
        ],
        onActionHitChance: (base) => base + 0.25,
    },
    // ── 枪棍系 ──
    {
        id: 'rod_thrust',
        name: '棍戳',
        description: '长棍直戳，力透千钧。',
        requiredTags: ['blunt', 'polearm'],
        apCost: 2,
        tags: ['blunt', 'polearm'],
        onActionHitChance: (base) => base + 0.05,
        hookNotes: { hitChance: '+5%' },
        effects: [{ type: 'damage', scaling: { strength: 0.25, dexterity: 0.1 } }],
    },
    {
        id: 'rod_cleave',
        name: '棍劈',
        description: '高举过顶，一棍劈下，势不可挡。',
        requiredTags: ['polearm'],
        apCost: 2,
        tags: ['blunt', 'polearm'],
        onActionCritChance: (base) => base + 0.1,
        hookNotes: { critChance: '+10%' },
        effects: [{ type: 'damage', scaling: { strength: 0.3, vitality: 0.1 } }],
    },
    {
        id: 'rod_lift',
        name: '棍挑',
        description: '竹棍上挑，力透棍梢。',
        requiredTags: ['polearm'],
        apCost: 2,
        tags: ['blunt', 'polearm'],
        onActionCritDamage: (base) => base + 0.2,
        hookNotes: { critDamage: '+20%' },
        effects: [{ type: 'damage', scaling: { strength: 0.2, dexterity: 0.2 } }],
    },
    {
        id: 'rod_sweep',
        name: '横扫',
        description: '横扫千军，造成失衡。',
        requiredTags: ['polearm'],
        apCost: 2,
        tags: ['knockdown', 'polearm', 'debuff', 'blunt'],
        effects: [
            { type: 'damage', scaling: { strength: 0.35 } },
            { type: 'add_debuff', buffId: 'knockdown', stacks: 1, chance: 1 },
        ],
    },
    {
        id: 'fissure',
        name: '裂地击',
        description: '猛砸地面，造成冲击波。',
        requiredTags: ['polearm'],
        apCost: 3,
        tags: ['paralyze', 'ignore_parry', 'debuff', 'blunt', 'polearm'],
        effects: [
            { type: 'damage', scaling: { strength: 0.6 } },
            { type: 'add_debuff', buffId: 'paralyze', stacks: 2, chance: 0.6 },
            { type: 'ignore_parry' },
        ],
    },
    {
        id: 'return_spear',
        name: '回马枪',
        description: '佯装撤退，回首一枪。需要38层缠劲。',
        requiredTags: ['polearm'],
        apCost: 5,
        chanCost: 38,
        tags: ['polearm', 'pierce', 'chan', 'range'],
        getRange: () => [3, 4],
        onActionHitChance: (base) => base + 0.3,
        onActionCritChance: (base) => base + 0.3,
        hookNotes: { hitChance: '+30%', critChance: '+30%' },
        effects: [{ type: 'damage', scaling: { strength: 1, dexterity: 0.6, agility: 0.6 } }],
    },
    {
        id: 'stand_rod_kick',
        name: '立棍踢',
        description: '以棍撑地，凌空一脚。',
        requiredTags: ['polearm'],
        apCost: 2,
        tags: ['blunt', 'polearm', 'debuff', 'knockdown'],
        getRange: () => [1, 4],
        effects: [
            { type: 'damage', scaling: { strength: 0.1, vitality: 0.1, agility: 0.1 } },
            { type: 'add_debuff', buffId: 'knockdown', stacks: 1, chance: 0.8 },
        ],
    },
    {
        id: 'po_lang_gun_fa',
        name: '破狼棍法',
        description: '棍出如狼，势不可挡。',
        requiredTags: ['polearm'],
        apCost: 4,
        tags: ['blunt', 'polearm'],
        onActionCritChance: (base) => base + 0.5,
        hookNotes: { critChance: '+50%' },
        effects: [{ type: 'damage', scaling: { strength: 0.4, agility: 0.1, vitality: 0.1, dexterity: 0.4 } }],
    },
    {
        id: 'yi_dian_han_mang',
        name: '一点寒芒',
        description: '寒芒一点。刺入瞬间寒意迸发，附加寒锋与霜冻。',
        requiredTags: ['polearm', 'pierce'],
        apCost: 2,
        tags: ['polearm', 'pierce', 'buff', 'frost', 'debuff'],
        effects: [
            { type: 'add_buff', buffId: 'chill_blade', stacks: 1 },
            { type: 'add_debuff', buffId: 'frost', stacks: 1, chance: 0.5 },
            { type: 'damage', scaling: { strength: 0.1, wisdom: 0.2 } },
        ],
    },
    {
        id: 'ru_long',
        name: '如龙',
        description: '苍龙镇北，如龙出海。',
        requiredTags: ['polearm', 'pierce'],
        apCost: 4,
        chanCost: 24,
        tags: ['polearm', 'pierce', 'chan'],
        effects: [
            { type: 'damage', scaling: { strength: 0.2 } },
            {
                type: 'functional_damage',
                fn: ({ state, self }) => {
                    // 统计自身非永久增益总层数（不含 debuff/永久状态）
                    let layers = 0
                    forEachBuffOf(state.pendingBuffs, self.id, (def, layer) => {
                        if (!def) return
                        if (def.tags?.includes('debuff')) return
                        if (def.expiry?.type === 'permanent') return
                        layers += layer.restoreValue ?? 1
                    })
                    return round1(self.attrs.get('wisdom') * 0.2 * layers)
                },
                note: '按自身非永久BUFF总层数增伤（推演×0.2×层数）',
            },
        ],
    },
    // ── 焰拳（橘子会·耗缠凝焰附刃） ──
    {
        id: 'yan_quan',
        name: '焰拳',
        description: '凝炁为焰，附于拳刃。一段时间内，任何伤害都有概率令目标灼烧。',
        requiredTags: [],
        apCost: 1,
        chanCost: 16,
        tags: ['pre_action', 'buff', 'chan', 'burn'],
        target: 'self',
        canUse: (attacker, state) => !state.pendingBuffs.has(`yan_qi::${attacker.id}`),
        hookNotes: { canUse: '已凝焰炁时不可重复' },
        effects: [{ type: 'add_buff', buffId: 'yan_qi' }],
    },
    // ── 钝器系 ──
    {
        id: 'hammer_swing',
        name: '挥击',
        description: '一记势大力沉的挥击。',
        requiredTags: ['blunt'],
        apCost: 2,
        tags: ['blunt', 'melee'],
        onActionCritChance: (base) => base + 0.1,
        hookNotes: { critChance: '+10%' },
        effects: [{ type: 'damage', scaling: { strength: 0.4 } }],
    },
    {
        id: 'thunder_strike',
        name: '雷霆一击',
        description: '高举铁锤，雷霆万钧砸下，电光四溢。',
        requiredTags: ['blunt'],
        apCost: 4,
        tags: ['blunt', 'electric', 'debuff', 'paralyze'],
        effects: [
            { type: 'damage', scaling: { strength: 0.6, wisdom: 0.4 } },
            { type: 'add_debuff', buffId: 'paralyze', stacks: 2, chance: 0.8 },
        ],
    },
    // ── 御物系 ──
    {
        id: 'one_night_dance',
        name: '一夜鱼龙舞',
        description: '御物万法，鱼龙起舞。消耗大量缠劲，连续发出5次攻击。',
        requiredTags: ['imperial'],
        apCost: 5,
        chanCost: 20,
        tags: ['range', 'summon', 'chan', 'imperial'],
        onActionHitChance: (base) => base + 0.1,
        hookNotes: { hitChance: '+10%' },
        effects: [{ type: 'damage', scaling: { wisdom: 0.28 }, fixed: 2, independentHits: 5 }],
    },
    {
        id: 'wan_fa_gui_yi',
        name: '万法归一',
        description: '御物万法，归一而发。令全部召唤物朝目标倾泻轰击，每击附推演之力。',
        requiredTags: ['imperial'],
        apCost: 5,
        chanCost: 33,
        tags: ['imperial', 'range', 'chan'],
        effects: [
            {
                type: 'functional_damage',
                fn: ({ self }) => {
                    const summon = self.weaponDef?.summon
                    if (!summon) return 0
                    const count = summon.maxCount(self)
                    const wis = self.attrs.get('wisdom')
                    // 武器召唤物招式原本单发伤害（damage fixed 或 fixed + wis×scaling）
                    const act = summon.action ?? getBaseAction(summon.actionId)
                    const dmgEff = act?.effects?.find((e) => e.type === 'damage')
                    let baseHit = 0
                    if (dmgEff?.type === 'damage') baseHit = (dmgEff.fixed ?? 0) + wis * (dmgEff.scaling?.wisdom ?? 0)
                    return round1(count * (baseHit + wis / 3))
                },
                note: '按当前召唤物数量倾泻伤害（数量 × (武器单发 + wis / 3)）',
            },
        ],
    },
    // ── 特殊系 ──
    {
        id: 'bi_hai_chao_sheng_qu',
        name: '碧海潮生曲',
        description: '以炁御音，曲如碧海潮生。无视招架，直摄心魄。',
        requiredTags: [],
        apCost: 3,
        tags: ['qi', 'range', 'debuff', 'ignore_parry'],
        getRange: () => [0, 9],
        effects: [
            { type: 'ignore_parry' },
            { type: 'damage', scaling: { dexterity: 0.2, wisdom: 0.3 } },
            { type: 'add_debuff', buffId: 'fumble_chance_temp', stacks: 2, chance: 1 },
        ],
    },
    {
        id: 'poison_detonate',
        name: '毒素引爆',
        description: '引爆对手身上的毒素，造成剩余跳数总伤害并清除所有毒层。',
        requiredTags: [],
        apCost: 5,
        chanCost: 30,
        tags: ['poison', 'qi', 'chan'],
        getRange: () => [0, 10],
        onActionHitChance: () => 1,
        hookNotes: { hitChance: '必中' },
        effects: [
            {
                type: 'functional_damage',
                fn: ({ enemy, state }) => {
                    const poisonKey = `poison::${enemy.id}`
                    const layer = state.pendingBuffs.get(poisonKey)
                    if (!layer) return 0
                    const remainingTicks: number[] = (layer.extra?.remainingTicks as number[]) ?? []
                    const totalRemaining = remainingTicks.reduce((s, t) => s + t, 0)
                    state.pendingBuffs.delete(poisonKey)
                    const AMPLIFY = 3.5
                    return totalRemaining * DMG_PER_POISON_TICK * AMPLIFY
                },
                note: '引爆目标剩余的全部中毒伤害',
            },
        ],
    },
    {
        id: 'steal_artifact',
        name: '探云手',
        description: '神偷绝技，偷取对手一件奇物。初始成功率81%，每得手一次减至三分之一。',
        requiredTags: [],
        apCost: 1,
        tags: [],
        target: 'enemy',
        getRange: () => [0, 5],
        // 对手无可偷奇物时不触发/不释放，避免 on_turn_start 每回合白烧 AP
        canUse: (attacker, state) => {
            const enemy = state.characters.find((c) => c.id !== attacker.id)
            return !!enemy && enemy.artifactDefs.some((a) => !a.tags.includes('inherent'))
        },
        hookNotes: { canUse: '对手持有奇物时才可窃取' },
        effects: [{ type: 'steal_artifact' }],
    },
    {
        id: 'tian_wai_fei_xian',
        name: '天外飞仙',
        description: '以身为剑，天外飞仙。',
        requiredTags: [],
        apCost: 5,
        chanCost: MAX_CHAN,
        tags: ['qi', 'thrown', 'chan', 'pierce'],
        onActionCritChance: (base) => base + 0.25,
        onActionCritDamage: (base) => base + 0.5,
        hookNotes: { critChance: '+25%', critDamage: '+50%' },
        effects: [
            { type: 'short_dash', maxDistance: 5 },
            {
                type: 'damage',
                scaling: { strength: 0.4, agility: 0.4, dexterity: 0.4, vitality: 0.4, wisdom: 0.8 },
                piercingRatio: 0.5,
            },
        ],
    },
]
