export { PASSIVES } from './passives'
export { TALENTS, getTalent } from './talents'
import { PASSIVES } from './passives'
import { TALENTS } from './talents'
import type { Passive, Talent } from '../../engine/entities/passive'

export function getPassive(id: string): Passive | Talent | undefined {
    return PASSIVES.find((p) => p.id === id) ?? TALENTS.find((t) => t.id === id) ?? undefined
}
