/**
 * 武器登记表：把「一个武器一个文件」的条目汇总成 WEAPON_OVERLAYS（美术）与 WEAPON_POSES（挂点）。
 * 两个表的键顺序沿用拆分前（渲染顺序 / 面板顺序依赖它）。
 */
import type { WeaponOverlay } from '../../types'
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
import { iron_spear } from './iron_spear'
import { zhen_bei_ji } from './zhen_bei_ji'
import { peach_sword } from './peach_sword'
import { qimei_staff } from './qimei_staff'
import { dark_iron_sword } from './dark_iron_sword'
import { po_lang_zhu_zhi } from './po_lang_zhu_zhi'
import { dinghai_shen_tie } from './dinghai_shen_tie'
import { long_spear } from './long_spear'

/** 武器 id → 条目 */
export const WEAPON_ENTRIES: Record<string, { overlay?: WeaponOverlay; poses: WeaponPoseTable }> = { bare_hands,
    dark_iron_sword,
    tri_orb,
    xiu_dong,
    chun_lei,
    heshan_sword,
    dagger,
    iron_spear,
    zhen_bei_ji,
    peach_sword,
    qimei_staff,
    po_lang_zhu_zhi,
    dinghai_shen_tie,
    long_spear,
    zantetsu,
    ciyuan_blade,
    overlord_blade }

/** 武器叠加层（纯美术） */
export const WEAPON_OVERLAYS: Record<string, WeaponOverlay> = { }
for (const id of ['bare_hands', 'dark_iron_sword', 'tri_orb', 'xiu_dong', 'chun_lei', 'heshan_sword', 'dagger', 'iron_spear', 'zhen_bei_ji', 'peach_sword', 'qimei_staff', 'po_lang_zhu_zhi', 'dinghai_shen_tie', 'long_spear']) { const entry = WEAPON_ENTRIES[id]
    if (entry?.overlay) WEAPON_OVERLAYS[id] = entry.overlay
}

/** 每武器·每姿势挂点配置 */
export const WEAPON_POSES: Record<string, WeaponPoseTable> = { }
for (const id of ['bare_hands', 'zantetsu', 'ciyuan_blade', 'overlord_blade', 'tri_orb', 'xiu_dong', 'chun_lei', 'heshan_sword', 'dagger', 'iron_spear', 'zhen_bei_ji', 'peach_sword', 'qimei_staff', 'dark_iron_sword', 'po_lang_zhu_zhi', 'dinghai_shen_tie', 'long_spear']) { const entry = WEAPON_ENTRIES[id]
    if (entry) WEAPON_POSES[id] = entry.poses
}
