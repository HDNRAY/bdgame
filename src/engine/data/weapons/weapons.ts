import type { GameEntity } from '../../entities/base'
import type { EffectDef } from '../../entities/action'
import type { SummonDef } from '../../entities/summon'
import type { TriggerSlot } from '../../entities/trigger'
import { AttrName } from '../../entities/attributes'
import { STARTING_WEAPONS } from './starting-weapons'

export interface WeaponDef extends GameEntity {
    bound?: boolean
    effects?: EffectDef[]
    triggers?: TriggerSlot[]
    range: [number, number]
    /** 召唤物定义（御物武器使用） */
    summon?: SummonDef
    /** 装备属性要求（不达标则武器效果不生效） */
    requireAttrsMin?: Partial<Record<AttrName, number>>
}

/** 武器数据（数组，不包括初始武器，初始武器在 starting-weapons.ts） */
export const WEAPON_DB: WeaponDef[] = [
    {
        id: 'broken_blade',
        name: '断刀',
        description: '一把残损的断刀。加装锁链，免疫缴械。',
        tags: ['slash', 'parry', 'melee'],
        range: [1, 2],
    },
    {
        id: 'iron_spear',
        name: '铁枪·破军',
        description: '丈二铁枪，势大力沉。',
        tags: ['pierce', 'parry', 'polearm'],
        bound: false,
        effects: [{ type: 'stat_buff', attrs: { agility: -2, strength: 2 } }],
        range: [2, 4],
    },
    {
        id: 'qing_shan_swords',
        name: '青山双剑',
        description: '最快的不二剑和最快的弗思剑',
        tags: ['pierce', 'slash', 'imperial', 'parry', 'trigger', 'dual_wield', 'melee'],
        range: [1, 3],
        triggers: [
            { condition: { type: 'battle_start' }, actionId: '_buer_init' },
            { condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'qing_shan_recovery' }] },
            { condition: { type: 'on_dodge' }, actionId: '_fusi_crit_stack' },
        ],
    },
    {
        id: 'zantetsu',
        name: '斩铁',
        description: '一刀两断，无物不斩。',
        tags: ['slash', 'parry', 'melee'],
        range: [1, 3],
        triggers: [{ condition: { type: 'on_buff' }, actionId: '_zantetsu_mind_eye' }],
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '以炁凝成的无形之刃。',
        tags: ['slash', 'parry', 'dual_wield', 'qi', 'melee'],
        range: [1, 4],
    },
    {
        id: 'frost_twin_blades',
        name: '绣冬·春雷',
        description: '绣冬长三尺二寸，势沉力猛；春雷轻灵迅捷，见血封喉。',
        tags: ['slash', 'parry', 'frost', 'dual_wield', 'melee', 'heavy'],
        range: [1, 3],
        effects: [{ type: 'stat_buff', attrs: { strength: 4, agility: -2 } }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'frost_dex_bonus' }] }],
    },
    {
        id: 'overlord_blade',
        name: '素铁霸刀',
        description: '与身同高的巨刃，离心力驱动，势不可挡。',
        tags: ['slash', 'unarmed', 'parry', 'heavy', 'melee'],
        effects: [],
        requireAttrsMin: { strength: 12, agility: 11 },
        range: [1, 3],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'overlord_blade' }],
            },
            {
                condition: { type: 'on_parry' },
                effects: [{ type: 'add_buff', buffId: 'momentum', stacks: 1 }],
            },
        ],
    },
    {
        id: 'dark_iron_sword',
        name: '玄铁剑',
        description: '与身同高的玄铁巨剑，重六十四斤，无锋无刃。大巧不工，以力破万法。',
        tags: ['heavy', 'blunt', 'slash', 'pierce', 'parry', 'melee'],
        requireAttrsMin: { strength: 12, agility: 11 },
        range: [1, 3],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'dark_iron_weight' }],
            },
        ],
    },
    {
        id: 'heshan_sword',
        name: '河山铁剑',
        description: '一把普通的两用钢铸军剑，可同时使用拳掌功法。',
        tags: ['slash', 'pierce', 'unarmed', 'parry', 'melee'],
        range: [1, 3],
    },
    {
        id: 'dinghai_shen_tie',
        name: '陨铁如意棒',
        description: '对传说中兵器的仿制品。由天外陨铁打造，由使用者的炁激活，伸缩自如。',
        tags: ['unarmed', 'parry', 'polearm', 'heavy', 'melee'],
        range: [1, 6],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'dinghai_pressure' }] }],
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
