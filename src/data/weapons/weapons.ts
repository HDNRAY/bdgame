import type { GameEntity } from '../../engine/entities/base'
import type { EffectDef } from '../../engine/entities/action'
import type { SummonDef } from '../../engine/entities/summon'
import type { TriggerSlot } from '../../engine/entities/trigger'
import { AttrName } from '../../engine/entities/attributes'
import { STARTING_WEAPONS } from './starting-weapons'

export interface WeaponDef extends GameEntity {
    bound?: boolean
    effects?: EffectDef[]
    triggers?: TriggerSlot[]
    grantsActions?: string[]
    range: [number, number]
    /** 召唤物定义（御物武器使用） */
    summon?: SummonDef
    /** 装备属性要求（不达标则武器效果不生效） */
    requireAttrsMin?: Partial<Record<AttrName, number>>
}

/** 武器数据（数组，不包括初始武器，初始武器在 starting-weapons.ts） */
export const WEAPON_DB: WeaponDef[] = [
    // ── 棍 ──
    {
        id: 'po_lang_zhu_zhi',
        name: '破狼竹枝',
        description: '经特殊药水浸泡多年的竹枝，坚如钢铁，轻如竹羽。招架后减免3点伤害。',
        tags: ['parry', 'polearm', 'blunt'],
        range: [1, 4],
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'po_lang_zhu_zhi_buff' }] },
        ],
    },
    // ── 三节枪 ──
    {
        id: 'three_section_spear',
        name: '春翁',
        description: '三段式机关枪，通过旋转接口切换形态。',
        tags: ['pierce', 'parry', 'polearm', 'slash'],
        range: [1, 3],
        grantsActions: ['_spear_throw'],
    },
    {
        id: 'iron_back_hand',
        name: '素手无相',
        description: '一枚古朴的玉环，以炁驱动时延展覆盖整条手臂，化作无形护甲。拳劲透体，伤人于无形。',
        tags: ['unarmed', 'parry'],
        range: [0, 1],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'iron_back_buff' }] }],
    },
    {
        id: 'broken_blade',
        name: '断刀',
        description: '一把残损的断刀。加装锁链，免疫缴械。',
        tags: ['slash', 'parry', 'melee', 'one_handed'],
        range: [1, 2],
        triggers: [{ condition: { type: 'on_opponent_move_away' }, actionId: '_shuai_ren' }],
    },
    {
        id: 'iron_spear',
        name: '铁枪·破军',
        description: '丈二铁枪，势大力沉。',
        tags: ['pierce', 'parry', 'polearm'],
        effects: [{ type: 'stat_buff', attrs: { agility: -2, strength: 2 } }],
        range: [1, 4],
    },
    {
        id: 'fusi_sword',
        name: '弗思剑',
        description: '最快的剑之一，闪避后本能蓄势。',
        tags: ['pierce', 'slash', 'parry', 'melee', 'one_handed'],
        range: [1, 3],
        triggers: [
            { condition: { type: 'on_dodge' }, actionId: '_fusi_crit_stack' },
            { condition: { type: 'on_crit' }, actionId: '_fusi_reset' },
        ],
    },
    {
        id: 'zantetsu',
        name: '藏锋',
        description: '锋藏于鞘，出鞘一瞬，无物不斩。',
        tags: ['slash', 'parry', 'melee', 'one_handed'],
        range: [1, 3],
        triggers: [
            {
                condition: { type: 'on_stance' },
                actionId: '_cangfeng_mind_eye',
            },
        ],
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '以炁凝成的无形之刃。',
        tags: ['slash', 'parry', 'dual_wield', 'qi', 'melee', 'one_handed'],
        range: [1, 3],
    },
    {
        id: 'xiu_dong',
        name: '绣冬',
        description: '绣冬长三尺二寸，势沉力猛。暴击率提升，暴击后剑意凝寒，锋芒更盛。',
        tags: ['slash', 'parry', 'frost', 'melee', 'heavy', 'one_handed'],
        range: [1, 3],
        effects: [{ type: 'stat_buff', attrs: { agility: -4, strength: 4 } }],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'xiu_dong_buff' }] }],
    },
    {
        id: 'chun_lei',
        name: '春雷',
        description: '轻灵迅捷，见血封喉。灵巧化为致命锋芒。',
        tags: ['slash', 'parry', 'melee', 'one_handed'],
        range: [0, 2],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'chun_lei_buff' }] }],
    },
    {
        id: 'overlord_blade',
        name: '素铁霸刀',
        description: '与身同高的巨刃，离心力驱动，势不可挡。',
        tags: ['slash', 'parry', 'polearm', 'heavy'],
        effects: [],
        requireAttrsMin: { strength: 10, agility: 9 },
        range: [1, 4],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'overlord_blade' }],
            },
        ],
    },
    {
        id: 'dark_iron_sword',
        name: '玄铁重剑',
        description: '与身同高的玄铁巨剑，重六十四斤，无锋无刃。大巧不工，以力破万法。',
        tags: ['heavy', 'blunt', 'slash', 'pierce', 'parry', 'polearm'],
        requireAttrsMin: { strength: 10, agility: 11 },
        range: [1, 4],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'dark_iron_weight' }],
            },
        ],
    },
    {
        id: 'heshan_sword',
        name: '阿赖耶识',
        description: '一把触及识海的唐刀，可同时使用拳掌功夫。命中后窃取对手 1 点洞察，持续 3 秒。',
        tags: ['slash', 'pierce', 'unarmed', 'parry', 'melee', 'one_handed'],
        range: [1, 3],
        grantsActions: ['_alaya_insight'],
        triggers: [{ condition: { type: 'on_hit' }, actionId: '_alaya_insight' }],
    },
    {
        id: 'dinghai_shen_tie',
        name: '陨铁神珍',
        description: '对传说中兵器的仿制品。由天外陨铁打造，由使用者的炁激活，伸缩自如。',
        tags: ['parry', 'polearm', 'heavy'],
        range: [1, 6],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'dinghai_pressure' }] }],
    },
    {
        id: 'yanling_blade',
        name: '惊鸿',
        description: '薄刃轻刀，雁翎般轻灵。',
        tags: ['slash', 'parry', 'melee', 'one_handed'],
        range: [0, 2],
        effects: [{ type: 'stat_buff', attrs: { agility: 1, dexterity: 1, strength: 1 } }],
    },
    {
        id: 'qianji',
        name: '千机',
        description: '漆黑纳米长棍，可在相似尺寸的固态构造间快速切换——箫、笛、细剑、长短棍、手杖乃至遮阳伞。',
        tags: ['melee', 'pierce', 'parry', 'slash', 'blunt', 'unarmed', 'polearm', 'one_handed'],
        range: [0, 3],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'qianji_crit' }] }],
    },
    // ── 引擎铁锤（天工·千星） ──
    {
        id: 'engine_hammer',
        name: '引擎铁锤',
        description: '天工锻造的电磁锤，以炁驱动，雷火交加。代价：运转耗能，AP回复-0.1/s。',
        tags: ['blunt', 'electric', 'qi', 'craft', 'polearm'],
        range: [1, 2],
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'engine_hammer_buff' }] },
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'energy_drain', stacks: 1 }],
            },
            {
                condition: { type: 'on_hit' },
                effects: [{ type: 'add_debuff', buffId: 'burn', stacks: 1, chance: 0.5 }],
            },
        ],
    },
    {
        id: 'hover_drone',
        name: '浮游无人机',
        description: '一枚悬浮的无人机平台，以炁供能，脑机操控。',
        tags: ['imperial', 'range', 'pierce', 'summon'],
        bound: true,
        range: [0, 6],
        // 御物耗炁：每秒扣 0.5AP（3 机）。无人机 = 中速破甲流（2伤+破甲1）
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'yuwu_cost', stacks: 0.5 }] },
        ],
        summon: {
            id: 'hover_drone',
            name: '无人机',
            maxCount: (self) => Math.min(5, 1 + Math.round(self.attrs.get('wisdom') / 4)),
            actionId: '_drone_shot',
        },
    },
    {
        id: 'ninja_sword',
        name: '极乐',
        description: '忍者短刀，轻便灵活，可藏于袖中。',
        tags: ['slash', 'pierce', 'parry', 'melee', 'unarmed', 'one_handed'],
        range: [0, 2],
    },
    {
        id: 'zhen_bei_ji',
        name: '镇北戟',
        description: '姬家世代相传的战戟，曾为守关领袖所用。经千星重铸为赛博战戟，可将使用者的炁转化为冰电之力。',
        tags: ['polearm', 'parry', 'pierce', 'blunt', 'electric'],
        range: [1, 4],
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'zhen_bei_ji_buff' }] },
            // 攻击被闪避 → 攻击者叠游身（步法追击）
            { condition: { type: 'on_dodged' }, effects: [{ type: 'add_buff', buffId: 'you_shen', stacks: 1 }] },
            // 攻击被招架 → 招架方麻痹（电流反噬）
            {
                condition: { type: 'on_parried' },
                effects: [{ type: 'add_debuff', buffId: 'paralyze', stacks: 1, chance: 1 }],
            },
        ],
    },
    {
        id: 'buer_sword',
        name: '不二剑',
        description: '最快的剑之一，起手暴击大增但身法略滞，逐回合恢复。',
        tags: ['pierce', 'slash', 'parry', 'melee', 'one_handed'],
        range: [1, 3],
        triggers: [
            { condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'buer_sword', stacks: 20 }] },
        ],
    },
]

// ── 运行时武器查找表 ──
let weaponMap: Map<string, WeaponDef> | null = null

/** 初始化武器查找表（包含 WEAPON_DB + STARTING_WEAPONS） */
export function initWeapons(): void {
    weaponMap = new Map([
        ...WEAPON_DB.map((w) => [w.id, w] as const),
        ...STARTING_WEAPONS.map((w) => [w.id, w] as const),
    ])
}

export function getWeapon(id: string): WeaponDef {
    if (!weaponMap) initWeapons()
    const w = weaponMap!.get(id)
    if (!w) throw new Error(`Unknown weapon: ${id}`)
    return w
}
