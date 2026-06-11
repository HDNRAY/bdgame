import type { GameEntity } from '../entities/base'

/** Buff 定义 */
export interface BuffDef extends GameEntity {
    value?: number
}

export const BUFF_DB: BuffDef[] = [
    { id: 'iaijutsu', name: '居合', description: '拔刀之势，蓄势待发。', tags: [], value: 0 },
    { id: 'foresight', name: '看破', description: '洞察先机，招架率+0.5。', tags: [], value: 0.5 },
    { id: 'mind_eye', name: '心眼', description: '心眼已开，暴击率+0.25。', tags: [], value: 0.25 },
]

export function getBuff(id: string): BuffDef | undefined {
    return BUFF_DB.find((b) => b.id === id)
}
