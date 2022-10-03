import { BattleCharacter, BattleUnit } from './interfaces'

export const isAlive = (c: BattleUnit) =>
    c.type === 'character' && (c as BattleCharacter).realtimeAttributes!.volumne.health > 0
