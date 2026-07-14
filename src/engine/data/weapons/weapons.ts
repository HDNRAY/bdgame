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
        id: 'broken_blade',
        name: '断刀',
        description: '一把残损的断刀。加装锁链，免疫缴械。',
        tags: ['slash', 'parry', 'melee'],
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
        tags: ['pierce', 'slash', 'imperial', 'parry'],
        range: [1, 3],
        triggers: [
            { condition: { type: 'on_dodge' }, actionId: '_fusi_crit_stack' },
            { condition: { type: 'on_crit' }, actionId: '_fusi_reset' },
        ],
    },
    {
        id: 'zantetsu',
        name: '斩铁',
        description: '一刀两断，无物不斩。',
        tags: ['slash', 'parry', 'melee'],
        range: [1, 3],
        triggers: [
            {
                condition: { type: 'on_stance' },
                actionId: '_zantetsu_mind_eye',
            },
        ],
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '以炁凝成的无形之刃。',
        tags: ['slash', 'parry', 'dual_wield', 'qi', 'melee'],
        range: [1, 3],
    },
    {
        id: 'frost_twin_blades',
        name: '绣冬·春雷',
        description: '绣冬长三尺二寸，势沉力猛；春雷轻灵迅捷，见血封喉。',
        tags: ['slash', 'parry', 'frost', 'dual_wield', 'melee', 'heavy'],
        range: [1, 3],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'frost_dex_bonus' }] }],
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
        name: '玄铁剑',
        description: '与身同高的玄铁巨剑，重六十四斤，无锋无刃。大巧不工，以力破万法。',
        tags: ['heavy', 'blunt', 'slash', 'pierce', 'parry', 'polearm'],
        requireAttrsMin: { strength: 12, agility: 11 },
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
        tags: ['slash', 'pierce', 'unarmed', 'parry', 'melee'],
        range: [1, 3],
        grantsActions: ['_alaya_insight'],
    },
    {
        id: 'dinghai_shen_tie',
        name: '陨铁如意棒',
        description: '对传说中兵器的仿制品。由天外陨铁打造，由使用者的炁激活，伸缩自如。',
        tags: ['parry', 'polearm', 'heavy'],
        range: [1, 6],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'dinghai_pressure' }] }],
    },
    {
        id: 'yanling_blade',
        name: '惊鸿',
        description: '薄刃轻刀，雁翎般轻灵。',
        tags: ['slash', 'parry', 'melee'],
        range: [0, 2],
        effects: [{ type: 'stat_buff', attrs: { agility: 1, dexterity: 1, strength: 1 } }],
    },
    // ── 千机（药屋·黛玄） ──
    {
        id: 'qianji',
        name: '千机',
        description: '漆黑纳米长棍，可在相似尺寸的固态构造间快速切换——箫、笛、细剑、长短棍、手杖乃至遮阳伞。',
        tags: ['melee', 'polearm', 'pierce', 'parry', 'slash', 'blunt', 'unarmed'],
        range: [0, 3],
        triggers: [{ condition: { type: 'on_equip' }, effects: [{ type: 'add_buff', buffId: 'qianji_crit' }] }],
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
