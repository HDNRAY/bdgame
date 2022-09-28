import { Storage } from 'utils/Storage'
import { GameInterface } from './Game'

export namespace System {
    export function saveRecord(id: string, params: GameInterface) {}

    export function loadRecord(id: string): GameInterface {
        const saved: any = {}
        return saved
    }

    export function loadRecordList(): Array<any> {
        const recordList = Storage.getItem('record-list') || []
        return recordList
    }
}
