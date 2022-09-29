import { Storage } from 'utils/Storage'
import { GameInfo } from './Game'

const RECORD_LIST_ID = `record-list`
const recordIdTemplate = (id: string) => `record-${id}`

export namespace System {
    export function saveRecord(id: string, params: GameInfo) {
        const recordId = recordIdTemplate(id)
        const recordList: Array<any> = Storage.getItem(RECORD_LIST_ID) || []
        const index = recordList.findIndex((i) => i.id === recordId)
        const recordListItem = {
            id: recordId,
            name: params.mainCharacter.name,
        }
        if (index > -1) {
            recordList.splice(index, 1, recordListItem)
        } else {
            recordList.push(recordListItem)
        }
        Storage.setItem(RECORD_LIST_ID, recordList)
        Storage.setItem(recordId, params)
    }

    export function loadRecord(id: string): GameInfo {
        const recordId = recordIdTemplate(id)
        const saved: any = Storage.getItem(recordId)
        return saved
    }

    export function loadRecordList(): Array<any> {
        const recordList = Storage.getItem(RECORD_LIST_ID) || []
        return recordList
    }
}
