import Character, { CharacterInfo } from 'application/models/Character'
import { nanoid } from 'nanoid'

export namespace CharacterFactory {
    // constructor() {}

    export function createPlayerCharacter(params: CharacterCreationInterface): CharacterInfo {
        const id = nanoid()
        return {
            id,
            name: params.name,
        }
    }

    export function buildCharacterFromInfo(params: CharacterInfo): Character {
        return new Character(params)
    }
}

export interface CharacterCreationInterface {
    name: string
}
