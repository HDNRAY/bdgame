// ════════════════════════════════════════
//  斗炁大会 — 统一导出
// ════════════════════════════════════════

export type * from '../entities/tournament'
export {
    GROUP_COUNT,
    GROUP_MIN_SIZE,
    GROUP_MAX_ROUNDS,
    KNOCKOUT_ROUNDS,
    KNOCKOUT_PARTICIPANTS,
    ROUND_LABELS,
} from '../entities/tournament'

export {
    buildGroupStage,
    buildGroupMatches,
    getGroupRoundMatches,
    buildKnockoutBracket,
    calculateGroupStandings,
    buildEmptyTournament,
    finalizeGroupStage,
} from './bracket-builder'

export { simulateSingleMatch, simulateGroupRound, simulateKnockoutRound } from './simulator'

export { selectParticipants } from './participants'
export type { SelectParticipantsOptions } from './participants'

export { processTournament } from './integration'
