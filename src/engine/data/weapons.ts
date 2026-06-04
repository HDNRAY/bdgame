import type { AttrName } from '../entities/attributes'
import type { GameEntity } from '../entities/base'

export type WeaponTag = '劈砍' | '钝击' | '戳刺' | '招架'

export interface WeaponDef extends GameEntity {
    tags: WeaponTag[]
    bound?: boolean
    attrMods: Partial<Record<AttrName, number>>
    range: [number, number]
}

/** 武器数据（数组，可在初始化时构建为 Map） */
export const WEAPON_DB: WeaponDef[] = [
    {
        id: 'bare_hands',
        name: '赤手空拳',
        description: '什么都没有，但什么都有可能。',
        tags: ['钝击'],
        bound: false,
        attrMods: {},
        range: [0, 2],
    },
    {
        id: 'iron_ring',
        name: '铁指环',
        description: '一对老旧的铁指环，拳拳到肉。',
        tags: ['钝击'],
        bound: false,
        attrMods: { strength: 1 },
        range: [0, 2],
    },
    {
        id: 'iron_spear',
        name: '铁枪·破军',
        description: '丈二铁枪，势大力沉。',
        tags: ['戳刺', '招架'],
        bound: false,
        attrMods: { agility: -2, strength: 2 },
        range: [2, 4],
    },
    {
        id: 'throwing_dagger',
        name: '飞刀·影',
        description: '三柄柳叶飞刀，例无虚发。',
        tags: ['劈砍', '戳刺'],
        bound: false,
        attrMods: { agility: 1 },
        range: [2, 5],
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
