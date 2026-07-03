import { Reward } from '../entities/reward'

/** 奖励快捷函数 */
export const passive = (id: string): Reward => ({ type: 'passive', id, name: id, description: '', tags: [] })
export const artifact = (id: string): Reward => ({ type: 'artifact', id, name: id, description: '', tags: [] })
export const action = (id: string): Reward => ({ type: 'action', id, name: id, description: '', tags: [] })
export const weapon = (id: string): Reward => ({ type: 'weapon', id, name: id, description: '', tags: [] })
