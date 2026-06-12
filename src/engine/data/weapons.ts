import type { GameEntity } from '../entities/base'
import type { EffectDef } from '../entities/action'
import type { SummonDef } from '../entities/summon'
import type { TriggerSlot } from '../entities/trigger'

export interface WeaponDef extends GameEntity {
    bound?: boolean
    effects?: EffectDef[]
    triggers?: TriggerSlot[]
    range: [number, number]
    /** 召唤物定义（御物武器使用） */
    summon?: SummonDef
}

/** 武器数据（数组，可在初始化时构建为 Map） */
export const WEAPON_DB: WeaponDef[] = [
    {
        id: 'bare_hands',
        name: '赤手空拳',
        description: '什么都没有，但什么都有可能。',
        tags: ['blunt'],
        bound: false,
        range: [0, 2],
    },
    {
        id: 'iron_spear',
        name: '铁枪·破军',
        description: '丈二铁枪，势大力沉。',
        tags: ['pierce', 'parry'],
        bound: false,
        effects: [{ type: 'stat_buff', attrs: { agility: -2, strength: 2 } }],
        range: [2, 4],
    },
    {
        id: 'tri_orb',
        name: '三相珠',
        description: '三颗由炁劲驱动的法珠，环绕主人旋转。',
        tags: ['imperial', 'parry'],
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
        tags: ['pierce', 'slash', 'imperial', 'parry', 'trigger'],
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
        tags: ['slash', 'parry'],
        range: [1, 3],
        triggers: [{ condition: { type: 'on_buff' }, actionId: '_zantetsu_mind_eye' }],
    },
    {
        id: 'ciyuan_blade',
        name: '次元刃',
        description: '以炁凝成的无形之刃，无视招架。',
        tags: ['slash', 'parry', 'ignore_parry', 'qi'],
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
