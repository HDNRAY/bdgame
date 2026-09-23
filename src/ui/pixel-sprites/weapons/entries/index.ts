/**
 * 武器登记表：把「一个武器一个文件」的条目汇总成 WEAPON_OVERLAYS（美术）与 WEAPON_POSES（挂点）。
 * 两个表的键顺序沿用拆分前（渲染顺序 / 面板顺序依赖它）。
 */
import type { WeaponArtTable, WeaponOverlay } from '../../types'
import type { WeaponPoseTable } from '../poses'
import { bare_hands } from './bare_hands'
import { zantetsu } from './zantetsu'
import { ciyuan_blade } from './ciyuan_blade'
import { overlord_blade } from './overlord_blade'
import { tri_orb } from './tri_orb'
import { xiu_dong } from './xiu_dong'
import { chun_lei } from './chun_lei'
import { heshan_sword } from './heshan_sword'
import { dagger } from './dagger'
import { special_forces_dagger } from './special_forces_dagger'
import { iron_spear } from './iron_spear'
import { zhen_bei_ji } from './zhen_bei_ji'
import { peach_sword } from './peach_sword'
import { qimei_staff } from './qimei_staff'
import { dark_iron_sword } from './dark_iron_sword'
import { po_lang_zhu_zhi } from './po_lang_zhu_zhi'
import { dinghai_shen_tie } from './dinghai_shen_tie'
import { long_spear } from './long_spear'
import { ninja_sword } from './ninja_sword'
import { iron_back_hand } from './iron_back_hand'
import { yanling_blade } from './yanling_blade'
import { ganjiang_sword } from './ganjiang_sword'
import { moxie_sword } from './moxie_sword'
import { fei_jian } from './fei_jian'
import { fusi_sword } from './fusi_sword'
import { buer_sword } from './buer_sword'

/** 武器 id → 条目 */
export const WEAPON_ENTRIES: Record<
    string,
    { overlay?: WeaponOverlay; art?: WeaponArtTable; poses: WeaponPoseTable }
> = {
    bare_hands,
    dark_iron_sword,
    tri_orb,
    xiu_dong,
    chun_lei,
    heshan_sword,
    dagger,
    special_forces_dagger,
    iron_spear,
    zhen_bei_ji,
    ninja_sword,
    iron_back_hand,
    peach_sword,
    qimei_staff,
    po_lang_zhu_zhi,
    dinghai_shen_tie,
    long_spear,
    zantetsu,
    ciyuan_blade,
    overlord_blade,
    yanling_blade,
    ganjiang_sword,
    moxie_sword,
    fei_jian,
    fusi_sword,
    buer_sword,
}

const weaponIds = [
    'bare_hands',
    'dark_iron_sword',
    'tri_orb',
    'xiu_dong',
    'chun_lei',
    'heshan_sword',
    'special_forces_dagger',
    'dagger',
    'ninja_sword',
    'iron_back_hand',
    'iron_spear',
    'zhen_bei_ji',
    'peach_sword',
    'qimei_staff',
    'po_lang_zhu_zhi',
    'dinghai_shen_tie',
    'long_spear',
    'overlord_blade',
    'yanling_blade',
    'ganjiang_sword',
    'moxie_sword',
    'fei_jian',
    'fusi_sword',
    'buer_sword',
]

/** 武器叠加层（纯美术） */
export const WEAPON_OVERLAYS: Record<string, WeaponOverlay> = {}
for (const id of weaponIds) {
    const entry = WEAPON_ENTRIES[id]
    if (entry?.overlay) WEAPON_OVERLAYS[id] = entry.overlay
}

/** 逐姿势美术（只含登记了 art 的武器；缺的姿势由 getWeaponArt 逐级坍缩） */
export const WEAPON_ARTS: Record<string, WeaponArtTable> = {}
for (const id of weaponIds) {
    const entry = WEAPON_ENTRIES[id]
    if (entry?.art) WEAPON_ARTS[id] = entry.art
}

/** 每武器·每姿势挂点配置 */
export const WEAPON_POSES: Record<string, WeaponPoseTable> = {}
for (const id of weaponIds) {
    const entry = WEAPON_ENTRIES[id]
    if (entry) WEAPON_POSES[id] = entry.poses
}
