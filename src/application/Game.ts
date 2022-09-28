import Character from './models/Character'
import BattleScene from './scenes/BattleScene'

export default class Game {
    private _currentBattleScene: BattleScene | undefined
    mainCharacter: Character
    skills: Array<any>

    constructor(params: GameInterface) {
        this.mainCharacter = params.mainCharacter
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

export interface GameInterface {
    mainCharacter: Character
    skills: Array<any>
}
