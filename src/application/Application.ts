import Game, { GameInterface } from './Game'

export class Application {
    private static _instance?: Application

    static get Instance(): Application {
        if (!this._instance) {
            this._instance = new Application()
        }
        return this._instance
    }

    game?: Game

    createGame(params: GameInterface) {
        if (this.game) {
            throw new Error('Please end current game before create a new one')
        }
        this.game = new Game(params)
        return this.game
    }

    endCurrentGame() {
        this.game = undefined
    }
}
