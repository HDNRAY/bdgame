import type { GameEntity } from '../entities/base'
import type { EffectDef } from '../entities/action'
import type { SummonDef } from '../entities/summon'
import type { TriggerSlot } from '../entities/trigger'
import { AttrName } from '../entities/attributes'

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

/** 武器数据（数组，可在初始化时构建为 Map） */
export const WEAPON_DB: WeaponDef[] = [
    {
        id: 'bare_hands',
        name: '赤手空拳',
        description: '什么都没有，但什么都有可能。',
        tags: ['blunt', 'dual_wield', 'melee'],
        bound: false,
        effects: [{ type: 'stat_buff', attrs: { agility: 2 } }],
        range: [0, 2],
    },
    {
        id: 'military_dagger',
        name: '军用匕首',
        description: '短小锋利的制式匕首，专攻要害。',
        tags: ['slash', 'pierce', 'melee'],
        range: [0, 2],
    },
    {
        id: 'iron_spear',
        name: '铁枪·破军',
        description: '丈二铁枪，势大力沉。',
        tags: ['pierce', 'parry', 'polearm', 'melee'],
        bound: false,
        effects: [{ type: 'stat_buff', attrs: { agility: -2, strength: 2 } }],
        range: [2, 4],
    },
    {
        id: 'tri_orb',
        name: '三相珠',
        description: '三颗由炁劲驱动的法珠，环绕主人旋转。',
        tags: ['imperial', 'parry', 'range'],
        range: [0, 6],
        summon: {
            id: 'orb',
            name: '法珠',
            maxCount: 3,
            actionId: 'orb_shot',
        },
    },
    {
        id: 'twin_swords',
        name: '青山双剑',
        description: '最快的不二剑和最快的弗思剑',
        tags: ['pierce', 'slash', 'imperial', 'parry', 'trigger', 'dual_wield', 'melee'],
        range: [1, 3],
        triggers: [
            { condition: { type: 'battle_start' }, actionId: '_buer_init' },
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
        tags: ['slash', 'parry', 'frost', 'dual_wield', 'melee'],
        range: [1, 3],
        effects: [{ type: 'stat_buff', attrs: { strength: 4, agility: -2 } }],
        triggers: [{ condition: { type: 'battle_start' }, effects: [{ type: 'add_buff', buffId: 'frost_dex_bonus' }] }],
    },
    {
        id: 'dual_swords',
        name: '双剑',
        description: '一手一剑，攻守兼备。',
        tags: ['pierce', 'parry', 'dual_wield', 'melee'],
        range: [1, 3],
    },
    {
        id: 'overlord_blade',
        name: '霸刀',
        description: '与身同高的巨刃，离心力驱动，势不可挡。',
        tags: ['slash', 'blunt', 'parry', 'heavy', 'melee'],
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
        tags: ['heavy', 'blunt', 'slash', 'pierce', 'parry'],
        effects: [{ type: 'stat_buff', attrs: { agility: -10, strength: 4 } }],
        requireAttrsMin: { strength: 12, agility: 11 },
        range: [1, 3],
        triggers: [
            {
                condition: { type: 'on_equip' },
                effects: [{ type: 'add_buff', buffId: 'heavy_parry_ignore' }],
            },
        ],
    },
    {
        id: 'heshan_sword',
        name: '河山铁剑',
        description: '一把普通的两用钢铸军剑，可同时使用拳掌功法。',
        tags: ['slash', 'pierce', 'blunt', 'parry'],
        range: [1, 3],
    },
]

// ── 运行时武器查找表 ──
let weaponMap: Map<string, WeaponDef> | null = null

/** 初始化武器查找表 */
export function initWeapons(): void {
    weaponMap = new Map(WEAPON_DB.map((w) => [w.id, w]))
}

export function getWeapon(id: string): WeaponDef {
    if (!weaponMap) initWeapons()
    const w = weaponMap!.get(id)
    if (!w) throw new Error(`Unknown weapon: ${id}`)
    return w
}
