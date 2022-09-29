import { CharacterFactory } from './factories/CharacterFactory'
import Character, { CharacterInfo } from './models/Character'
import BattleScene from './scenes/BattleScene'

export default class Game {
    private _currentBattleScene: BattleScene | undefined
    mainCharacter: Character
    skills: Array<any>

    constructor(params: GameInfo) {
        this.mainCharacter = CharacterFactory.buildCharacterFromInfo(params.mainCharacter)
        this.skills = params.skills
    }

    createBattleScene() {
        this._currentBattleScene = new BattleScene()
        return this._currentBattleScene
    }

    endCurrentBattleScene() {
        this._currentBattleScene = undefined
    }

    currentBattleScene(): BattleScene | undefined {
        return this._currentBattleScene
    }
}

export interface GameInfo {
    mainCharacter: CharacterInfo
    skills: Array<any>
}
