import { getWeapon } from '../../data/weapons/weapons'

/**
 * 长柄（polearm）：两只手都握在杆上 → 两只手都要盖皮肤遮罩。
 * 非长柄只盖「锚定的那只手」。判定用引擎数据的 tag；编辑器里的临时 id 查不到就按非长柄处理。
 */
export function isPolearm(weaponId: string | undefined): boolean {
    if (!weaponId) return false
    try {
        return getWeapon(weaponId).tags.includes('polearm')
    } catch {
        return false
    }
}
