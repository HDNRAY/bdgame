import type { AttrName } from '../entities/attributes'
import type { GameEntity } from '../entities/base'
import type { SummonDef } from '../entities/summon'

export type WeaponTag = 'slash' | 'blunt' | 'pierce' | 'parry' | 'imperial'

export interface WeaponDef extends GameEntity {
    tags: WeaponTag[]
    bound?: boolean
    attrMods: Partial<Record<AttrName, number>>
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
        attrMods: {},
        range: [0, 2],
    },
    {
        id: 'iron_ring',
        name: '铁指环',
        description: '一对老旧的铁指环，拳拳到肉。',
        tags: ['blunt'],
        bound: false,
        attrMods: { strength: 1 },
        range: [0, 2],
    },
    {
        id: 'iron_spear',
        name: '铁枪·破军',
        description: '丈二铁枪，势大力沉。',
        tags: ['pierce', 'parry'],
        bound: false,
        attrMods: { agility: -2, strength: 2 },
        range: [2, 4],
    },
    {
        id: 'throwing_dagger',
        name: '飞刀·影',
        description: '三柄柳叶飞刀，例无虚发。',
        tags: ['slash', 'pierce'],
        bound: false,
        attrMods: { agility: 1 },
        range: [2, 5],
    },
    {
        id: 'tri_orb',
        name: '三相珠',
        description: '三颗由炁劲驱动的法珠，环绕主人旋转。',
        tags: ['imperial', 'parry'],
        attrMods: {},
        range: [1, 5],
        summon: {
            id: 'orb',
            name: '法珠',
            maxCount: 3,
            actionId: 'orb_shot',
        },
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
