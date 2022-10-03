enum TEAM_ID {
    PLAYER = 0,
    ENEMY = 1,
}

enum BATTLE_RESULT {
    NO_RESULT = 0,
    PLAYER_WIN = 1,
    ENEMY_WIN = 2,
    ALL_LOSE = 3,
}

enum TARGET_TYPE {
    SELF = 0,
    ALLY = 1,
    OPPONENT = 2,
    ALL = 3,
}

export const MAX_TURN_LIMIT = 300

export { TEAM_ID, BATTLE_RESULT, TARGET_TYPE }
