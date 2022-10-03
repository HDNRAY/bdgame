import { BATTLE_RESULT, MAX_TURN_LIMIT, TEAM_ID } from './constant'
import EventCharacterAction from './events/eventCharacterAction'
import { BattleCharacter, BattleState, BattleUnit } from './interfaces'
import Queue from './queue'
import { isAlive } from './utils'
import { Effect } from './skillEffect'

const willStart = (state: BattleState) => {
    console.log('will start')

    state.characters.forEach((character) => initialCharacterStatus(character))

    initEventQueue(state)

    // state.actionLogs = []
    // state.result = BATTLE_RESULT.NO_RESULT
}

const initialCharacterStatus = (unit: BattleUnit) => {
    if (unit.type === 'character') {
        const u = unit as BattleCharacter
        const { volumne, base } = u.staticAttributes
        u.realtimeAttributes = {
            volumne: { ...volumne },
            base: { ...base },
        }
    }
    console.log("initialed %s's status", unit.name)
}

const initEventQueue = (state: BattleState) => {
    // state.eventQueue = new Queue()
    state.characters.forEach((character) => {
        state.eventQueue.insertInOrder(new EventCharacterAction(character, state))
    })
}

const didStart = (state: BattleState) => {
    //处理战斗开始之前的计算，比如加载装备和被动技能到状态
    console.log('did start')

    // state.start = new Date()
    // state.turnCount = 0
}

const doBattle = (state: BattleState) => {
    while (state.result === 0) {
        state.turnCount++
        // 计算一切可能的效果
        prepareEffects(state)
        // 实施效果
        implementEffects(state)
        // 检查是否战斗结束
        checkContinue(state)

        // 保护机制
        if (state.turnCount >= MAX_TURN_LIMIT) {
            state.result = BATTLE_RESULT.ALL_LOSE
        }

        if (state.result === 0) reQueue(state)
    }
}

const checkContinue = (state: BattleState) => {
    const playerTeamAlive = state.characters.some(
        (character) => isAlive(character) && character.team === TEAM_ID.PLAYER
    )
    const enemyTeamAlive = state.characters.some((character) => isAlive(character) && character.team === TEAM_ID.ENEMY)

    if (playerTeamAlive && !enemyTeamAlive) {
        state.result = BATTLE_RESULT.PLAYER_WIN
    } else if (!playerTeamAlive && enemyTeamAlive) {
        state.result = BATTLE_RESULT.ENEMY_WIN
    } else if (!playerTeamAlive && !enemyTeamAlive) {
        state.result = BATTLE_RESULT.ALL_LOSE
    } else {
        state.result = BATTLE_RESULT.NO_RESULT
    }
}

const prepareEffects = (state: BattleState) => {
    state.eventsInTurn = state.eventQueue.getEventsInTurn()
    state.effects = state.eventsInTurn.reduce((effects: Array<Effect>, event) => {
        const newEffects = event.getEffects(state)
        return effects.concat(newEffects)
    }, [])
}

//Check the alive status, add buffers, dots and other effects.
const implementEffects = (state: BattleState) => {
    state.effects.forEach((effect) => {
        effect.implement()
        state.actionLogs.push(effect.description)
    })
}

const reQueue = (state: BattleState) => {
    //Insert the executors in processedQueue back to the eventQueue
    state.eventsInTurn.forEach((event) => {
        if (event.hasNextTurn()) {
            state.eventQueue.insertInOrder(event.rebuild())
        }
    })
}

const onEnd = (state: BattleState) => {
    //处理战斗结果
    console.log(
        'player status',
        state.characters.filter((c) => c.team === TEAM_ID.PLAYER)
    )
    console.log(
        'enemy status',
        state.characters.filter((c) => c.team === TEAM_ID.ENEMY)
    )
    console.log('time cost', `${new Date().getTime() - state.start.getTime()} ms`)
    console.log('turn count', state.turnCount)
    console.log('logs', state.actionLogs)

    if (state.result === BATTLE_RESULT.ENEMY_WIN) {
        console.log('enemyTeam win!')
    } else if (state.result === BATTLE_RESULT.PLAYER_WIN) {
        console.log('playerTeam win!')
    } else {
        console.log('no win!')
    }
}

const Battle = {
    compute: (state: BattleState) => {
        //外部方法
        willStart(state)
        didStart(state)
        doBattle(state)
        onEnd(state)
    },
    create: (characters: Array<BattleUnit>) => {
        const state: BattleState = {
            characters,
            start: new Date(),
            actionLogs: [],
            eventQueue: new Queue(),
            turnCount: 0,
            result: BATTLE_RESULT.NO_RESULT,
            eventsInTurn: [],
            effects: [],
        }
        return state
    },
}

export default Battle
