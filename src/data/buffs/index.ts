import { BUFF_DB } from '../buffs'
import { DEBUFF_DB } from './debuffs'
import { BuffDef } from './types'

export type { BuffHookCtx, BuffExpiry, BuffStacking, BuffDef } from './types'
export { BUFF_DB } from './buffs'
export { DEBUFF_DB } from './debuffs'

export function getBuff(id: string): BuffDef | undefined {
    return BUFF_DB.find((b) => b.id === id) ?? DEBUFF_DB.find((b) => b.id === id)
}
