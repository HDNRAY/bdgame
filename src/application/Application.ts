import Game, { GameInfo } from './Game'
import { Skill } from './models/Skill'

export class Application {
    private static _instance?: Application

    private _skills: Array<Skill> = []
    get skills() {
        return this._skills
    }
    set skills(value: Array<Skill>) {
        this._skills = value
        this._skillsMap = value.reduce((r: any, i) => {
            r[i.id] = i
            return r
        }, {})
    }

    private _skillsMap: { [key: string]: Skill } = {}
    get skillsMap() {
        return this._skillsMap
    }

    static get Instance(): Application {
        if (!this._instance) {
            this._instance = new Application()
        }
        return this._instance
    }

    game?: Game

    initGame(params: GameInfo) {
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
